import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

const INTERNAL = { role: 'user' as const, internalBypass: true };

const MANAGEABLE_ROLES = new Set(['admin', 'user']);

export async function getUserCompanies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const userId = request.params.id;
    if (!userId) return errorResponse(400, 'User id is required.');

    const targetResult = await runScopedQuery<{ role: string; companyId: string | null }>(
      INTERNAL,
      'SELECT TOP 1 role, company_id AS companyId FROM dbo.users WHERE id = @userId',
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');
    if (!MANAGEABLE_ROLES.has(target.role)) {
      return errorResponse(400, 'Company access management is only for admin and user roles.');
    }

    // Admin can only query users within their own companies
    if (actor.role === 'admin') {
      if (!target.companyId || !actor.companyIds.includes(target.companyId)) {
        return errorResponse(403, 'Admin can only manage users in their own companies.');
      }
    }

    const result = await runScopedQuery<{ companyId: string }>(
      INTERNAL,
      'SELECT company_id AS companyId FROM dbo.admin_company_access WHERE admin_user_id = @userId',
      { userId }
    );

    const companyIds = result.recordset.map((r) => r.companyId);
    return ok({ companyIds: companyIds.length ? companyIds : (target.companyId ? [target.companyId] : []) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user-companies get failed', message);
    return errorResponse(500, message);
  }
}

export async function setUserCompanies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const userId = request.params.id;
    if (!userId) return errorResponse(400, 'User id is required.');

    const body = (await request.json()) as { companyIds?: unknown };
    if (!Array.isArray(body.companyIds) || body.companyIds.some((id) => typeof id !== 'string')) {
      return errorResponse(400, 'companyIds must be an array of strings.');
    }
    const companyIds: string[] = body.companyIds;

    const targetResult = await runScopedQuery<{ role: string; companyId: string | null }>(
      INTERNAL,
      'SELECT TOP 1 role, company_id AS companyId FROM dbo.users WHERE id = @userId',
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');
    if (!MANAGEABLE_ROLES.has(target.role)) {
      return errorResponse(400, 'Company access management is only for admin and user roles.');
    }

    // Admin can only manage users within their own companies, and can only assign their own companies
    if (actor.role === 'admin') {
      if (!target.companyId || !actor.companyIds.includes(target.companyId)) {
        return errorResponse(403, 'Admin can only manage users in their own companies.');
      }
      const outsideAdminScope = companyIds.filter((id) => !actor.companyIds.includes(id));
      if (outsideAdminScope.length > 0) {
        return errorResponse(403, 'Admin can only assign companies within their own scope.');
      }
    }

    if (companyIds.length > 0) {
      const placeholders = companyIds.map((_, i) => `@c${i}`).join(', ');
      const params: Record<string, string> = {};
      companyIds.forEach((id, i) => { params[`c${i}`] = id; });
      const checkResult = await runScopedQuery<{ count: number }>(
        INTERNAL,
        `SELECT COUNT(1) AS count FROM dbo.companies WHERE id IN (${placeholders}) AND status = 'Active'`,
        params
      );
      if ((checkResult.recordset[0]?.count ?? 0) !== companyIds.length) {
        return errorResponse(400, 'One or more company IDs are invalid or inactive.');
      }
    }

    await runScopedQuery(
      INTERNAL,
      'DELETE FROM dbo.admin_company_access WHERE admin_user_id = @userId',
      { userId }
    );

    for (const companyId of companyIds) {
      const id = `aca-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await runScopedQuery(
        INTERNAL,
        'INSERT INTO dbo.admin_company_access (id, admin_user_id, company_id) VALUES (@id, @userId, @companyId)',
        { id, userId, companyId }
      );
    }

    // Keep users.company_id in sync with the primary (first) assigned company
    const primaryCompanyId = companyIds[0] ?? null;
    await runScopedQuery(
      INTERNAL,
      'UPDATE dbo.users SET company_id = @companyId, updated_at = SYSUTCDATETIME() WHERE id = @userId',
      { userId, companyId: primaryCompanyId }
    );

    return ok({ success: true, companyIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user-companies set failed', message);
    return errorResponse(500, message);
  }
}

app.http('user-companies-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/users/{id}/companies',
  handler: getUserCompanies,
});

app.http('user-companies-set', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'identity/users/{id}/companies',
  handler: setUserCompanies,
});
