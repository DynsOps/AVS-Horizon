import { HttpRequest } from '@azure/functions';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { randomUUID } from 'crypto';
import { env, assertEnv } from './env';
import { runQuery } from './db';

type DbUserRow = {
  id: string;
  name: string;
  email: string;
  role: 'supadmin' | 'admin' | 'user';
  isGuest: boolean;
  showOnlyCoreAdminPermissions: boolean;
  companyId: string | null;
  status: 'Active' | 'Inactive' | 'Suspended';
  powerBiAccess: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId: string | null;
  powerBiReportId: string | null;
  lastLogin: string | null;
};

export type AuthUser = DbUserRow & {
  permissions: string[];
};

const BOOTSTRAP_SUPADMIN_EMAILS = ['dynamicsops14@avsglobalsupply.com'];
const LOWEST_AUTO_PERMISSIONS = ['view:dashboard'];
const SUPADMIN_DEFAULT_PERMISSIONS = [
  'view:dashboard',
  'view:operational-list',
  'view:invoices',
  'view:port-fees',
  'view:reports',
  'view:fleet',
  'view:shipments',
  'view:orders',
  'view:supplier',
  'create:support-ticket',
  'submit:rfq',
  'manage:users',
  'manage:companies',
  'view:finance',
  'edit:orders',
  'view:analytics',
  'system:settings',
];

let cachedJwksClient: JwksClient | null = null;

const getJwksClient = (): JwksClient => {
  if (cachedJwksClient) return cachedJwksClient;
  cachedJwksClient = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${env.azureTenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    cacheMaxEntries: 10,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
  return cachedJwksClient;
};

const getBearerToken = (request: HttpRequest): string | null => {
  const raw = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  return raw.slice(7).trim();
};

const getTokenClaims = async (token: string): Promise<JwtPayload> => {
  assertEnv();
  const acceptedIssuers: [string, ...string[]] = [
    `https://login.microsoftonline.com/${env.azureTenantId}/v2.0`,
    `https://sts.windows.net/${env.azureTenantId}/`,
  ];
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? (decoded.header as { kid?: string }).kid : undefined;
  if (!kid) throw new Error('Invalid token: missing key id.');
  const signingKey = await getJwksClient().getSigningKey(kid);
  const publicKey = signingKey.getPublicKey();

  return await new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        algorithms: ['RS256'],
        audience: env.azureAudience,
      },
      (error, payload) => {
        if (error) {
          reject(error);
          return;
        }
        if (!payload || typeof payload === 'string') {
          reject(new Error('Invalid token payload.'));
          return;
        }
        if (!acceptedIssuers.includes(payload.iss || '')) {
          reject(new Error(`Invalid token issuer: ${payload.iss || 'unknown'}`));
          return;
        }
        resolve(payload);
      }
    );
  });
};

const normalizeExtEmail = (value: string): string => {
  const candidate = value.trim().toLowerCase();
  const extMarker = '#ext#@';
  const markerIndex = candidate.indexOf(extMarker);
  if (markerIndex === -1) return candidate;

  const left = candidate.slice(0, markerIndex);
  const splitIndex = left.lastIndexOf('_');
  if (splitIndex === -1) return candidate;

  const localPart = left.slice(0, splitIndex);
  const domainPart = left.slice(splitIndex + 1);
  if (!localPart || !domainPart || domainPart.includes('@')) return candidate;

  return `${localPart}@${domainPart}`;
};

const getClaimEmail = (claims: JwtPayload): string | null => {
  const orderedCandidates = [claims.email, claims.preferred_username, claims.upn, claims.unique_name];
  for (const raw of orderedCandidates) {
    if (typeof raw !== 'string') continue;
    const normalized = normalizeExtEmail(raw);
    if (normalized.includes('@')) return normalized;
  }
  return null;
};

const getUserByEmail = async (email: string): Promise<AuthUser | null> => {
  const userResult = await runQuery<DbUserRow>(
    `
    SELECT TOP 1
      id,
      display_name AS name,
      email,
      role,
      is_guest AS isGuest,
      show_only_core_admin_permissions AS showOnlyCoreAdminPermissions,
      company_id AS companyId,
      status,
      power_bi_access AS powerBiAccess,
      power_bi_workspace_id AS powerBiWorkspaceId,
      power_bi_report_id AS powerBiReportId,
      CONVERT(varchar(33), last_login_at, 127) AS lastLogin
    FROM dbo.users
    WHERE LOWER(email) = @email
    `,
    { email: email.toLowerCase() }
  );

  const row = userResult.recordset[0];
  if (!row || row.status !== 'Active') return null;

  const permissionsResult = await runQuery<{ permission: string }>(
    'SELECT permission FROM dbo.user_permissions WHERE user_id = @userId',
    { userId: row.id }
  );

  const permissions = permissionsResult.recordset.map((p) => p.permission);

  return {
    ...row,
    permissions,
  };
};

