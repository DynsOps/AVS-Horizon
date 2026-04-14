import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAcceptedAudiences, getCorporateIdentityConflict } from '../src/lib/auth';
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
      provisioningSource: 'external_local_account',
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

run('buildAcceptedAudiences accepts both GUID and api:// audiences for External ID app tokens', () => {
  assert.deepEqual(buildAcceptedAudiences('af1c899c-c57a-434f-9822-5d91035b20e2'), [
    'af1c899c-c57a-434f-9822-5d91035b20e2',
    'api://af1c899c-c57a-434f-9822-5d91035b20e2',
  ]);
  assert.deepEqual(buildAcceptedAudiences('api://af1c899c-c57a-434f-9822-5d91035b20e2'), [
    'api://af1c899c-c57a-434f-9822-5d91035b20e2',
    'af1c899c-c57a-434f-9822-5d91035b20e2',
  ]);
});

run('frontend keeps only external id MSAL config', () => {
  const authConfigPath = path.resolve(process.cwd(), '..', 'src', 'auth', 'authConfig.ts');
  const authConfigSource = fs.readFileSync(authConfigPath, 'utf8');

  assert.match(authConfigSource, /export const externalMsalConfig: Configuration = \{/);
  assert.doesNotMatch(authConfigSource, /workforceMsalConfig/);
  assert.doesNotMatch(authConfigSource, /VITE_AZURE_AD_CLIENT_ID/);
});

run('login page routes hosted sign-in through the external msal instance only', () => {
  const loginPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'Login.tsx');
  const loginSource = fs.readFileSync(loginPath, 'utf8');

  assert.match(loginSource, /externalMsalInstance\.loginRedirect/);
  assert.doesNotMatch(loginSource, /Continue with Microsoft/);
  assert.doesNotMatch(loginSource, /workforceMsalInstance/);
});

run('external auth bridge exchanges only external id tokens', () => {
  const bridgePath = path.resolve(process.cwd(), '..', 'src', 'auth', 'MsalAuthBridge.tsx');
  const bridgeSource = fs.readFileSync(bridgePath, 'utf8');

  assert.match(bridgeSource, /externalMsalInstance\.acquireTokenSilent/);
  assert.match(bridgeSource, /provider: 'external_local'/);
  assert.doesNotMatch(bridgeSource, /microsoft_federated/);
});

run('frontend bootstrap initializes only external msal and clears legacy provider keys', () => {
  const indexPath = path.resolve(process.cwd(), '..', 'index.tsx');
  const indexSource = fs.readFileSync(indexPath, 'utf8');

  assert.match(indexSource, /cleanupLegacyAuthStorage/);
  assert.match(indexSource, /avs_auth_current_provider/);
  assert.match(indexSource, /avs_auth_pending_provider/);
  assert.doesNotMatch(indexSource, /workforceMsalInstance/);
});

run('backend token validation accepts only external id providers', () => {
  const authPath = path.resolve(process.cwd(), 'src', 'lib', 'auth.ts');
  const authSource = fs.readFileSync(authPath, 'utf8');

  assert.match(authSource, /External ID token validation is not configured\./);
  assert.match(authSource, /providerType: 'external_local'/);
  assert.doesNotMatch(authSource, /providerType: 'workforce_federated'/);
  assert.doesNotMatch(authSource, /login\.microsoftonline\.com\/common\/discovery\/v2\.0\/keys/);
});

run('admin user delete removes linked External ID users before deleting the portal record', () => {
  const deletePath = path.resolve(process.cwd(), 'src', 'functions', 'adminUsersDelete.ts');
  const deleteSource = fs.readFileSync(deletePath, 'utf8');

  assert.match(deleteSource, /deleteExternalIdentityUser/);
  assert.match(deleteSource, /entra_object_id AS entraObjectId/);
  assert.match(deleteSource, /identity_provider_type AS identityProviderType/);
  assert.match(deleteSource, /target\.entraObjectId && target\.identityProviderType === 'external_local'/);
});

run('identity binding allows same email to sign in with a different legacy provider', () => {
  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: null,
        identityProviderType: 'workforce_federated',
        identityTenantId: null,
      },
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: 'oid-1',
        providerType: 'external_local',
        identityTenantId: 'tenant-a',
      }
    ),
    null
  );
});

