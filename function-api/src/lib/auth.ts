import { HttpRequest } from '@azure/functions';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { env, assertEnv } from './env';
import { runScopedQuery } from './db';
import {
  deriveAccessState,
  getClaimEmail,
  getClaimObjectId,
  normalizeEmail,
  IdentityProviderType,
  ProvisioningSource,
} from './identity';

type DbUserRow = {
  id: string;
  name: string;
  email: string;
  entraObjectId: string | null;
  role: 'supadmin' | 'admin' | 'user';
  isGuest: boolean;
  showOnlyCoreAdminPermissions: boolean;
  companyId: string | null;
  status: 'Active' | 'Inactive' | 'Suspended';
  provisioningSource: ProvisioningSource;
  accessState: 'invited' | 'pending' | 'active';
  identityProviderType: IdentityProviderType;
  identityTenantId: string | null;
  powerBiAccess: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId: string | null;
  powerBiReportId: string | null;
  lastLogin: string | null;
};

export type AuthUser = DbUserRow & {
  permissions: string[];
};

const USER_SELECT = `
  SELECT TOP 1
    id,
    display_name AS name,
    email,
    entra_object_id AS entraObjectId,
    role,
    is_guest AS isGuest,
    show_only_core_admin_permissions AS showOnlyCoreAdminPermissions,
    company_id AS companyId,
    status,
    provisioning_source AS provisioningSource,
    access_state AS accessState,
    identity_provider_type AS identityProviderType,
    identity_tenant_id AS identityTenantId,
    power_bi_access AS powerBiAccess,
    power_bi_workspace_id AS powerBiWorkspaceId,
    power_bi_report_id AS powerBiReportId,
    CONVERT(varchar(33), last_login_at, 127) AS lastLogin
  FROM dbo.users
`;
const AUTH_INTERNAL_CONTEXT = {
  role: 'user' as const,
  internalBypass: true,
};
type TokenProviderConfig = {
  providerType: IdentityProviderType;
  audiences: [string, ...string[]];
  jwksUri: string;
  issuers?: string[];
  issuerMatcher?: (issuer: string) => boolean;
  tenantId?: string | null;
};
type TokenValidationResult = {
  claims: JwtPayload;
  providerType: IdentityProviderType;
  tenantId: string | null;
};

const cachedJwksClients = new Map<string, JwksClient>();

export const buildAcceptedAudiences = (audience: string, clientId?: string): [string, ...string[]] => {
  const candidates = new Set<string>();
  const normalizedAudience = (audience || '').trim();
  const normalizedClientId = (clientId || '').trim();

  if (normalizedAudience) {
    candidates.add(normalizedAudience);
    if (normalizedAudience.startsWith('api://')) {
      candidates.add(normalizedAudience.slice('api://'.length));
    } else {
      candidates.add(`api://${normalizedAudience}`);
    }
  }

  if (normalizedClientId) {
    candidates.add(normalizedClientId);
    candidates.add(`api://${normalizedClientId}`);
  }

  const values = Array.from(candidates).filter(Boolean);
  if (values.length === 0) {
    throw new Error('At least one accepted audience is required for token validation.');
  }
  return values as [string, ...string[]];
};

export const getCorporateIdentityConflict = (
  user: {
    email: string;
    entraObjectId: string | null;
    identityProviderType: IdentityProviderType;
    identityTenantId: string | null;
  },
  incoming: {
    email: string;
    entraObjectId: string | null;
    providerType: IdentityProviderType;
    identityTenantId: string | null;
  }
): string | null => {
  const shouldEnforceStrongIdentityBinding = user.identityProviderType === incoming.providerType;

  if (
    shouldEnforceStrongIdentityBinding &&
    user.entraObjectId &&
    incoming.entraObjectId &&
    user.entraObjectId !== incoming.entraObjectId
  ) {
    return `Identity mismatch for ${incoming.email}.`;
  }

  if (
    shouldEnforceStrongIdentityBinding &&
    incoming.identityTenantId &&
    user.identityTenantId &&
    user.identityTenantId !== incoming.identityTenantId
  ) {
    return `Tenant mismatch for ${incoming.email}.`;
  }

  return null;
};

