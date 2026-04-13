# AVS Horizon External ID Federated Microsoft Login Design

## Goal

Adjust AVS Horizon so that:

- both login buttons run through the same Microsoft Entra External ID tenant
- `Sign in` continues to serve External ID local-account users
- `Continue with Microsoft` sends corporate users directly to the federated Microsoft/Entra provider instead of the generic External ID picker
- backend authorization remains portal-owned through portal user records and company/domain rules

## Context

The current frontend mixes two different authentication models:

- External ID local-account login through the External ID tenant
- direct workforce login through `https://login.microsoftonline.com/organizations`

That split no longer matches the intended product behavior. The selected direction is to keep all interactive authentication inside the External ID customer tenant and let External ID handle both:

- local accounts
- federated Microsoft/Entra identities

The current app registrations already live in the External ID tenant:

- `AVS-Horizon-Ext-SPA`
- `AVS-Horizon-Ext-API`

Because of that, the existing `organizations` authority path is now the architectural mismatch.

## Recommended Approach

Use a single External ID browser authority for both buttons, with button-specific routing behavior:

1. `Sign in`
   - starts the normal External ID login flow
   - supports local-account users
2. `Continue with Microsoft`
   - starts the same External ID app registration
   - adds provider-routing query parameters so External ID sends the user directly to the federated Microsoft provider

The backend should treat both flows as External ID-issued tokens. Portal authorization remains unchanged:

- explicit user record
- or controlled domain-based auto-provision where allowed

No direct `organizations` token flow should remain in the frontend.

## Architecture

### Frontend authority model

The frontend should keep only one active authority family for hosted login:

- `VITE_EXTERNAL_ID_AUTHORITY`

The workforce authority branch should be removed from interactive login behavior:

- do not use `https://login.microsoftonline.com/organizations` for `Continue with Microsoft`
- do not keep a separate workforce `PublicClientApplication` for browser sign-in

Instead:

- keep one MSAL instance backed by the External ID SPA app registration
- choose request parameters based on which button the user clicked

### Direct redirect behavior

`Continue with Microsoft` should not show the generic External ID account chooser if the tenant can route directly to the Microsoft provider.

The request should support provider-routing through configurable extra query parameters. The design choice is:

- frontend exposes a small config surface for provider routing
- request includes `login_hint` when the email field is filled
- request includes configured provider-routing query parameters for the Microsoft button

Recommended default configuration shape:

- `VITE_EXTERNAL_ID_MICROSOFT_QUERY=domain_hint=organizations`

Implementation should parse this string into `extraQueryParameters` for the Microsoft button only.

If the tenant later requires a different routing hint, the app should not need code changes; only the env value should change.

### Local-account behavior

`Sign in` should continue using the same External ID tenant without Microsoft-specific routing parameters.

That preserves the existing local-account path and prevents local users from being forced through Microsoft federation.

## Backend token model

The backend should stop treating corporate login as a separate `login.microsoftonline.com` issuer family for interactive browser login.

For this design:

- browser-issued login tokens come from the External ID tenant
- backend validation should accept the External ID issuer family as the primary interactive auth path
- provider type for authorization decisions should be derived from portal metadata and supported claims, not from the old assumption that corporate users arrive from the workforce issuer family

This means the backend can still distinguish user types, but the distinction should no longer rely on two different browser authority families.

## Identity Rules

### Corporate users

Corporate users can still be represented by:

- pre-created portal users
- auto-domain users when their company domain is allowlisted

On successful login:

1. validate the External ID token
2. resolve the portal user by:
   - `entra_object_id`
   - then normalized email fallback
3. if matched, link identity metadata when missing
4. if not matched but the domain is allowlisted, auto-provision according to current portal rules
5. if neither condition matches, deny access

### Local-account users

Local-account users continue to authenticate through External ID local credentials.

They should use the same backend token validation family, but continue to be marked in portal records as `external_local` identities.

### Provider classification

The portal should keep using `identity_provider_type` to represent intended user type:

- `external_local`
- `workforce_federated`

However, after this design, both identity types may arrive through the same External ID issuer family. That means backend classification must tolerate:

- External ID issuer + local-account user
- External ID issuer + federated Microsoft corporate user

Classification should prefer:

1. stored portal metadata
2. known provisioning source
3. stable claims available from the External ID token

It should not depend on `login.microsoftonline.com` issuer matching for the interactive browser path.

## Frontend Components

### `src/auth/authConfig.ts`

Responsibilities:

- collapse hosted login onto the External ID authority
- keep local-account and Microsoft-button requests separate by request options, not by tenant family
- expose parsed Microsoft provider-routing query parameters

### `src/auth/msalInstance.ts`

Responsibilities:

- export a single active MSAL browser instance for hosted login
- remove dual-instance complexity if it is no longer needed

### `src/pages/Login.tsx`

Responsibilities:

- keep two visible buttons
- route both buttons through the External ID instance
- apply Microsoft-specific routing params only for `Continue with Microsoft`

### `src/auth/MsalAuthBridge.tsx`

Responsibilities:

- simplify provider selection logic if two separate browser instances are removed
- continue storing the access token and resolving portal access exactly once per returned account

## Error Handling

### Microsoft button

If the Microsoft direct redirect configuration is invalid or the External ID tenant cannot route the request:

- show a clear sign-in error in the login page
- do not silently fall back to the local-account path
- log the original MSAL error for troubleshooting

### Access denied after successful authentication

If External ID login succeeds but the portal denies access:

- show the existing access error pattern
- do not mutate tenant state
- do not create guest objects

### Unsupported claim shape

If the External ID federated Microsoft token does not contain the claims the portal expects for identity matching:

- fail closed
- log the claim mismatch path on the backend
- do not auto-authorize on partial identity evidence

## Configuration

### Frontend

Keep:

- `VITE_EXTERNAL_ID_CLIENT_ID`
- `VITE_EXTERNAL_ID_AUTHORITY`
- `VITE_EXTERNAL_ID_REDIRECT_URI`
- `VITE_EXTERNAL_ID_SCOPE`

Add:

- `VITE_EXTERNAL_ID_MICROSOFT_QUERY`

Remove from interactive login flow:

- `VITE_AZURE_AD_AUTHORITY`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_SCOPE`

These values can remain temporarily for backward compatibility, but they should not be used by the browser login flow after implementation.

### Backend

Keep:

- `EXTERNAL_ID_*` settings used for token validation and local-account management

Review:

- whether workforce-specific issuer matching is still needed for any non-browser or migration scenario

The default interactive path should be External ID-centric.

## Security Model

Authentication and authorization remain separate:

- External ID proves the user can authenticate
- AVS Horizon decides whether the user is allowed into the portal

Corporate users must still satisfy portal rules:

- explicit portal user record
- or domain-driven onboarding rule

No user gains access just because they can authenticate through Microsoft federation.

## Testing Strategy

### Frontend

- `Sign in` starts External ID login without Microsoft provider-routing parameters
- `Continue with Microsoft` starts External ID login with configured provider-routing parameters
- redirect handling completes with one MSAL instance and no `authority_mismatch` recovery logic

### Backend

- External ID token validation remains valid for local accounts
- External ID-issued federated Microsoft users can still resolve to `workforce_federated` portal users
- corporate allowlist auto-provision still works when the normalized email domain matches
- mismatched provider bindings still fail closed

### End-to-end

1. Admin creates a corporate user or allowlists the company domain
2. User clicks `Continue with Microsoft`
3. Frontend sends the user directly to the Microsoft federated provider through External ID
4. External ID returns to the SPA with an External ID-issued token
5. Portal resolves the user and enforces company-scoped authorization

## Migration Notes

- This design intentionally retires the direct `organizations` browser-login path
- any existing workforce-only MSAL branching in the frontend should be removed rather than preserved
- backend token validation may still temporarily keep legacy issuer support during transition, but the target state is one interactive External ID issuer family

## Recommendation

Proceed with a focused refactor:

1. collapse frontend hosted login onto External ID
2. implement configurable direct-routing for the Microsoft button
3. simplify redirect handling to one MSAL browser authority
4. adapt backend classification so External ID-issued federated Microsoft users remain recognized as corporate users
