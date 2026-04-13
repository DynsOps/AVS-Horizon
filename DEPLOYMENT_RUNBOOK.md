# AVS Horizon Deployment Runbook

## 1) SQL migration

Azure SQL Query Editor'da sirasiyla calistir:

1. `sql/001_create_identity_and_support.sql`
2. `sql/003_grant_function_identity.sql`
3. `sql/004_add_password_hash.sql`
4. `sql/008_add_identity_provider_metadata.sql`

## 2) Function App settings

Function App: `avs-horizon-global-func-auth`

`Configuration > Application settings` icine ekle:

- `AZURE_AD_TENANT_ID=organizations`
- `AZURE_AD_CLIENT_ID=<workforce-spa-client-id>`
- `AZURE_AD_AUDIENCE=<workforce-spa-client-id>`
- `EXTERNAL_ID_TENANT_ID=<external-id-tenant-id>`
- `EXTERNAL_ID_CLIENT_ID=<external-id-confidential-app-client-id>`
- `EXTERNAL_ID_CLIENT_SECRET=<external-id-confidential-app-secret>`
- `EXTERNAL_ID_AUDIENCE=<external-id-spa-client-id>`
- `EXTERNAL_ID_AUTHORITY=https://<tenant-name>.ciamlogin.com/<tenant-id-or-domain>/<user-flow>`
- `EXTERNAL_ID_JWKS_URI=https://<tenant-name>.ciamlogin.com/<tenant-id-or-domain>/discovery/v2.0/keys?...`
- `EXTERNAL_ID_ISSUER_DOMAIN=<tenant-name>.onmicrosoft.com`
- `EXTERNAL_ID_ISSUERS=<ciam-issuer-list>`
- `EXTERNAL_ID_USER_FLOW=<user-flow-name>`
- `EXTERNAL_ID_GRAPH_SCOPE=https://graph.microsoft.com/.default`
- `SQL_SERVER=sql-avs-server-3890.database.windows.net`
- `SQL_DATABASE=qldb-avs-horizon-core`
- `SQL_AUTH_MODE=ManagedIdentity`

Kaydet ve Function App restart et.

## 3) Frontend build env

Static Web App / CI ortaminda su degerler olmali:

- `VITE_AZURE_AD_AUTHORITY=https://login.microsoftonline.com/organizations`
- `VITE_AZURE_AD_CLIENT_ID=<workforce-spa-client-id>`
- `VITE_AZURE_AD_REDIRECT_URI=https://horizon.avsglobalsupply.com/`
- `VITE_AZURE_AD_SCOPE=openid profile email`
- `VITE_EXTERNAL_ID_AUTHORITY=https://<tenant-name>.ciamlogin.com`
- `VITE_EXTERNAL_ID_CLIENT_ID=<external-id-spa-client-id>`
- `VITE_EXTERNAL_ID_REDIRECT_URI=https://horizon.avsglobalsupply.com/`
- `VITE_EXTERNAL_ID_SCOPE=openid profile email`
- `VITE_FUNCTION_API_BASE_URL=https://avs-horizon-global-func-auth.azurewebsites.net`

## 4) Azure app registrations

Iki ayri SPA kalacak:

1. `Continue with Microsoft`
- workforce multitenant SPA
- `Supported account types = Multiple Entra ID tenants`
- redirect URI: uygulamanin login callback adresi

2. `Sign in`
- External ID SPA
- local/OTP customer login icin
- browser authority sadece `https://<tenant-name>.ciamlogin.com` host root olmali

Bu modelde frontend `access_as_user` istemez. Browser sadece `openid profile email` ister ve backend `auth/me` icin gelen ID token'i dogrular.

## 5) Live smoke test

URL: `https://horizon.avsglobalsupply.com/#/login`

Kontrol listesi:

1. `Continue with Microsoft` workforce login sayfasina gider.
2. `Sign in` External ID local/OTP akisina gider.
3. Kayitli email Microsoft ile girdiginde `auth/me` basarili doner.
4. Kayitli olmayan email Microsoft ile girdiginde kullaniciya erisim kaydi bulunamadi hatasi gorunur.
5. External local kullanici OTP/local akisiyla girebilir.
6. Logout dogru login ekranina doner.

## 6) Hizli hata kontrolu

- `AADSTS900144 client_id missing` alirsan: ilgili `VITE_*_CLIENT_ID` build env'e gecmemistir.
- `AADSTS650059` alirsan: workforce SPA gercekten multitenant degildir veya yanlis client id kullaniliyordur.
- `AADSTS500207` alirsan: External ID local login ilk istekte yanlis app/resource kombinasyonuna gitmistir.
- `No access record found` alirsan: DB'de o email icin portal erisim kaydi yoktur.
