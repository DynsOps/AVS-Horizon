# AVS Horizon Deployment Runbook

## 1) SQL migration

Azure SQL Query Editor'da sırasıyla çalıştır:

1. `sql/001_create_identity_and_support.sql`
2. `sql/003_grant_function_identity.sql`
3. `sql/004_add_password_hash.sql`

## 2) Function App settings

Function App: `avs-horizon-global-func-auth`

`Configuration > Application settings` içine ekle:

- `AZURE_AD_TENANT_ID=9aa5bdbb-9a1e-4beb-94ff-51b6a4360a99`
- `AZURE_AD_CLIENT_ID=fdec718f-914f-4403-b31a-e19318b81302`
- `AZURE_AD_AUDIENCE=fdec718f-914f-4403-b31a-e19318b81302`
- `SQL_SERVER=sql-avs-server-3890.database.windows.net`
- `SQL_DATABASE=qldb-avs-horizon-core`
- `SQL_AUTH_MODE=ManagedIdentity`

Kaydet ve Function App restart et.

## 3) GitHub secrets

Repository > Settings > Secrets and variables > Actions > Secrets:

- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` (publish profile XML içeriği)
- `VITE_AZURE_AD_TENANT_ID`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_REDIRECT_URI=https://horizon.avsglobalsupply.com/`
- `VITE_AZURE_AD_SCOPE=openid profile email offline_access User.Read api://fdec718f-914f-4403-b31a-e19318b81302/access_as_user`
- `VITE_FUNCTION_API_BASE_URL=https://avs-horizon-global-func-auth.azurewebsites.net`

## 4) Workflows

Push sonrası iki workflow çalışmalı:

1. `.github/workflows/azure-function-api-deploy.yml`
2. `.github/workflows/azure-static-web-apps.yml`

## 5) Live smoke test

URL: `https://horizon.avsglobalsupply.com/#/login`

Kontrol listesi:

1. Microsoft login başarılı.
2. `Security Logs` menüsü doğru sayfayı açıyor.
3. Role göre menu görünürlüğü doğru.
4. User create sonrası temporary password görünüyor.
5. Duplicate email hata mesajı geliyor.
6. Profile > Change Password başarılı çalışıyor.
7. Logout sadece uygulamadan çıkış ve login sayfasına dönüş yapıyor.

## 6) Hızlı hata kontrolü

- `AADSTS900144 client_id missing` alırsan: `VITE_AZURE_AD_CLIENT_ID` build env'e geçmemiştir.
- `No access record found` alırsan: DB'de user yoktur veya domain auto-provision kuralı eşleşmiyordur.
- Change password 401/500 alırsan: Function App app settings veya SQL migration eksiktir.
