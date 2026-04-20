# AVS Horizon Function API

## Endpoints
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `PATCH /api/auth/profile-password` (`410 Gone`, retired in Entra-first mode)
- `POST /api/auth/login-password` (`410 Gone`, retired in Entra-first mode)
- `POST /api/auth/change-password` (`410 Gone`, retired in Entra-first mode)
- `POST /api/auth/change-password-password` (`410 Gone`, retired in Entra-first mode)
- `POST /api/support/tickets`
- `GET /api/support/tickets/me`
- `POST /api/support/tickets/{id}/replies`
- `GET /api/support/admin/tickets`
- `POST /api/support/admin/tickets/{id}/replies`
- `PATCH /api/support/admin/tickets/{id}/status`
- `GET /api/notifications`
- `PATCH /api/notifications/{id}/read`
- `POST /api/powerbi/company-chains`
- `GET /api/fabric/group-projtables` (`q` and `limit` query params supported)
- `GET /api/identity/users`
- `POST /api/identity/users`
- `PATCH /api/identity/users/{id}`
- `DELETE /api/identity/users/{id}`
- `POST /api/identity/users/{id}/reset-password` (`410 Gone`, retired in Entra-first mode)
- `GET /api/identity/companies`
- `POST /api/identity/companies`
- `PATCH /api/identity/companies/{id}`
- `DELETE /api/identity/companies/{id}`

## Identity model
- Authentication, MFA, password reset, and lockout are managed by Entra ID.
- Portal users store `entra_object_id`, `company_id`, `role`, `provisioning_source`, and `access_state`.
- Portal sign-in is External ID only.
- New users are provisioned as External ID local accounts and receive a one-time temporary password.
- Legacy rows may still contain older provisioning metadata, but new logins flow through External ID.
- Provider metadata is stored in `identity_provider_type` and `identity_tenant_id`.
- Corporate domains are managed through `dbo.company_domains`.
- Zero-permission users are valid authenticated users and land in `pending` access state until a company admin grants permissions.

## Required app settings
- `EXTERNAL_ID_TENANT_ID`
- `EXTERNAL_ID_CLIENT_ID`
- `EXTERNAL_ID_CLIENT_SECRET`
- `EXTERNAL_ID_AUDIENCE`
- `EXTERNAL_ID_AUTHORITY`
- `EXTERNAL_ID_JWKS_URI`
- `EXTERNAL_ID_ISSUER_DOMAIN`
- `EXTERNAL_ID_ISSUERS`
- `EXTERNAL_ID_GRAPH_SCOPE` (optional, defaults to `https://graph.microsoft.com/.default`)
- `SQL_SERVER`
- `SQL_PORT` (optional, default `1433`)
- `SQL_DATABASE`
- `SQL_AUTH_MODE` (`ManagedIdentity` or `SqlPassword`)
- `SQL_USER` and `SQL_PASSWORD` (required for `SqlPassword`)
- `SQL_ENCRYPT` (optional, default `true`)
- `SQL_TRUST_SERVER_CERTIFICATE` (optional, default `false`)
- `POWERBI_TENANT_ID` (required for Power BI / Fabric calls)
- `POWERBI_CLIENT_ID` (required for Power BI / Fabric calls)
- `POWERBI_CLIENT_SECRET` (required for Power BI / Fabric calls)
- `FABRIC_AAD_SCOPE` (optional, defaults to `https://api.fabric.microsoft.com/.default`)
- `FABRIC_GRAPHQL_ENDPOINT` (required for `/api/powerbi/company-chains`)
- `FABRIC_GRAPHQL_TIMEOUT_MS` (optional, default `10000`)

## Local run
```bash
cp local.settings.example.json local.settings.json
npm install
npm run build
npm start
```

## Deploy
```bash
func azure functionapp publish avs-horizon-global-func-auth --typescript
```

## SQL rollout order
1. `sql/005_create_companies.sql`
2. `sql/001_create_identity_and_support.sql`
3. `sql/006_align_identity_schema.sql`
4. `sql/008_add_identity_provider_metadata.sql`
5. `sql/003_grant_function_identity.sql`
6. `sql/007_enforce_company_rls.sql`
7. `sql/011_support_replies_and_notifications.sql`
8. `sql/012_add_company_project_fields.sql`
9. `sql/013_drop_company_contact_fields.sql`
