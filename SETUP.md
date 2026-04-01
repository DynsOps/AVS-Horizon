# AVS Horizon Setup

Bu dokuman, projeyi yeni bir bilgisayarda minimum adimla calistirmak icindir.

## 1) Onkosullar

- Node.js 20+
- npm 10+
- Azure Functions Core Tools v4 (`func`)

## 2) Repo'yu hazirla

```bash
git clone <repo-url>
cd AVS-Horizon
```

## 3) Frontend env

```bash
cp .env.example .env
```

`.env` icinde en az su alanlari doldur:
- `VITE_AZURE_AD_TENANT_ID`
- `VITE_AZURE_AD_CLIENT_ID`
- `VITE_AZURE_AD_SCOPE`
- `VITE_FUNCTION_API_BASE_URL=http://localhost:7071`
- `VITE_FORCE_FUNCTION_API=true`
- `VITE_DEV_BYPASS_AUTH=true`

## 4) Backend local settings

```bash
cp function-api/local.settings.example.json function-api/local.settings.json
```

`function-api/local.settings.json` icinde DB/Entra degerlerini doldur.
Lokal icin hizli ve sorunsuz yol:
- `SQL_AUTH_MODE=SqlPassword`
- `SQL_USER` / `SQL_PASSWORD` zorunlu

## 5) Tek komutla frontend + backend baslat

Root dizinde:

```bash
npm install
npm run dev:all
```

Bu komut:
- Frontend'i (`vite`) baslatir
- Function API'yi (`function-api` -> `npm start`) baslatir

## 6) Durdurma

Tek komutla acildiginda `Ctrl+C` ile ikisini birlikte durdurabilirsin.

## Sik sorunlar

- `Port 7071 is unavailable`:
```bash
lsof -nP -iTCP:7071 -sTCP:LISTEN
kill -9 <PID>
```

- `Failed to fetch`:
- Function API ayakta mi kontrol et (`http://localhost:7071`)
- `.env` icindeki `VITE_FUNCTION_API_BASE_URL` degeri dogru mu kontrol et

- `Login failed for user '<token-identified principal>'`:
- SQL auth mode'u `SqlPassword` yap
- `SQL_USER` ve `SQL_PASSWORD` gir
