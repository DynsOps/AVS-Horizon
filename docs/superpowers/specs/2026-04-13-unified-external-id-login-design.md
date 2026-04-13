# AVS Horizon Unified External ID Login Design

## Goal

Restructure AVS Horizon authentication so that:

- `Sign in` uses Microsoft Entra External ID local account / email OTP sign-in
- `Continue with Microsoft` also uses the same External ID external tenant, but through a federated Microsoft Entra ID identity provider
- both flows remain Entra-native end to end
- the portal backend only validates the resulting External ID token and applies AVS authorization rules
- a user can sign in with either method when both are available for the same email

## Product Decision

The previous multitenant workforce approach introduced cross-tenant consent and app registration friction that is not a good fit for a customer portal.

The new decision is:

1. keep the application in the External ID customer model
2. use the external tenant as the single authentication surface
3. support two sign-in paths inside that model:
   - local/OTP
   - federated Microsoft Entra ID
4. keep authorization in the portal database:
   - user existence
   - company membership
   - role
   - permissions

## Why This Approach

This model matches the actual operating model of the portal:

- admins know the customer email, company, and role
- admins do not reliably know whether a specific user already has a Microsoft Entra account, whether their tenant is ready, or which sign-in path they will prefer
- the login page should remain simple:
  - `Sign in`
  - `Continue with Microsoft`

By keeping both options available and accepting either for the same registered email, onboarding stays lightweight while identity stays in Entra.

## Authentication Architecture

### Single external tenant surface

Authentication is unified under the External ID external tenant.

Frontend uses:

- one External ID SPA app
- one External ID API app
- one External ID user flow

The user flow exposes multiple identity methods:

- Email OTP / local account
- Microsoft Entra ID federated provider(s)

The frontend no longer needs a separate workforce MSAL app for `Continue with Microsoft`.

### Token issuer model

Both sign-in buttons ultimately produce tokens that the backend accepts through the External ID trust model.

Expected behavior:

- local/OTP sign-in returns an External ID token
- Microsoft federated sign-in also returns an External ID-issued token after federation completes

This means the backend can keep a single token validation path for customer sign-in rather than juggling:

- workforce multitenant issuers
- foreign tenant consent behavior
- separate workforce and customer app registrations

## Login UX

The login page keeps two buttons:

- `Sign in`
- `Continue with Microsoft`

### Sign in

This starts the External ID user flow using the local/OTP-capable sign-in route.

Intended users:

- personal email users
- users who do not have a Microsoft organizational account available for this portal
- users who prefer OTP/local authentication

### Continue with Microsoft

This starts the same External ID experience but routes the user through the Microsoft Entra ID federated identity provider configured in the external tenant.

Intended users:

- business users with an existing Microsoft organizational account

### Provider flexibility

The same email is allowed to use either route when both succeed.

The portal does **not** permanently bind the user to one provider.

Implications:

- a user can first sign in with OTP and later use Microsoft
- a user can first sign in with Microsoft and later use OTP
- backend authorization is tied to the AVS user record, not to a single mandatory provider choice

## Authorization Rules

Authentication stays in Entra. Authorization stays in AVS.

After a token is validated, the backend resolves the AVS user record by:

1. linked identity object id when present
2. normalized email

Access is granted only if the AVS-side rules permit it.

### Explicit user record

If the email already exists in `dbo.users`, the backend loads:

- company
- role
- permissions
- access state

### Domain-based onboarding

If domain-based auto-provision remains enabled, the backend may still auto-create a restricted `pending` user when:

- the email domain is allowlisted for a company
- no explicit user record exists

This remains a portal-side decision and is independent from the chosen sign-in method.

### Denial behavior

If the token is valid but AVS authorization cannot resolve access:

- return a clear access error
- do not create Entra-side objects
- do not require guest provisioning

## Company and User Model

### Company configuration

Companies continue to store:

- company metadata
- allowed domains

No hard company-level lock to a single sign-in mode is required for the initial version.

This is important because admins typically know:

- the user's email
- the user's company
- the user's role

They do not necessarily know:

- whether the user has a Microsoft organizational account
- whether the customer tenant federation has already been configured

### User records

User creation remains portal-first:

- admin creates the user record in AVS
- AVS stores email, company, role, permissions, and provisioning metadata

The user can later authenticate through either supported Entra route.

## External ID Federation Model

Corporate Microsoft sign-in relies on External ID federation with Microsoft Entra ID as an OpenID Connect identity provider.

Important limitation from Microsoft documentation:

- Microsoft Entra ID federation for External ID customers is tenant-specific, not magical tenant discovery
- a customer tenant must be configured as an identity provider before its users can sign in through that federated route

