import { JwtPayload } from 'jsonwebtoken';

export type ProvisioningSource =
  | 'bootstrap_supadmin'
  | 'corporate_precreated'
  | 'invited_personal'
  | 'external_local_account'
  | 'auto_domain';

export type AccessState = 'invited' | 'pending' | 'active';
export type IdentityProviderType = 'workforce_federated' | 'external_local';

export type SessionContext = {
  role: 'supadmin' | 'admin' | 'user';
  companyId?: string | null;
  userId?: string | null;
  internalBypass?: boolean;
};

const PERSONAL_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'yandex.com',
  'proton.me',
  'protonmail.com',
]);

const EXT_MARKER = '#ext#@';

const escapeSqlStringLiteral = (value: string): string => value.replace(/'/g, "''");

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const normalizeDomain = (value: string): string => normalizeEmail(value).replace(/^@+/, '');

export const getEmailDomain = (email: string): string => {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf('@');
  return atIndex === -1 ? '' : normalized.slice(atIndex + 1);
};

export const normalizeExtEmail = (value: string): string => {
  const candidate = normalizeEmail(value);
  const markerIndex = candidate.indexOf(EXT_MARKER);
  if (markerIndex === -1) return candidate;

  const left = candidate.slice(0, markerIndex);
  const splitIndex = left.lastIndexOf('_');
  if (splitIndex === -1) return candidate;

  const localPart = left.slice(0, splitIndex);
  const domainPart = left.slice(splitIndex + 1);
  if (!localPart || !domainPart || domainPart.includes('@')) return candidate;

  return `${localPart}@${domainPart}`;
};

export const isPersonalEmailDomain = (emailOrDomain: string): boolean => {
  const domain = emailOrDomain.includes('@') ? getEmailDomain(emailOrDomain) : normalizeDomain(emailOrDomain);
  return PERSONAL_EMAIL_DOMAINS.has(domain);
};

export const getProvisioningSourceForEmail = (_email: string): ProvisioningSource => 'external_local_account';

export const getIdentityProviderTypeForProvisioningSource = (
  provisioningSource: ProvisioningSource
): IdentityProviderType => {
  if (provisioningSource === 'external_local_account' || provisioningSource === 'invited_personal') {
    return 'external_local';
  }
  // Legacy rows may still carry corporate_precreated/bootstrap metadata.
  return 'workforce_federated';
};

export const getClaimEmail = (claims: JwtPayload): string | null => {
  const orderedCandidates = [claims.email, claims.preferred_username, claims.upn, claims.unique_name];
  for (const raw of orderedCandidates) {
    if (typeof raw !== 'string') continue;
    const normalized = normalizeExtEmail(raw);
    if (normalized.includes('@')) return normalized;
  }
  return null;
};

export const getClaimObjectId = (claims: JwtPayload): string | null => {
  const orderedCandidates = [claims.oid, claims.sub];
  for (const raw of orderedCandidates) {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
};

export const deriveAccessState = (params: {
  provisioningSource: ProvisioningSource;
  permissions: string[];
  hasLinkedIdentity: boolean;
}): AccessState => {
  if ((params.provisioningSource === 'invited_personal' || params.provisioningSource === 'external_local_account') && !params.hasLinkedIdentity) {
    return 'invited';
  }

  return params.permissions.length > 0 ? 'active' : 'pending';
};

export const buildSessionContextPrefix = (context: SessionContext): string => {
  const companyId = context.companyId ? `'${escapeSqlStringLiteral(context.companyId)}'` : 'NULL';
  const userId = context.userId ? `'${escapeSqlStringLiteral(context.userId)}'` : 'NULL';
  const role = `'${escapeSqlStringLiteral(context.role)}'`;
  const internalBypass = context.internalBypass ? '1' : '0';

  return [
    `EXEC sp_set_session_context @key=N'app.role', @value=${role};`,
    `EXEC sp_set_session_context @key=N'app.company_id', @value=${companyId};`,
    `EXEC sp_set_session_context @key=N'app.user_id', @value=${userId};`,
    `EXEC sp_set_session_context @key=N'app.internal_bypass', @value=${internalBypass};`,
  ].join('\n');
};
