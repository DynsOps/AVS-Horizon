import { runQuery } from './db';

// In-memory cache: key = `${userId}:${activeCompanyId ?? 'null'}`
const cache = new Map<string, { perms: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const invalidatePermissionCache = (userId: string, companyId?: string | null): void => {
  if (companyId !== undefined) {
    cache.delete(`${userId}:${companyId ?? 'null'}`);
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${userId}:`)) cache.delete(k);
    }
  }
};

const getAllActivePermissionKeys = async (): Promise<string[]> => {
  const res = await runQuery<{ key: string }>(
    'SELECT [key] FROM dbo.permissions WHERE is_active = 1',
    {}
  );
  return res.recordset.map((r) => r.key);
};

const getCompanyTemplatePermissions = async (companyId: string): Promise<string[]> => {
  const res = await runQuery<{ permissions: string }>(
    `SELECT et.permissions
     FROM dbo.company_template_assignment cta
     JOIN dbo.entitlement_templates et ON et.id = cta.template_id
     WHERE cta.company_id = @companyId AND et.is_active = 1`,
    { companyId }
  );
  if (!res.recordset[0]) return [];
  try {
    return JSON.parse(res.recordset[0].permissions) as string[];
  } catch {
    return [];
  }
};

const getUserTemplatePermissions = async (userId: string): Promise<string[]> => {
  const res = await runQuery<{ permissions: string }>(
    `SELECT et.permissions
     FROM dbo.user_template_assignment uta
     JOIN dbo.entitlement_templates et ON et.id = uta.template_id
     WHERE uta.user_id = @userId AND et.is_active = 1`,
    { userId }
  );
  if (!res.recordset[0]) return [];
  try {
    return JSON.parse(res.recordset[0].permissions) as string[];
  } catch {
    return [];
  }
};

const getUserReportPermissions = async (userId: string): Promise<string[]> => {
  const res = await runQuery<{ permissionKey: string }>(
    `SELECT ar.permission_key AS permissionKey
     FROM dbo.user_report_access ura
     JOIN dbo.analysis_reports ar ON ar.id = ura.report_id
     WHERE ura.user_id = @userId AND ar.is_active = 1`,
    { userId }
  );
  return res.recordset.map((r) => r.permissionKey);
};

export const resolveEffectivePermissions = async (
  userId: string,
  role: 'supadmin' | 'admin' | 'user',
  activeCompanyId: string | null
): Promise<string[]> => {
  const cacheKey = `${userId}:${activeCompanyId ?? 'null'}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  let perms: string[];
  if (role === 'supadmin') {
    perms = await getAllActivePermissionKeys();
  } else {
    const [templatePerms, reportPerms] = await Promise.all([
      getUserTemplatePermissions(userId),
      getUserReportPermissions(userId),
    ]);
    const merged = new Set([...templatePerms, ...reportPerms]);
    perms = Array.from(merged);
  }

  cache.set(cacheKey, { perms, expiresAt: Date.now() + CACHE_TTL_MS });
  return perms;
};
