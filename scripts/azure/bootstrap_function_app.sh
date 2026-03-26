#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION="${SUBSCRIPTION:-Azure subscription 1}"
LOCATION="${LOCATION:-northeurope}"
RG="${RG:-AVSCloud-RG}"
FUNC_APP="${FUNC_APP:-avs-horizon-global-func-auth}"
STORAGE="${STORAGE:-avshorizonstoragefunc}"
PLAN="${PLAN:-avs-horizon-global-func-plan}"

az account set --subscription "$SUBSCRIPTION"

az group create --name "$RG" --location "$LOCATION"

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

echo "Function App bootstrap completed: $FUNC_APP"