run('identity binding rejects mismatched object ids inside the same provider', () => {
  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: 'old-oid',
        identityProviderType: 'external_local',
        identityTenantId: 'tenant-a',
      },
      {
        email: 'muharrem.baylan@365technology.net',
        entraObjectId: 'new-oid',
        providerType: 'external_local',
        identityTenantId: 'tenant-a',
      }
    ),
    'Identity mismatch for muharrem.baylan@365technology.net.'
  );
});

run('identity binding rejects mismatched tenant ids inside the same provider', () => {
  assert.equal(
    getCorporateIdentityConflict(
      {
        email: 'user@customercorp.com',
        entraObjectId: 'oid-1',
        identityProviderType: 'external_local',
        identityTenantId: 'tenant-a',
      },
      {
        email: 'user@customercorp.com',
        entraObjectId: 'oid-1',
        providerType: 'external_local',
        identityTenantId: 'tenant-b',
      }
    ),
    'Tenant mismatch for user@customercorp.com.'
  );
});

run('user management defines a restricted company admin actor flow', () => {
  const userManagementPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'admin', 'UserManagement.tsx');
  const userManagementSource = fs.readFileSync(userManagementPath, 'utf8');

  assert.match(userManagementSource, /const isRestrictedCompanyAdminActor = actor\?\.role === 'admin' && !Boolean\(actor\?\.showOnlyCoreAdminPermissions\);/);
  assert.match(userManagementSource, /const COMPANY_ADMIN_HIDDEN_PERMISSIONS: Permission\[] = \['manage:users', 'manage:companies'\];/);
  assert.doesNotMatch(userManagementSource, /New users are created as External ID local accounts\. Legacy provisioning values remain visible for older users\./);
});

run('mock api normalizes company admin user management into same-company non-guest users', () => {
  const apiPath = path.resolve(process.cwd(), '..', 'src', 'services', 'api.ts');
  const apiSource = fs.readFileSync(apiPath, 'utf8');

  assert.match(apiSource, /const COMPANY_ADMIN_HIDDEN_PERMISSIONS: Permission\[] = \['manage:users', 'manage:companies'\];/);
  assert.match(apiSource, /const COMPANY_ADMIN_BASE_PERMISSIONS: Permission\[] = \['view:dashboard', 'view:reports', 'create:support-ticket'\];/);
  assert.match(apiSource, /const normalizeAdminManagedUserInput = <T extends Pick<User, 'role' \| 'companyId' \| 'isGuest' \| 'permissions' \| 'provisioningSource'>>/);
  assert.match(apiSource, /throw new Error\('Admin can only manage standard user accounts\.'\);/);
});