const getJwksClient = (jwksUri: string): JwksClient => {
  const cached = cachedJwksClients.get(jwksUri);
  if (cached) return cached;
  const client = jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    cacheMaxEntries: 10,
    rateLimit: true,
    jwksRequestsPerMinute: 30,
  });
  cachedJwksClients.set(jwksUri, client);
  return client;
};

const getTokenProviderConfigs = (): TokenProviderConfig[] => {
  if (!env.externalIdAudience || !env.externalIdJwksUri || env.externalIdIssuers.length === 0) {
    throw new Error('External ID token validation is not configured.');
  }

  return [
    {
      providerType: 'external_local',
      audiences: buildAcceptedAudiences(env.externalIdAudience, env.externalIdClientId),
      jwksUri: env.externalIdJwksUri,
      issuers: env.externalIdIssuers,
      tenantId: env.externalIdTenantId || null,
    },
  ];
};

const getBearerToken = (request: HttpRequest): string | null => {
  const raw = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  return raw.slice(7).trim();
};

const verifyTokenAgainstProvider = async (token: string, provider: TokenProviderConfig): Promise<JwtPayload> => {
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? (decoded.header as { kid?: string }).kid : undefined;
  if (!kid) throw new Error('Invalid token: missing key id.');
  const signingKey = await getJwksClient(provider.jwksUri).getSigningKey(kid);
  const publicKey = signingKey.getPublicKey();

  return await new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        algorithms: ['RS256'],
        audience: provider.audiences,
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
        const issuer = payload.iss || '';
        const issuerAllowed = provider.issuerMatcher
          ? provider.issuerMatcher(issuer)
          : (provider.issuers || []).includes(issuer);
        if (!issuerAllowed) {
          reject(new Error(`Invalid token issuer: ${payload.iss || 'unknown'}`));
          return;
        }
        resolve(payload);
      }
    );
  });
};

