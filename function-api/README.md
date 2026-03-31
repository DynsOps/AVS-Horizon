# AVS Horizon Function API

## Endpoints
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `PATCH /api/auth/profile-password`
- `POST /api/auth/login-password`
- `POST /api/auth/change-password`
- `POST /api/auth/change-password-password`
- `POST /api/support/tickets`
- `GET /api/identity/users`
- `POST /api/identity/users`
- `PATCH /api/identity/users/{id}`
- `DELETE /api/identity/users/{id}`
- `POST /api/identity/users/{id}/reset-password`
- `GET /api/identity/companies`
- `POST /api/identity/companies`
- `PATCH /api/identity/companies/{id}`
- `DELETE /api/identity/companies/{id}`

## Required app settings
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_AUDIENCE` (or set to backend app registration client id)
- `SQL_SERVER`
- `SQL_PORT` (optional, default `1433`)
- `SQL_DATABASE`
- `SQL_AUTH_MODE` (`ManagedIdentity` or `SqlPassword`)
- `SQL_USER` and `SQL_PASSWORD` (required for `SqlPassword`)
- `SQL_ENCRYPT` (optional, default `true`)
- `SQL_TRUST_SERVER_CERTIFICATE` (optional, default `false`)

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
