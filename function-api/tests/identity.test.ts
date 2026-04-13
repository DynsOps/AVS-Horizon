import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAcceptedAudiences,
  getCorporateIdentityConflict,
  isMicrosoftWorkforceIssuer,
} from '../src/lib/auth';
import {
  buildSessionContextPrefix,
  deriveAccessState,
  isPersonalEmailDomain,
  normalizeDomain,
  normalizeEmail,
} from '../src/lib/identity';

const run = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
};

run('normalizeEmail trims and lowercases values', () => {
  assert.equal(normalizeEmail('  MUHARREM@Arkas.COM.TR '), 'muharrem@arkas.com.tr');
});

run('normalizeDomain removes @ and lowercases values', () => {
  assert.equal(normalizeDomain('@Arkas.COM.TR'), 'arkas.com.tr');
});

run('isPersonalEmailDomain flags common personal providers', () => {
  assert.equal(isPersonalEmailDomain('user@gmail.com'), true);
  assert.equal(isPersonalEmailDomain('user@arkas.com.tr'), false);
});

run('deriveAccessState keeps invited users invited until identity is linked', () => {
  assert.equal(
    deriveAccessState({
      provisioningSource: 'invited_personal',
      permissions: ['view:dashboard'],
      hasLinkedIdentity: false,
    }),
    'invited'
  );
});

run('deriveAccessState keeps external local accounts invited until identity is linked', () => {
  assert.equal(
    deriveAccessState({
      provisioningSource: 'external_local_account',
      permissions: ['view:dashboard'],
      hasLinkedIdentity: false,
    }),
    'invited'
  );
});

run('deriveAccessState marks linked users with permissions as active', () => {
  assert.equal(
    deriveAccessState({
      provisioningSource: 'corporate_precreated',
      permissions: ['view:dashboard'],
      hasLinkedIdentity: true,
    }),
    'active'
  );
});

run('deriveAccessState marks zero-permission users as pending', () => {
  assert.equal(
    deriveAccessState({
      provisioningSource: 'auto_domain',
      permissions: [],
      hasLinkedIdentity: true,
    }),
    'pending'
  );
});

run('buildSessionContextPrefix stamps role and company into SQL session context', () => {
  const sql = buildSessionContextPrefix({
    role: 'admin',
    companyId: 'C-001',
    userId: 'u-123',
    internalBypass: true,
  });

  assert.match(sql, /app\.role/);
  assert.match(sql, /app\.company_id/);
  assert.match(sql, /app\.user_id/);
  assert.match(sql, /app\.internal_bypass/);
  assert.match(sql, /sp_set_session_context/);
});

