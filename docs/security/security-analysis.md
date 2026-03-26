# Security Analysis (System + App)

Date: 2026-03-26

## Current high-risk areas identified
1. Auth and authorization currently run in frontend code.
2. Role/permission checks are enforced in UI and API mock layer, but no server-side trust boundary exists yet.
3. Local DB is browser storage for development; it is not a secure credential store.

## Mitigations implemented in this phase
- Microsoft login flow upgraded to real Microsoft OAuth redirect (Authorization Code + PKCE).
- OAuth callback state validation added (`state` + `code_verifier` handling).
- Permission model hardened:
  - strict role matching (no implicit role hierarchy bypass on route guards)
  - admin/supadmin route separation fixed
  - role-default permission matrix corrected
- Active permission behavior verified against menu + route restrictions.

## Remaining risks before production
- Client-side auth/session must be backed by trusted server-side token validation.
- Sensitive operations (user management, permission writes, password resets) must move behind backend authorization checks.
- Browser local storage should not hold production secrets.

## Recommended target architecture
- Static Web App (frontend)
- Azure Function App (backend API + token validation)
- Entra ID (Microsoft identity provider)
- Azure SQL (authoritative data)

## Immediate next backend hardening tasks
1. Function App endpoint `/api/auth/me` validates Entra token and maps user by email/object id.
2. Function App endpoints enforce RBAC server-side for all mutations.
3. Move data access from frontend local DB to Azure SQL via backend only.
4. Add request logging + correlation id for security events.
