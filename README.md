# AVS Horizon

AVS Horizon; React + Vite frontend ve Azure Functions tabanli backend (function-api) ile gelistirilen bir portal uygulamasidir.

Bu README, repo clone edildikten sonra yeni bir developer'in kendi bilgisayarinda projeyi kod degisikligi yapmadan calistirabilmesi icin hazirlanmistir.

Hizli kurulum dokumani: [SETUP.md](./SETUP.md)

## Mimari Ozet

### Frontend
- Konum: `/` (repo root)
- Teknoloji: React 19, Vite, TypeScript, Zustand, React Router
- Calisma portu: varsayilan `5173` (musaade edilmezse `5174` vb.)
- Auth:
- `email/password` login (Function API endpointleri)
- Microsoft login (MSAL + Entra ID)

### Backend
- Konum: `function-api/`
- Teknoloji: Azure Functions v4 (Node/TypeScript), MSSQL
- Calisma portu: `7071`
- Auth:
- Bearer token (MSAL/Entra)
- Local dev bypass (`DEV_BYPASS_AUTH=true`) ile `x-dev-user-email`

## Hizli Baslangic (Clone Sonrasi)

### 1. Repo clone
```bash
git clone <repo-url>
cd AVS-Horizon
```

### 2. Frontend env dosyasini olustur
```bash
cp .env.example .env
```

`.env` icinde asagidaki alanlari doldur:
- `VITE_AZURE_AD_TENANT_ID`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_SCOPE`
- `VITE_FUNCTION_API_BASE_URL=http://localhost:7071`
- `VITE_FORCE_FUNCTION_API=true`
- `VITE_DEV_BYPASS_AUTH=true`

### 3. Function API settings dosyasini olustur
```bash
cp function-api/local.settings.example.json function-api/local.settings.json
```

`function-api/local.settings.json` icinde asagidaki alanlari doldur:
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_AUDIENCE`
- `SQL_SERVER`
- `SQL_DATABASE`
- `SQL_AUTH_MODE` (`SqlPassword` lokal icin onerilir)
- `SQL_USER` ve `SQL_PASSWORD` (`SqlPassword` kullaniliyorsa zorunlu)

## Lokal Calistirma

### A. Backend (Function API)
```bash
cd function-api
npm install
npm start
```

Basarili oldugunda endpointler `http://localhost:7071/api/...` altinda listelenir.

### B. Frontend
Yeni terminal:
```bash
cd /path/to/AVS-Horizon
npm install
npm run dev
```

Tarayicida ac:
- `http://localhost:5173` veya terminalde yazan Vite URL'i

### C. Tek komutla ikisini birden calistir
```bash
npm install
npm run dev:all
```

## Login Modlari

### 1. Password login (lokalde en hizli test)
- Frontend `.env`: `VITE_FORCE_FUNCTION_API=true`
- Function API `local.settings.json`: DB baglantisi dogru olmali

### 2. Microsoft login
- Azure App Registration ayarlari dogru olmali
- Redirect URI lokal ortamla uyumlu olmali (`http://localhost:5173/`)

## Sik Karsilasilan Sorunlar

### 1. `Failed to fetch` login hatasi
- Function API ayakta mi kontrol et: `http://localhost:7071`
- `.env` icinde `VITE_FUNCTION_API_BASE_URL` dogru mu kontrol et
- Gerekirse frontend ve function-api yeniden baslat

### 2. `Port 7071 is unavailable`
7071 kullanan sureci kapat:
```bash
lsof -nP -iTCP:7071 -sTCP:LISTEN
kill -9 <PID>
```

### 3. `Login failed for user '<token-identified principal>'`
Bu SQL auth sorunudur. Lokal icin genelde:
- `SQL_AUTH_MODE=SqlPassword`
- `SQL_USER` ve `SQL_PASSWORD` doldurulmali

### 4. `AzureWebJobsStorage` unhealthy
Lokal development icin Azurite calistir:
```bash
azurite --silent --location ~/.azurite --debug ~/.azurite/debug.log
```

## Scriptler

### Root
- `npm run dev` -> Frontend dev server
- `npm run build` -> Frontend production build

### function-api
- `npm start` -> Function host baslatir (`prestart` ile build de yapar)
- `npm run build` -> TypeScript derleme

## Dizin Yapisi

```text
AVS-Horizon/
  src/                     # Frontend source
  function-api/            # Azure Functions backend
    src/functions/         # HTTP trigger functionlar
    src/lib/               # Auth/DB/env yardimcilari
  .env.example             # Frontend env template
```