This means `Continue with Microsoft` can be a valid global button, but success depends on whether the relevant customer tenant has already been federated in the external tenant.

Operationally:

- if federation is configured for the user's Microsoft tenant, `Continue with Microsoft` succeeds
- if it is not configured, the user must use `Sign in` or the tenant must be onboarded for federated Microsoft sign-in

## Backend Changes

Backend continues to validate bearer tokens rather than switching to server-managed sessions.

### Validation model

The backend should simplify to a single customer-auth token model:

- accept External ID-issued tokens
- remove the separate workforce multitenant validation path from the primary customer-login flow

### Identity linkage

The backend should continue to persist linkage metadata when available:

- `entra_object_id`
- `identity_provider_type`
- `identity_tenant_id`

But these fields should be treated as identity hints and linkage metadata, not as a hard lock that prevents the same email from using the alternate approved sign-in route.

### Provider type expectations

For the unified External ID model, the effective provider family becomes customer-auth inside the external tenant.

The portal may still retain values such as:

- `external_local`
- `workforce_federated`

but the critical behavior is that both resolve through the same external-tenant auth boundary.

If the existing enum values create confusion, a future cleanup may consolidate them.

## Frontend Changes

### MSAL instances

The frontend should stop treating workforce and external local as two unrelated app registrations.

Recommended end state:

- one External ID-based auth surface
- clear login requests for:
  - local/OTP route
  - Microsoft federated route

### Bridge logic

`MsalAuthBridge` should:

- stop trying to acquire tokens from a separate workforce app
- resolve authenticated accounts from the unified External ID app context
- continue calling backend access validation with the Entra-issued access token

### Error handling

The login experience should show provider-appropriate errors:

- token validation failure
- no AVS access record
- tenant/provider not yet configured for Microsoft federation

If `Continue with Microsoft` fails because the tenant has not been federated in External ID yet, the error should be explicit enough for operations to diagnose.

## Data Model Expectations

The current schema is largely sufficient for the first iteration.

Existing columns already useful here:

- `entra_object_id`
- `identity_provider_type`
- `identity_tenant_id`
- `provisioning_source`
- `access_state`

No new table is mandatory for the first step.

Optional later enhancement:

- `company_identity_providers`
- or `company_tenants`

to explicitly track which companies have Microsoft federated tenant onboarding completed.

## Azure Configuration Expectations

### External tenant

Required:

- External ID external tenant
- External ID SPA app for the frontend
- External ID API app for the backend resource
- user flow configured for customer sign-in

### Sign-in methods

The user flow should expose:

- Email OTP / local account
- Microsoft Entra ID federated identity provider(s)

### Federation onboarding

For each corporate Microsoft tenant that should support `Continue with Microsoft`, operations must configure Microsoft Entra ID federation in the external tenant according to Microsoft documentation.

## Testing Strategy

### Local/OTP tests

- local account can sign in through `Sign in`
- resulting token is accepted by backend
- `auth/me` returns the correct AVS user

### Federated Microsoft tests

- a federated Microsoft tenant user can sign in through `Continue with Microsoft`
- the resulting token is still validated as External ID customer auth
- AVS user resolution by email/object id succeeds

### Dual-provider tests

- same email can sign in with OTP first, then Microsoft
- same email can sign in with Microsoft first, then OTP
- authorization result remains the same AVS user record

### Failure tests

- valid Entra token but no AVS user/domain access returns denial
- unfederated Microsoft tenant returns a diagnosable login failure
- switching between `Sign in` and `Continue with Microsoft` does not corrupt client auth state

## Risks and Constraints

### Microsoft federation onboarding is still operational work

This design removes the foreign-tenant delegated-consent problem of the multitenant workforce app approach, but it does **not** eliminate all onboarding work.

Federated Microsoft sign-in still requires:

- the relevant customer tenant to be set up as an identity provider in the external tenant

That is a real operational constraint and should be made explicit.

### Same-email dual-provider support increases linkage complexity

Allowing both routes for the same email is user-friendly, but it means backend identity matching must stay careful:

- prefer stable object-id linkage when available
- allow normalized email fallback
- avoid creating duplicate users for the same email

## Recommendation

Adopt a unified External ID model:

- `Sign in` = External ID local/OTP
- `Continue with Microsoft` = External ID federated Microsoft sign-in
- both methods remain allowed for the same AVS user email
- backend continues to authorize through AVS records, not Entra tenant membership

This best matches AVS Horizon as a customer portal:

- authentication stays inside Entra
- portal authorization stays inside AVS
- onboarding remains email-first
- the current multitenant workforce consent friction is removed from the primary design