run('RLS migration drops the policy before altering scoped functions', () => {
  const migrationPath = path.resolve(process.cwd(), '..', 'sql', '007_enforce_company_rls.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  const dropPolicyIndex = migrationSql.indexOf('DROP SECURITY POLICY security.CompanyIsolationPolicy;');
  const companyFnIndex = migrationSql.indexOf('CREATE OR ALTER FUNCTION security.fn_company_scope');
  const userFnIndex = migrationSql.indexOf('CREATE OR ALTER FUNCTION security.fn_user_scope');

  assert.notEqual(dropPolicyIndex, -1);
  assert.notEqual(companyFnIndex, -1);
  assert.notEqual(userFnIndex, -1);
  assert.ok(dropPolicyIndex < companyFnIndex);
  assert.ok(dropPolicyIndex < userFnIndex);
});

run('admin companies query orders aggregated rows by an aggregated created timestamp', () => {
  const functionPath = path.resolve(process.cwd(), 'src', 'functions', 'adminCompaniesList.ts');
  const functionSource = fs.readFileSync(functionPath, 'utf8');

  assert.match(functionSource, /MAX\(c\.created_at\)\s+AS\s+latestCreatedAt/);
  assert.match(functionSource, /ORDER BY latestCreatedAt DESC/);
});

run('hybrid identity migration allows external_local_account provisioning values', () => {
  const migrationPath = path.resolve(process.cwd(), '..', 'sql', '008_add_identity_provider_metadata.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migrationSql, /external_local_account/);
  assert.match(migrationSql, /identity_provider_type/);
});

run('buildAcceptedAudiences accepts both GUID and api:// audiences for Entra app tokens', () => {
  assert.deepEqual(buildAcceptedAudiences('af1c899c-c57a-434f-9822-5d91035b20e2'), [
    'af1c899c-c57a-434f-9822-5d91035b20e2',
    'api://af1c899c-c57a-434f-9822-5d91035b20e2',
  ]);
  assert.deepEqual(buildAcceptedAudiences('api://af1c899c-c57a-434f-9822-5d91035b20e2'), [
    'api://af1c899c-c57a-434f-9822-5d91035b20e2',
    'af1c899c-c57a-434f-9822-5d91035b20e2',
  ]);
});

run('frontend unified external id config does not require a workforce client id', () => {
  const authConfigPath = path.resolve(process.cwd(), '..', 'src', 'auth', 'authConfig.ts');
  const authConfigSource = fs.readFileSync(authConfigPath, 'utf8');

  assert.match(authConfigSource, /export const externalMsalConfig: Configuration = \{/);
  assert.doesNotMatch(authConfigSource, /export const workforceMsalConfig: Configuration = \{/);
  assert.doesNotMatch(authConfigSource, /VITE_AZURE_AD_CLIENT_ID/);
});

run('external local and federated microsoft login start with identity scopes and request API scope later', () => {
  const authConfigPath = path.resolve(process.cwd(), '..', 'src', 'auth', 'authConfig.ts');
  const authConfigSource = fs.readFileSync(authConfigPath, 'utf8');

  assert.match(authConfigSource, /export const externalLocalLoginRequest: RedirectRequest = \{[\s\S]*scopes: \['openid', 'profile', 'email'\]/);
  assert.match(authConfigSource, /export const federatedMicrosoftLoginRequest: RedirectRequest = \{[\s\S]*scopes: \['openid', 'profile', 'email'\]/);
  assert.match(authConfigSource, /export const externalApiTokenRequest: RedirectRequest = \{[\s\S]*scopes: externalApiScopes,/);
});

run('frontend keeps provider intent while routing both login buttons through the same msal instance', () => {
  const loginPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'Login.tsx');
  const loginSource = fs.readFileSync(loginPath, 'utf8');
  const bridgePath = path.resolve(process.cwd(), '..', 'src', 'auth', 'MsalAuthBridge.tsx');
  const bridgeSource = fs.readFileSync(bridgePath, 'utf8');

  assert.match(loginSource, /setPendingHostedSignInProvider\('external_local'\)/);
  assert.match(loginSource, /setPendingHostedSignInProvider\('microsoft_federated'\)/);
  assert.doesNotMatch(loginSource, /externalLocalMsalInstance/);
  assert.match(bridgeSource, /const resolveProvider = \(\): HostedSignInProvider \| null => \{/);
  assert.match(bridgeSource, /return 'external_local';/);
});

run('frontend bootstrap keeps the app renderable when redirect handling fails', () => {
  const indexPath = path.resolve(process.cwd(), '..', 'index.tsx');
  const indexSource = fs.readFileSync(indexPath, 'utf8');

  assert.match(indexSource, /useAuthStore\.getState\(\)\.setAuthError/);
  assert.match(indexSource, /clearHostedSignInProviderState\(\)/);
  assert.match(indexSource, /finally\s*\{/);
});

run('isMicrosoftWorkforceIssuer accepts multitenant Microsoft issuers only', () => {
  assert.equal(isMicrosoftWorkforceIssuer('https://login.microsoftonline.com/c34a6030-b1b7-44bf-b80e-fee46e464e73/v2.0'), true);
  assert.equal(isMicrosoftWorkforceIssuer('https://sts.windows.net/c34a6030-b1b7-44bf-b80e-fee46e464e73/'), true);
  assert.equal(
    isMicrosoftWorkforceIssuer(
      'https://c34a6030-b1b7-44bf-b80e-fee46e464e73.ciamlogin.com/c34a6030-b1b7-44bf-b80e-fee46e464e73/v2.0'
    ),
    false
  );
});

run('corporate identity binding rejects mismatched object ids before email fallback can link the wrong user', () => {
  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: 'old-oid',
        identityProviderType: 'workforce_federated',
        identityTenantId: 'tenant-a',
      },
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: 'new-oid',
        providerType: 'workforce_federated',
        identityTenantId: 'tenant-a',
      }
    ),
    'Microsoft account identity mismatch for muharrem.baylan@365technology.net.'
  );
});

run('corporate identity binding rejects mismatched tenant ids and allows first successful link', () => {
  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'user@customercorp.com',
        entraObjectId: null,
        identityProviderType: 'workforce_federated',
        identityTenantId: 'tenant-a',
      },
      {
        email: 'user@customercorp.com',
        entraObjectId: 'oid-1',
        providerType: 'workforce_federated',
        identityTenantId: 'tenant-b',
      }
    ),
    'Microsoft account tenant mismatch for user@customercorp.com.'
  );

  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'user@customercorp.com',
        entraObjectId: null,
        identityProviderType: 'workforce_federated',
        identityTenantId: null,
      },
      {
        email: 'user@customercorp.com',
        entraObjectId: 'oid-1',
        providerType: 'workforce_federated',
        identityTenantId: 'tenant-a',
      }
    ),
    null
  );
});
