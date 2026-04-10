# External ID Federated Microsoft Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route both login buttons through the External ID tenant, with `Continue with Microsoft` directly targeting the External ID federated Microsoft provider while preserving portal-side authorization.

**Architecture:** Replace the current dual-authority browser auth split with a single External ID MSAL instance. Keep button-specific behavior in request options and provider session state, then update backend classification so External ID-issued tokens can still resolve to either `external_local` or `workforce_federated` portal users.

**Tech Stack:** React, Vite, TypeScript, MSAL Browser/MSAL React, Azure Functions, JWT/JWKS validation, custom Node test runner in `function-api/tests/identity.test.ts`

---

## File Map

**Frontend**
- Modify: `src/auth/authConfig.ts`
  - remove workforce browser authority dependency
  - add External ID Microsoft direct-routing query parsing
  - export separate request objects for local vs Microsoft buttons
- Modify: `src/auth/msalInstance.ts`
  - collapse to a single `PublicClientApplication`
- Modify: `src/auth/providerSession.ts`
  - replace `workforce` provider marker with `external_microsoft`
- Modify: `src/pages/Login.tsx`
  - route both buttons through the same MSAL instance
  - attach Microsoft-only extra query parameters for direct redirect
- Modify: `src/auth/MsalAuthBridge.tsx`
  - remove dual-instance selection logic
  - keep pending/current provider tracking for post-redirect resolution
- Modify: `index.tsx`
  - simplify bootstrap to one `handleRedirectPromise` path

**Backend**
- Modify: `function-api/src/lib/identity.ts`
  - add a helper that derives intended provider type for External ID interactive logins
- Modify: `function-api/src/lib/auth.ts`
  - make External ID issuer validation the primary interactive browser path
  - map External ID-issued tokens to `external_local` or `workforce_federated` based on portal metadata and email rules
  - keep corporate auto-provision working for federated Microsoft users coming through External ID

**Tests**
- Modify: `function-api/tests/identity.test.ts`
  - replace `organizations`-specific frontend assertions
  - add assertions for External ID Microsoft query parsing and provider classification helpers

**Docs / config**
- Modify: `.env.example`
  - remove workforce browser-login envs from the documented primary flow
  - add `VITE_EXTERNAL_ID_MICROSOFT_QUERY`
- Modify: `docs/azure/functionapp-deploy.md`
  - document the External ID direct Microsoft redirect model

---

### Task 1: Lock In Single-Authority Frontend Expectations

**Files:**
- Modify: `function-api/tests/identity.test.ts`
- Test: `function-api/package.json`

- [ ] **Step 1: Add failing source assertions for the new frontend auth model**

Append tests like this to `function-api/tests/identity.test.ts`:

```ts
run('frontend hosted login uses the External ID authority for both buttons', () => {
  const authConfigPath = path.resolve(process.cwd(), '..', 'src', 'auth', 'authConfig.ts');
  const authConfigSource = fs.readFileSync(authConfigPath, 'utf8');

  assert.match(authConfigSource, /export const hostedMsalConfig: Configuration = \{/);
  assert.match(authConfigSource, /export const externalMicrosoftLoginRequest: RedirectRequest = \{/);
  assert.match(authConfigSource, /VITE_EXTERNAL_ID_MICROSOFT_QUERY/);
  assert.doesNotMatch(authConfigSource, /login\.microsoftonline\.com\/organizations/);
});

run('frontend bootstrap no longer ignores authority mismatch between two MSAL instances', () => {
  const indexPath = path.resolve(process.cwd(), '..', 'index.tsx');
  const indexSource = fs.readFileSync(indexPath, 'utf8');

  assert.doesNotMatch(indexSource, /authority_mismatch/);
  assert.match(indexSource, /await msalInstance\.handleRedirectPromise\(\)/);
  assert.doesNotMatch(indexSource, /externalLocalMsalInstance/);
});
```

- [ ] **Step 2: Run backend tests and confirm the new assertions fail**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: FAIL because `src/auth/authConfig.ts` still exports `workforceMsalConfig` and `index.tsx` still contains dual-instance redirect recovery.

- [ ] **Step 3: Commit the failing-spec test update**

