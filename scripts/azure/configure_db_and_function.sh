#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION="${SUBSCRIPTION:-Azure subscription 1}"
RG="${RG:-AVSCloud-RG}"
FUNC_APP="${FUNC_APP:-avs-horizon-global-func-auth}"
SQL_SERVER="${SQL_SERVER:-sql-avs-server-3890}"
SQL_DB="${SQL_DB:-qldb-avs-horizon-core}"
USER_UPN="${USER_UPN:-dynamicsops14@avsglobalsupply.com}"

echo "Using subscription: $SUBSCRIPTION"
az account set --subscription "$SUBSCRIPTION"

echo "Assigning system managed identity to function app: $FUNC_APP"
az functionapp identity assign -g "$RG" -n "$FUNC_APP" >/dev/null

echo "Applying function app runtime/security settings"
az functionapp config set \
  -g "$RG" \
  -n "$FUNC_APP" \
  --linux-fx-version "Node|24" \
  --min-tls-version 1.2 \
  --ftps-state Disabled >/dev/null

az functionapp update \
  -g "$RG" \
  -n "$FUNC_APP" \
  --set httpsOnly=true >/dev/null

echo "Setting app settings for Azure SQL (managed identity mode)"
az functionapp config appsettings set \
  -g "$RG" \
  -n "$FUNC_APP" \
  --settings \
    SQL_SERVER="${SQL_SERVER}.database.windows.net" \
    SQL_DATABASE="$SQL_DB" \
    SQL_AUTH_MODE=ManagedIdentity \
    AZURE_CLIENT_USE_MI=true \
    APP_ENV=dev >/dev/null

echo "Ensuring Azure SQL AAD admin is configured: $USER_UPN"
USER_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"
az sql server ad-admin create \
  -g "$RG" \
  -s "$SQL_SERVER" \
  -u "$USER_UPN" \
  -i "$USER_OBJECT_ID" >/dev/null

echo
echo "Completed infrastructure configuration."
echo
echo "Run these SQL scripts on database [$SQL_DB] in order:"
echo "1) sql/001_create_identity_and_support.sql"
echo "2) sql/003_grant_function_identity.sql  (set FUNC_APP_NAME if needed)"
echo
echo "Example variables for sql/003_grant_function_identity.sql:"
echo "  FUNC_APP_NAME=$FUNC_APP"
