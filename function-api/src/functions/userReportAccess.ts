import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { invalidatePermissionCache } from '../lib/resolvePermissions';

// GET /identity/users/{userId}/reports
export async function userReportAccessGet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') return errorResponse(403, 'Access denied.');

    const userId = request.params.userId;
    if (!userId) return errorResponse(400, 'userId required.');

    const res = await runQuery<{ reportId: string }>(
      `SELECT report_id AS reportId FROM dbo.user_report_access WHERE user_id = @userId`,
      { userId }
    );
    return ok({ reportIds: res.recordset.map((r) => r.reportId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user/report-access-get failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('user-report-access-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/users/{userId}/reports',
  handler: userReportAccessGet,
});

// PUT /identity/users/{userId}/reports  — body: { reportIds: string[] }
export async function userReportAccessSet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') return errorResponse(403, 'Access denied.');

    const userId = request.params.userId;
    if (!userId) return errorResponse(400, 'userId required.');

    const body = (await request.json()) as { reportIds?: string[] };
    const reportIds: string[] = Array.isArray(body.reportIds) ? body.reportIds : [];

    // Verify target user exists and actor has scope
    const targetUser = await runQuery<{ id: string; company_id: string | null; role: string }>(
      `SELECT id, company_id, role FROM dbo.users WHERE id = @userId AND status = 'Active'`,
      { userId }
    );
    if (!targetUser.recordset[0]) return errorResponse(404, 'User not found.');

    if (actor.role === 'admin') {
      const targetCompanyId = targetUser.recordset[0].company_id;
      const adminCompanies = actor.companyIds.length ? actor.companyIds : (actor.companyId ? [actor.companyId] : []);
      if (!targetCompanyId || !adminCompanies.includes(targetCompanyId)) {
        return errorResponse(403, 'Admin can only manage users in their own company.');
      }
    }

    // Verify all report IDs exist and (for admin) actor has access to them
    if (reportIds.length > 0) {
      const idList = reportIds.map((_, i) => `@r${i}`).join(',');
      const params = Object.fromEntries(reportIds.map((id, i) => [`r${i}`, id]));
      const existing = await runQuery<{ id: string; permissionKey: string }>(
        `SELECT id, permission_key AS permissionKey FROM dbo.analysis_reports WHERE id IN (${idList}) AND is_active = 1`,
        params
      );
      if (existing.recordset.length !== reportIds.length) {
        return errorResponse(400, 'One or more report IDs are invalid.');
      }
      if (actor.role === 'admin') {
        const actorPerms = new Set(actor.permissions);
        const missing = existing.recordset.filter((r) => !actorPerms.has(r.permissionKey));
        if (missing.length > 0) {
          return errorResponse(403, `You do not have access to reports: ${missing.map((r) => r.id).join(', ')}`);
        }
      }
    }

    // Replace all entries for this user atomically
    await runQuery(`DELETE FROM dbo.user_report_access WHERE user_id = @userId`, { userId });

    for (const reportId of reportIds) {
      await runQuery(
        `INSERT INTO dbo.user_report_access (user_id, report_id, assigned_by_user_id)
         VALUES (@userId, @reportId, @actorId)`,
        { userId, reportId, actorId: actor.id }
      );
    }

    invalidatePermissionCache(userId);

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user/report-access-set failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('user-report-access-set', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'identity/users/{userId}/reports',
  handler: userReportAccessSet,
});