const getEmailDomain = (email: string): string => {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
};

const createUserWithPermissions = async (params: {
  email: string;
  role: 'supadmin' | 'admin' | 'user';
  permissions: string[];
  companyId?: string | null;
}): Promise<void> => {
  const userId = `u-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const name = params.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

  await runQuery(
    `
    INSERT INTO dbo.users (
      id,
      display_name,
      email,
      role,
      is_guest,
      show_only_core_admin_permissions,
      company_id,
      status,
      temporary_password,
      power_bi_access,
      power_bi_workspace_id,
      power_bi_report_id,
      password_last_changed_at,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @displayName,
      @email,
      @role,
      0,
      0,
      @companyId,
      'Active',
      NULL,
      'none',
      '',
      '',
      SYSUTCDATETIME(),
      SYSUTCDATETIME(),
      SYSUTCDATETIME()
    )
    `,
    {
      id: userId,
      displayName: name || params.email,
      email: params.email,
      role: params.role,
      companyId: params.companyId || null,
    }
  );

  for (const permission of params.permissions) {
    await runQuery(
      'INSERT INTO dbo.user_permissions (user_id, permission) VALUES (@userId, @permission)',
      { userId, permission }
    );
  }

  if (params.role === 'user' && params.permissions.join(',') === LOWEST_AUTO_PERMISSIONS.join(',')) {
    await runQuery(
      `
      INSERT INTO dbo.support_tickets (
        id,
        created_by_user_id,
        created_by_email,
        subject,
        description,
        category,
        status,
        created_at
      ) VALUES (
        @id,
        @createdByUserId,
        @createdByEmail,
        @subject,
        @description,
        'Technical',
        'Open',
        SYSUTCDATETIME()
      )
      `,
      {
        id: `TCK-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
        createdByUserId: userId,
        createdByEmail: params.email,
        subject: 'Auto access request created',
        description: `User ${params.email} was auto-provisioned with lowest permissions based on corporate domain match.`,
      }
    );
  }
};

const autoProvisionByPolicy = async (email: string): Promise<AuthUser | null> => {
  const normalizedEmail = email.toLowerCase();

  if (BOOTSTRAP_SUPADMIN_EMAILS.includes(normalizedEmail)) {
    await createUserWithPermissions({
      email: normalizedEmail,
      role: 'supadmin',
      permissions: SUPADMIN_DEFAULT_PERMISSIONS,
    });
    return getUserByEmail(normalizedEmail);
  }

  const domain = getEmailDomain(normalizedEmail);
  if (!domain) return null;
  const domainMatch = await runQuery<{ companyId: string | null }>(
    `
    SELECT TOP 1 company_id AS companyId
    FROM dbo.users
    WHERE RIGHT(LOWER(email), LEN(@suffix)) = @suffix
    `,
    { suffix: `@${domain}` }
  );

  if (!domainMatch.recordset[0]) return null;

  await createUserWithPermissions({
    email: normalizedEmail,
    role: 'user',
    permissions: LOWEST_AUTO_PERMISSIONS,
    companyId: domainMatch.recordset[0].companyId,
  });
  return getUserByEmail(normalizedEmail);
};

export const touchLastLogin = async (userId: string): Promise<void> => {
  await runQuery('UPDATE dbo.users SET last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @userId', { userId });
};

export const authenticateRequest = async (request: HttpRequest): Promise<AuthUser> => {
  const token = getBearerToken(request);
  if (!token && env.devBypassAuth) {
    const devEmailRaw = request.headers.get('x-dev-user-email') || request.headers.get('X-Dev-User-Email');
    const devEmail = (devEmailRaw || '').trim().toLowerCase();
    if (!devEmail) {
      throw new Error('Missing bearer token.');
    }
    const devUser = await getUserByEmail(devEmail);
    if (!devUser) {
      throw new Error(`No access record found for this Microsoft account email: ${devEmail}`);
    }
    return devUser;
  }
  if (!token) {
    throw new Error('Missing bearer token.');
  }

  const claims = await getTokenClaims(token);
  const email = getClaimEmail(claims);
  if (!email) {
    throw new Error('Token is missing an email claim.');
  }

  let user = await getUserByEmail(email);
  if (!user) {
    try {
      user = await autoProvisionByPolicy(email);
    } catch {
      // Keep original deny behavior on provisioning failure.
    }
  }
  if (!user) {
    throw new Error(`No access record found for this Microsoft account email: ${email}`);
  }

  return user;
};
