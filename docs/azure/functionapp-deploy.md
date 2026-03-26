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
    "AZURE_AD_TENANT_ID=<tenant-id>" \
    "AZURE_AD_CLIENT_ID=<api-client-id>" \
    "AZURE_AD_AUDIENCE=api://<api-client-id>" \
    "SQL_CONNECTION_STRING=<azure-sql-conn-string>"
```

## 5) Frontend env to enable real Microsoft redirect
Set in `.env` (or SWA config):
- `VITE_AZURE_AD_TENANT_ID`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_REDIRECT_URI`
- `VITE_AZURE_AD_SCOPE`

## 6) Next step
Implement Function endpoints:
- `GET /api/auth/me` (token validation + user mapping)
- `POST /api/support/tickets`
- `POST /api/admin/users`
- etc. with strict RBAC checks server-side

## 7) If App Registration is deferred
You can still complete DB + Function infrastructure now:

```bash
./scripts/azure/configure_db_and_function.sh
```

Then run SQL scripts on `qldb-avs-horizon-core`:
1. `sql/001_create_identity_and_support.sql`
2. `sql/003_grant_function_identity.sql`