```bash
git add function-api/tests/identity.test.ts
git commit -m "test: capture single-authority external id login expectations"
```

---

### Task 2: Refactor Frontend Auth Config To One External ID MSAL Instance

**Files:**
- Modify: `src/auth/authConfig.ts`
- Modify: `src/auth/msalInstance.ts`
- Modify: `index.tsx`
- Test: `function-api/tests/identity.test.ts`
- Test: `package.json`

- [ ] **Step 1: Replace the dual authority config with a single hosted login config**

Update `src/auth/authConfig.ts` so the browser-login config is External ID-centric:

```ts
import { Configuration, RedirectRequest } from '@azure/msal-browser';

const env = import.meta.env;

const externalClientId = env.VITE_EXTERNAL_ID_CLIENT_ID || '';
const externalRedirectUri = env.VITE_EXTERNAL_ID_REDIRECT_URI || window.location.origin;
const externalScopeValue = env.VITE_EXTERNAL_ID_SCOPE || '';

const normalizeExternalBrowserAuthority = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith('.ciamlogin.com')) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const parseQueryParameters = (value: string): Record<string, string> => {
  return value
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [rawKey, ...rest] = part.split('=');
      const key = decodeURIComponent((rawKey || '').trim());
      const nextValue = decodeURIComponent(rest.join('=').trim());
      if (key) acc[key] = nextValue;
      return acc;
    }, {});
};

const externalAuthority = normalizeExternalBrowserAuthority(env.VITE_EXTERNAL_ID_AUTHORITY || '');
const externalAuthorityHost = externalAuthority ? new URL(externalAuthority).host : '';
const configuredExternalScopes = externalScopeValue
  .split(/[ ,]+/)
  .map((scope: string) => scope.trim())
  .filter(Boolean);
const externalApiScopes = configuredExternalScopes.filter((scope: string) => scope.startsWith('api://'));
const microsoftQueryParameters = parseQueryParameters(env.VITE_EXTERNAL_ID_MICROSOFT_QUERY || 'domain_hint=organizations');

export const hostedMsalConfig: Configuration = {
  auth: {
    clientId: externalClientId,
    authority: externalAuthority,
    knownAuthorities: externalAuthorityHost ? [externalAuthorityHost] : [],
    redirectUri: externalRedirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const externalLocalLoginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
  authority: externalAuthority,
};

export const externalMicrosoftLoginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
  authority: externalAuthority,
  extraQueryParameters: microsoftQueryParameters,
};

export const hostedApiTokenRequest: RedirectRequest = {
  scopes: externalApiScopes,
  authority: externalAuthority,
};
```

- [ ] **Step 2: Collapse the MSAL instance module to one instance**

Update `src/auth/msalInstance.ts`:

```ts
import { PublicClientApplication } from '@azure/msal-browser';
import { hostedMsalConfig } from './authConfig';

export const msalInstance = new PublicClientApplication(hostedMsalConfig);
```

- [ ] **Step 3: Simplify root bootstrap to one redirect handler**

Update `index.tsx` to remove the second instance and `authority_mismatch` branch:

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { msalInstance } from './src/auth/msalInstance';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

const bootstrap = async () => {
  await msalInstance.initialize();
  const redirectResult = await msalInstance.handleRedirectPromise();
  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  }

  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
};

