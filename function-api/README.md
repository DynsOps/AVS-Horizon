# AVS Horizon Function API

## Endpoints
- `GET /api/auth/me`
- `POST /api/support/tickets`
- `POST /api/identity/users`

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
