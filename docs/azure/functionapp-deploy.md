# Azure Function App Deploy Start (CLI)

## 1) Prerequisites
- Azure CLI installed
- Logged in: `az login`
- Correct subscription selected

## 2) Variables
Use your project naming convention:

```bash
SUBSCRIPTION="Azure subscription 1"
LOCATION="northeurope"
RG="AVSCloud-RG"
FUNC_APP="avs-horizon-global-func-auth"
STORAGE="avshorizonstoragefunc"
PLAN="avs-horizon-global-func-plan"
```

## 3) Create resources
```bash
az account set --subscription "$SUBSCRIPTION"

az group create \
  --name "$RG" \
  --location "$LOCATION"

az storage account create \
  --name "$STORAGE" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Standard_LRS

az functionapp plan create \
  --name "$PLAN" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --number-of-workers 1 \
  --sku B1 \
  --is-linux

az functionapp create \
  --name "$FUNC_APP" \
  --resource-group "$RG" \
  --plan "$PLAN" \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --storage-account "$STORAGE"
```

## 4) Configure app settings
```bash
az functionapp config appsettings set \
  --name "$FUNC_APP" \
  --resource-group "$RG" \
  --settings \
    "AZURE_AD_TENANT_ID=<home-tenant-id>" \
    "AZURE_AD_CLIENT_ID=<api-client-id>" \
    "AZURE_AD_AUDIENCE=<api-client-id>" \
    "EXTERNAL_ID_TENANT_ID=<external-id-tenant-id>" \
    "EXTERNAL_ID_CLIENT_ID=<external-id-app-client-id>" \
    "EXTERNAL_ID_CLIENT_SECRET=<external-id-app-client-secret>" \
    "EXTERNAL_ID_AUDIENCE=<api-client-id>" \
    "EXTERNAL_ID_AUTHORITY=https://<tenant-name>.ciamlogin.com/<tenant-id-or-domain>/<user-flow>" \
    "EXTERNAL_ID_JWKS_URI=https://<tenant-name>.ciamlogin.com/<tenant-id-or-domain>/discovery/v2.0/keys?p=<user-flow>" \
    "EXTERNAL_ID_ISSUER_DOMAIN=<tenant-name>.onmicrosoft.com" \
    "EXTERNAL_ID_ISSUERS=https://<tenant-name>.ciamlogin.com/<tenant-id>/v2.0/,https://<tenant-name>.ciamlogin.com/<tenant-domain>/v2.0/" \
    "EXTERNAL_ID_USER_FLOW=<user-flow-name>" \
    "SQL_SERVER=<azure-sql-server>.database.windows.net" \
    "SQL_DATABASE=<azure-sql-database>" \
    "SQL_AUTH_MODE=ManagedIdentity"
```

## 5) Frontend env to enable real Microsoft redirect
Set in `.env` (or SWA config):
- `VITE_AZURE_AD_TENANT_ID`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_REDIRECT_URI`
- `VITE_AZURE_AD_SCOPE`
- `VITE_EXTERNAL_ID_AUTHORITY`
- `VITE_EXTERNAL_ID_CLIENT_ID`
- `VITE_EXTERNAL_ID_REDIRECT_URI`
- `VITE_EXTERNAL_ID_SCOPE`

Notes:
- `VITE_AZURE_AD_AUTHORITY` should be `https://login.microsoftonline.com/organizations` for corporate Microsoft login.
- `VITE_EXTERNAL_ID_AUTHORITY` should be the CIAM host root only, for example `https://<tenant-name>.ciamlogin.com`.
- Backend `EXTERNAL_ID_AUTHORITY` is different: keep the tenant/user-flow path because the Function API uses it for app-only token acquisition.

## 6) Entra-first notes
- Corporate Microsoft users sign in through the multitenant workforce app using the `organizations` authority.
- Do not create guest objects for corporate users; access remains controlled by portal records and company/domain allowlists.
- Password login, password reset, and MFA are hosted by Entra ID, not by the Function API.
- The Function API now stores portal authorization only: company membership, role, permission, provisioning source, and access state.
- Personal email users can be created as External ID local accounts. The Function API provisions the Entra identity first, then persists the portal access record.
- Company domain allowlists live in `dbo.company_domains`.
- Apply both schema alignment and row-level security before enabling production traffic.

### Corporate Microsoft Login (Multitenant)

- Set the SPA and API app registrations to `Multiple Entra ID tenants`.
- Use `https://login.microsoftonline.com/organizations` for the workforce login authority.
- Keep corporate access portal-owned: corporate users still need an explicit portal record or matching company/domain policy.
- Keep External ID local/OTP sign-in separate for personal email users.

## 7) If App Registration is deferred
You can still complete DB + Function infrastructure now:

```bash
./scripts/azure/configure_db_and_function.sh
```

Then run SQL scripts on `qldb-avs-horizon-core`:
1. `sql/005_create_companies.sql`
2. `sql/001_create_identity_and_support.sql`
3. `sql/006_align_identity_schema.sql`
4. `sql/008_add_identity_provider_metadata.sql`
5. `sql/003_grant_function_identity.sql`
6. `sql/007_enforce_company_rls.sql`