const getTokenClaims = async (token: string): Promise<TokenValidationResult> => {
  assertEnv();
  const providers = getTokenProviderConfigs();
  const decodedPayload = jwt.decode(token) as JwtPayload | null;
  const issuer = typeof decodedPayload?.iss === 'string' ? decodedPayload.iss : '';
  const routedProviders = issuer
    ? providers.filter((provider) =>
        provider.issuerMatcher ? provider.issuerMatcher(issuer) : (provider.issuers || []).includes(issuer)
      )
    : [];
  const candidateProviders = routedProviders.length > 0 ? routedProviders : providers;
  let lastError: Error | null = null;

  for (const provider of candidateProviders) {
    try {
      const claims = await verifyTokenAgainstProvider(token, provider);
      return {
        claims,
        providerType: provider.providerType,
        tenantId:
          typeof claims.tid === 'string' && claims.tid.trim()
            ? claims.tid.trim()
            : provider.tenantId || null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Token verification failed.');
    }
  }

  throw lastError || new Error('Token verification failed.');
};
const getPermissionsForUser = async (userId: string): Promise<string[]> => {
  const permissionsResult = await runScopedQuery<{ permission: string }>(
    AUTH_INTERNAL_CONTEXT,
    'SELECT permission FROM dbo.user_permissions WHERE user_id = @userId',
    { userId }
  );

  return permissionsResult.recordset.map((p) => p.permission);
};

const hydrateUser = async (row?: DbUserRow | null): Promise<AuthUser | null> => {
  if (!row || row.status !== 'Active') return null;
  const permissions = await getPermissionsForUser(row.id);
  return {
    ...row,
    accessState: deriveAccessState({
      provisioningSource: row.provisioningSource,
      permissions,
      hasLinkedIdentity: Boolean(row.entraObjectId),
    }),
    permissions,
  };
};

const getUserById = async (userId: string): Promise<AuthUser | null> => {
  const result = await runScopedQuery<DbUserRow>(AUTH_INTERNAL_CONTEXT, `${USER_SELECT} WHERE id = @userId`, { userId });
  return hydrateUser(result.recordset[0]);
};

const getUserByEmail = async (email: string): Promise<AuthUser | null> => {
  const result = await runScopedQuery<DbUserRow>(AUTH_INTERNAL_CONTEXT, `${USER_SELECT} WHERE LOWER(email) = @email`, {
    email: normalizeEmail(email),
  });
  return hydrateUser(result.recordset[0]);
};

const getUserByEntraObjectId = async (entraObjectId: string): Promise<AuthUser | null> => {
  const result = await runScopedQuery<DbUserRow>(AUTH_INTERNAL_CONTEXT, `${USER_SELECT} WHERE entra_object_id = @entraObjectId`, {
    entraObjectId,
  });
  return hydrateUser(result.recordset[0]);
};

const syncIdentityLink = async (
  user: AuthUser,
  email: string,
  entraObjectId: string | null,
  providerType: IdentityProviderType,
  identityTenantId: string | null
): Promise<AuthUser | null> => {
  const conflict = getCorporateIdentityConflict(user, {
    email,
    entraObjectId,
    providerType,
    identityTenantId,
  });
  if (conflict) {
    throw new Error(conflict);
  }

  const nextProvisioningSource =
    user.provisioningSource === 'invited_personal' && providerType === 'external_local'
      ? 'external_local_account'
      : user.provisioningSource;
  const nextAccessState = deriveAccessState({
    provisioningSource: nextProvisioningSource,
    permissions: user.permissions,
    hasLinkedIdentity: Boolean(entraObjectId || user.entraObjectId),
  });
  const shouldUpdateIdentityBinding =
    !user.entraObjectId ||
    user.entraObjectId === entraObjectId ||
    user.identityProviderType === providerType;

  await runScopedQuery(
    AUTH_INTERNAL_CONTEXT,
    `
    UPDATE dbo.users
    SET
      email = @email,
      entra_object_id = CASE WHEN @shouldUpdateIdentityBinding = 1 THEN COALESCE(@entraObjectId, entra_object_id) ELSE entra_object_id END,
      provisioning_source = @provisioningSource,
      identity_provider_type = CASE WHEN @shouldUpdateIdentityBinding = 1 THEN @identityProviderType ELSE identity_provider_type END,
      identity_tenant_id = CASE WHEN @shouldUpdateIdentityBinding = 1 THEN COALESCE(@identityTenantId, identity_tenant_id) ELSE identity_tenant_id END,
      access_state = @accessState,
      updated_at = SYSUTCDATETIME()
    WHERE id = @userId
    `,
    {
      userId: user.id,
      email,
      entraObjectId,
      provisioningSource: nextProvisioningSource,
      identityProviderType: user.identityProviderType || providerType,
      identityTenantId,
      accessState: nextAccessState,
      shouldUpdateIdentityBinding: shouldUpdateIdentityBinding ? 1 : 0,
    }
  );

  return getUserById(user.id);
};

export const touchLastLogin = async (userId: string): Promise<void> => {
  await runScopedQuery(
    AUTH_INTERNAL_CONTEXT,
    'UPDATE dbo.users SET last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @userId',
    { userId }
  );
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
      throw new Error(`No access record found for this sign-in email: ${devEmail}`);
    }
    return devUser;
  }
  if (!token) {
    throw new Error('Missing bearer token.');
  }

  const validatedToken = await getTokenClaims(token);
  const email = getClaimEmail(validatedToken.claims);
  const entraObjectId = getClaimObjectId(validatedToken.claims);
  const identityTenantId = validatedToken.tenantId;
  if (!email) {
    throw new Error('Token is missing an email claim.');
  }

  let user = entraObjectId ? await getUserByEntraObjectId(entraObjectId) : null;
  if (!user) {
    user = await getUserByEmail(email);
  }

  if (user) {
    const conflict = getCorporateIdentityConflict(user, {
      email,
      entraObjectId,
      providerType: validatedToken.providerType,
      identityTenantId,
    });
    if (conflict) {
      throw new Error(conflict);
    }
  }

  if (user && (user.email !== email || (!user.entraObjectId && entraObjectId) || (!user.identityTenantId && identityTenantId))) {
    user = await syncIdentityLink(user, email, entraObjectId, validatedToken.providerType, validatedToken.tenantId);
  }

  if (!user) {
    throw new Error(`No access record found for this sign-in email: ${email}`);
  }

  return user;
};