run('admin user create function restricts admin actors to canonical user permissions', () => {
  const createPath = path.resolve(process.cwd(), 'src', 'functions', 'adminUsersCreate.ts');
  const createSource = fs.readFileSync(createPath, 'utf8');

  assert.match(createSource, /const COMPANY_ADMIN_BASE_PERMISSIONS = new Set\(\['view:dashboard', 'view:reports', 'create:support-ticket'\]\);/);
  assert.match(createSource, /const getCompanyAdminAllowedPermissions = \(actorPermissions: string\[\]\): Set<string> => \{/);
  assert.match(createSource, /const normalizedRole: UserRole = isAdminActor \? 'user' : role;/);
  assert.match(createSource, /Admin can only grant user-role permissions\./);
});

run('admin user update function blocks company admins from managing admin targets', () => {
  const updatePath = path.resolve(process.cwd(), 'src', 'functions', 'adminUsersUpdate.ts');
  const updateSource = fs.readFileSync(updatePath, 'utf8');

  assert.match(updateSource, /const COMPANY_ADMIN_BASE_PERMISSIONS = new Set\(\['view:dashboard', 'view:reports', 'create:support-ticket'\]\);/);
  assert.match(updateSource, /const getCompanyAdminAllowedPermissions = \(actorPermissions: string\[\]\): Set<string> => \{/);
  assert.match(updateSource, /return errorResponse\(403, 'Admin can only manage standard user accounts\.'\);/);
  assert.match(updateSource, /const normalizedRole: UserRole = isAdminActor \? 'user' : nextRole;/);
});

run('company admin user form shows only the minimal general permissions and actor-owned BI report permissions', () => {
  const userManagementPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'admin', 'UserManagement.tsx');
  const userManagementSource = fs.readFileSync(userManagementPath, 'utf8');

  assert.match(userManagementSource, /const COMPANY_ADMIN_BASE_PERMISSIONS: Permission\[] = \['view:dashboard', 'view:reports', 'create:support-ticket'\];/);
  assert.match(userManagementSource, /if \(isCompanyAdminActor\) return COMPANY_ADMIN_BASE_PERMISSIONS.includes\(permission\);/);
  assert.match(userManagementSource, /if \(isCompanyAdminActor\) return actorPermissions.includes\(entry.permission\);/);
});

run('company admin edit form keeps only the target users currently selected visible permissions', () => {
  const userManagementPath = path.resolve(process.cwd(), '..', 'src', 'pages', 'admin', 'UserManagement.tsx');
  const userManagementSource = fs.readFileSync(userManagementPath, 'utf8');

  assert.match(userManagementSource, /const visibleSelectedPermissions = \(formUser\?\.permissions \|\| \[\]\)\.filter\(\(permission\): permission is Permission => isCompanyAdminManageablePermission\(permission\)\);/);
  assert.match(userManagementSource, /return typeof formUser\?\.id === 'string' \? visibleSelectedPermissions : \[\.\.\.COMPANY_ADMIN_BASE_PERMISSIONS\];/);
});

run('mail library defines an english welcome email helper with a login link', () => {
  const mailPath = path.resolve(process.cwd(), 'src', 'lib', 'mail.ts');
  const mailSource = fs.readFileSync(mailPath, 'utf8');

  assert.match(mailSource, /export const sendWelcomeCredentialsEmail = async/);
  assert.match(mailSource, /Welcome to AVS Horizon/);
  assert.match(mailSource, /Sign in to AVS Horizon/);
  assert.match(mailSource, /env\.mailLoginUrl/);
  assert.doesNotMatch(mailSource, /Gecici Giris Bilgileri/);
  assert.match(mailSource, /\/users\/\$\{encodeURIComponent\(env\.mailSender\)\}\/sendMail/);
});

run('admin user create keeps the db flow even if welcome mail fails', () => {
  const createPath = path.resolve(process.cwd(), 'src', 'functions', 'adminUsersCreate.ts');
  const createSource = fs.readFileSync(createPath, 'utf8');

  assert.match(createSource, /sendWelcomeCredentialsEmail/);
  assert.match(createSource, /let welcomeEmailStatus: \{ sent: boolean; error\?: string \} \| null = null;/);
  assert.match(createSource, /context\.info\('admin\/users create welcome email sending'/);
  assert.match(createSource, /context\.info\('admin\/users create welcome email sent'/);
  assert.match(createSource, /await sendWelcomeCredentialsEmail\(\{/);
  assert.match(createSource, /context\.warn\('admin\/users create welcome email failed'/);
  assert.match(createSource, /notifications: welcomeEmailStatus \? \{ welcomeEmail: welcomeEmailStatus \} : undefined,/);
  assert.match(createSource, /temporaryPassword: externalAccount\.temporaryPassword/);
});

run('function api env declares dedicated mail sender settings', () => {
  const envPath = path.resolve(process.cwd(), 'src', 'lib', 'env.ts');
  const envSource = fs.readFileSync(envPath, 'utf8');
  const settingsPath = path.resolve(process.cwd(), 'local.settings.example.json');
  const settingsSource = fs.readFileSync(settingsPath, 'utf8');

  assert.match(envSource, /mailTenantId: process\.env\.MAIL_TENANT_ID \|\| process\.env\.EXTERNAL_ID_TENANT_ID \|\| ''/);
  assert.match(envSource, /mailClientId: process\.env\.MAIL_CLIENT_ID \|\| process\.env\.EXTERNAL_ID_CLIENT_ID \|\| ''/);
  assert.match(envSource, /mailClientSecret: process\.env\.MAIL_CLIENT_SECRET \|\| process\.env\.EXTERNAL_ID_CLIENT_SECRET \|\| ''/);
  assert.match(envSource, /mailSender: process\.env\.MAIL_SENDER \|\| process\.env\.EXTERNAL_ID_MAIL_SENDER \|\| ''/);
  assert.match(envSource, /mailLoginUrl: process\.env\.MAIL_LOGIN_URL \|\| ''/);
  assert.match(envSource, /export const assertMailEnv = \(\): void => \{/);
  assert.match(settingsSource, /MAIL_TENANT_ID/);
  assert.match(settingsSource, /MAIL_CLIENT_ID/);
  assert.match(settingsSource, /MAIL_CLIENT_SECRET/);
  assert.match(settingsSource, /MAIL_SENDER/);
  assert.match(settingsSource, /MAIL_LOGIN_URL/);
});
