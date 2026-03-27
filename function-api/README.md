# AVS Horizon Function API

## Endpoints
- `GET /api/auth/me`
- `POST /api/auth/login-password`
- `POST /api/auth/change-password`
- `POST /api/auth/change-password-password`
- `POST /api/support/tickets`
- `GET /api/identity/users`
- `POST /api/identity/users`
- `PATCH /api/identity/users/{id}`
- `DELETE /api/identity/users/{id}`
- `GET /api/identity/companies`
- `POST /api/identity/companies`
- `PATCH /api/identity/companies/{id}`
- `DELETE /api/identity/companies/{id}`

## Required app settings
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_AUDIENCE` (or set to backend app registration client id)
- `SQL_SERVER`
- `SQL_DATABASE`
- `SQL_AUTH_MODE=ManagedIdentity`

## Local run
```bash
npm install
npm run build
npm start
```

## Deploy
```bash
func azure functionapp publish avs-horizon-global-func-auth --typescript
```