void bootstrap();
```

- [ ] **Step 4: Run the backend test suite**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: PASS for the new source assertions around `authConfig.ts` and `index.tsx`.

- [ ] **Step 5: Run the frontend build**

Run:

```bash
npm.cmd run build
```

Expected: PASS with no TypeScript errors in `src/auth/authConfig.ts`, `src/auth/msalInstance.ts`, or `index.tsx`.

- [ ] **Step 6: Commit the auth config refactor**

```bash
git add src/auth/authConfig.ts src/auth/msalInstance.ts index.tsx function-api/tests/identity.test.ts
git commit -m "refactor: use a single external id browser authority"
```

---

### Task 3: Route Both Login Buttons Through The Same External ID Instance

**Files:**
- Modify: `src/auth/providerSession.ts`
- Modify: `src/pages/Login.tsx`
- Modify: `src/auth/MsalAuthBridge.tsx`
- Test: `function-api/tests/identity.test.ts`

- [ ] **Step 1: Add failing assertions for provider routing and button behavior**

Extend `function-api/tests/identity.test.ts` with source assertions:

```ts
run('login page routes microsoft button through the external id instance with direct-routing query params', () => {
  const loginPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'Login.tsx');
  const loginSource = fs.readFileSync(loginPath, 'utf8');

  assert.match(loginSource, /externalMicrosoftLoginRequest/);
  assert.match(loginSource, /await instance\.loginRedirect\(\{/);
  assert.doesNotMatch(loginSource, /setPendingHostedSignInProvider\('workforce'\)/);
});

run('provider session tracks external microsoft separately from local external id', () => {
  const providerSessionPath = path.resolve(process.cwd(), '..', 'src', 'auth', 'providerSession.ts');
  const providerSessionSource = fs.readFileSync(providerSessionPath, 'utf8');

  assert.match(providerSessionSource, /'external_microsoft'/);
  assert.doesNotMatch(providerSessionSource, /'workforce'/);
});
```

- [ ] **Step 2: Run backend tests to confirm failure**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: FAIL because `Login.tsx` still sets pending provider to `workforce` and `providerSession.ts` still contains the old provider union.

- [ ] **Step 3: Update provider session types**

Change `src/auth/providerSession.ts`:

```ts
export type HostedSignInProvider = 'external_local' | 'external_microsoft';

const CURRENT_PROVIDER_KEY = 'avs_auth_current_provider';
const PENDING_PROVIDER_KEY = 'avs_auth_pending_provider';

const canUseStorage = (): boolean => typeof window !== 'undefined';

const readValue = (key: string): HostedSignInProvider | null => {
  if (!canUseStorage()) return null;
  const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
  return value === 'external_local' || value === 'external_microsoft' ? value : null;
};
```

- [ ] **Step 4: Update the login page to use one instance with button-specific requests**

Change the relevant part of `src/pages/Login.tsx`:

```ts
import { externalLocalLoginRequest, externalMicrosoftLoginRequest, isExternalLocalAuthConfigured } from '../auth/authConfig';

const { instance } = useMsal();

const continueWithHostedSignIn = async (mode: 'microsoft' | 'local') => {
  setError('');
  clearAuthFeedback();

  const provider = mode === 'microsoft' ? 'external_microsoft' : 'external_local';
  const request = mode === 'microsoft' ? externalMicrosoftLoginRequest : externalLocalLoginRequest;

  if (!isExternalLocalAuthConfigured) {
    throw new Error('Hosted sign-in is not configured yet. Complete the External ID authority settings first.');
  }

  setPendingHostedSignInProvider(provider);
  await instance.loginRedirect({
    ...request,
    ...(email.trim() ? { loginHint: email.trim() } : {}),
  });
};
```

- [ ] **Step 5: Simplify the auth bridge to one MSAL account source**

Update `src/auth/MsalAuthBridge.tsx` so it reads accounts from `useMsal()` only:

```ts
import { hostedApiTokenRequest } from './authConfig';

const { instance, accounts, inProgress } = useMsal();

const activeAccount = instance.getActiveAccount() || accounts[0] || null;
if (!activeAccount) {
  processedAccountRef.current = null;
  clearPendingHostedSignInProvider();
  clearCurrentHostedSignInProvider();
  clearAuthFeedback();
  return;
}

const selectedProvider =
  getPendingHostedSignInProvider() ||
  getCurrentHostedSignInProvider() ||
  'external_local';

const tokenResult = await instance.acquireTokenSilent({
  ...hostedApiTokenRequest,
  account: activeAccount,
});
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: PASS for the new source assertions in `Login.tsx` and `providerSession.ts`.

- [ ] **Step 7: Run the frontend build**

Run:

```bash
npm.cmd run build
```

Expected: PASS with no unresolved imports or stale `externalLocalMsalInstance` references.

- [ ] **Step 8: Commit the login flow refactor**

```bash
git add src/auth/providerSession.ts src/pages/Login.tsx src/auth/MsalAuthBridge.tsx function-api/tests/identity.test.ts
git commit -m "refactor: route both login buttons through external id"
```

---

### Task 4: Reclassify External ID Tokens For Corporate And Local Users

**Files:**
- Modify: `function-api/src/lib/identity.ts`
- Modify: `function-api/src/lib/auth.ts`
- Modify: `function-api/tests/identity.test.ts`

- [ ] **Step 1: Add failing tests for External ID provider classification**

Append tests like this to `function-api/tests/identity.test.ts`:

```ts
import { resolveInteractiveIdentityProviderType } from '../src/lib/identity';

run('resolveInteractiveIdentityProviderType prefers stored portal metadata', () => {
  assert.equal(
    resolveInteractiveIdentityProviderType({
      email: 'user@customercorp.com',
      storedProviderType: 'workforce_federated',
      provisioningSource: 'corporate_precreated',
    }),
    'workforce_federated'
  );
});

run('resolveInteractiveIdentityProviderType falls back to personal-domain detection for external id tokens', () => {
  assert.equal(
    resolveInteractiveIdentityProviderType({
      email: 'user@gmail.com',
      storedProviderType: null,
      provisioningSource: null,
    }),
    'external_local'
  );
  assert.equal(
    resolveInteractiveIdentityProviderType({
      email: 'user@customercorp.com',
      storedProviderType: null,
      provisioningSource: null,
    }),
    'workforce_federated'
  );
});
```

Also add a source assertion that the backend treats External ID issuer validation as the interactive path:

```ts
run('auth provider config includes external id issuer validation for browser logins', () => {
  const authPath = path.resolve(process.cwd(), 'src', 'lib', 'auth.ts');
  const authSource = fs.readFileSync(authPath, 'utf8');

  assert.match(authSource, /providerType:\s*'external_local'/);
  assert.match(authSource, /resolveInteractiveIdentityProviderType/);
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: FAIL because `resolveInteractiveIdentityProviderType` does not exist yet and `auth.ts` still routes corporate browser users through `workforce_federated` issuer matching.

- [ ] **Step 3: Add a provider classification helper in `identity.ts`**

Add this helper to `function-api/src/lib/identity.ts`:

```ts
export const resolveInteractiveIdentityProviderType = (params: {
  email: string;
  storedProviderType?: IdentityProviderType | null;
  provisioningSource?: ProvisioningSource | null;
}): IdentityProviderType => {
  if (params.storedProviderType) return params.storedProviderType;
  if (params.provisioningSource) {
    return getIdentityProviderTypeForProvisioningSource(params.provisioningSource);
  }
  return isPersonalEmailDomain(params.email) ? 'external_local' : 'workforce_federated';
};
```

- [ ] **Step 4: Rework token provider config and auth resolution**

Update `function-api/src/lib/auth.ts` so External ID is the primary interactive provider family:

```ts
const getTokenProviderConfigs = (): TokenProviderConfig[] => {
  const providers: TokenProviderConfig[] = [];

  if (env.externalIdAudience && env.externalIdJwksUri && env.externalIdIssuers.length > 0) {
    providers.push({
      providerType: 'external_local',
      audiences: buildAcceptedAudiences(env.externalIdAudience, env.externalIdClientId),
      jwksUri: env.externalIdJwksUri,
      issuers: env.externalIdIssuers,
      tenantId: env.externalIdTenantId || null,
    });
  }

  if (env.azureAudience && env.azureClientId) {
    providers.push({
      providerType: 'workforce_federated',
      audiences: buildAcceptedAudiences(env.azureAudience, env.azureClientId),
      jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      issuerMatcher: isMicrosoftWorkforceIssuer,
    });
  }

  return providers;
};
```

Then update request authentication so External ID-issued tokens can still map to corporate users:

```ts
const validatedToken = await getTokenClaims(token);
const email = getClaimEmail(validatedToken.claims);
const entraObjectId = getClaimObjectId(validatedToken.claims);
const identityTenantId = validatedToken.tenantId;

let user = entraObjectId ? await getUserByEntraObjectId(entraObjectId) : null;
if (!user) {
  user = await getUserByEmail(email);
}

const resolvedProviderType = resolveInteractiveIdentityProviderType({
  email,
  storedProviderType: user?.identityProviderType || null,
  provisioningSource: user?.provisioningSource || null,
});
```

Use `resolvedProviderType` instead of `validatedToken.providerType` in:

- `getCorporateIdentityConflict`
- `syncIdentityLink`
- corporate auto-provision gating

Specifically keep auto-provision working for corporate External ID-federated users:

```ts
if (!user && resolvedProviderType === 'workforce_federated') {
  user = await autoProvisionByPolicy({
    email,
    entraObjectId,
    identityTenantId,
    displayName: typeof validatedToken.claims.name === 'string' ? validatedToken.claims.name : null,
  });
}
```

- [ ] **Step 5: Run the backend tests**

Run:

```bash
cd function-api
npm.cmd test
```

Expected: PASS, including the new helper tests and existing audience/issuer tests.

- [ ] **Step 6: Commit the backend classification changes**

```bash
git add function-api/src/lib/identity.ts function-api/src/lib/auth.ts function-api/tests/identity.test.ts
git commit -m "refactor: classify external id browser logins by portal identity rules"
```

---

### Task 5: Update Environment Examples And Deployment Guidance

**Files:**
- Modify: `.env.example`
- Modify: `docs/azure/functionapp-deploy.md`
- Test: `package.json`

- [ ] **Step 1: Update the frontend env example for the new hosted-login model**

Change `.env.example` to document External ID-first login:

```env
# External ID hosted login for both buttons
VITE_EXTERNAL_ID_AUTHORITY=https://<tenant-name>.ciamlogin.com
VITE_EXTERNAL_ID_CLIENT_ID=your-external-id-spa-client-id
VITE_EXTERNAL_ID_REDIRECT_URI=http://localhost:5173/
VITE_EXTERNAL_ID_SCOPE=openid profile email offline_access api://<your-api-client-id>/access_as_user
VITE_EXTERNAL_ID_MICROSOFT_QUERY=domain_hint=organizations

# Function API integration
VITE_FUNCTION_API_BASE_URL=http://localhost:7071
VITE_FORCE_FUNCTION_API=true
VITE_DEV_BYPASS_AUTH=true
```

Remove the top-of-file workforce-browser example block so the documented primary path matches the implemented architecture.

- [ ] **Step 2: Update deployment docs**

Replace the workforce-browser guidance in `docs/azure/functionapp-deploy.md` with a short External ID direct-Microsoft section:

```md
### External ID Direct Microsoft Login

- Keep both login buttons on the External ID SPA app registration
- Set `VITE_EXTERNAL_ID_AUTHORITY` to the CIAM host root, for example `https://<tenant-name>.ciamlogin.com`
- Set `VITE_EXTERNAL_ID_MICROSOFT_QUERY=domain_hint=organizations` to send `Continue with Microsoft` directly to the federated Microsoft provider
- Keep `VITE_EXTERNAL_ID_SCOPE` pointed at the External ID API app scope
- Do not use `login.microsoftonline.com/organizations` for the browser sign-in flow in this model
```

- [ ] **Step 3: Run the frontend build**

Run:

```bash
npm.cmd run build
```

Expected: PASS, confirming the docs/config edits did not leave stale references in imported code.

- [ ] **Step 4: Commit the docs and env updates**

```bash
git add .env.example docs/azure/functionapp-deploy.md
git commit -m "docs: describe external id direct microsoft login setup"
```

---

## Self-Review

### Spec coverage

- Single External ID browser authority: covered by Tasks 1 and 2
- Microsoft button direct redirect via configurable query params: covered by Tasks 2 and 3
- One MSAL instance and no authority mismatch workaround: covered by Tasks 1, 2, and 3
- Backend recognition of corporate users from External ID-issued tokens: covered by Task 4
- Updated setup guidance: covered by Task 5

### Placeholder scan

- No `TODO` / `TBD`
- Every task lists exact files and commands
- Code-bearing steps include concrete snippets rather than “implement later” wording

### Type consistency

- Hosted provider state uses `external_local` and `external_microsoft`
- Frontend request objects are `externalLocalLoginRequest`, `externalMicrosoftLoginRequest`, and `hostedApiTokenRequest`
- Backend provider helper is `resolveInteractiveIdentityProviderType`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-10-external-id-federated-microsoft-login.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
