import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type DbUserRow = {
  id: string;
  name: string;
  email: string;
  role: 'supadmin' | 'admin' | 'user';
  isGuest: boolean;
  companyId: string | null;
  status: 'Active' | 'Inactive' | 'Suspended';
  powerBiAccess: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId: string | null;
  powerBiReportId: string | null;
  temporaryPassword: string | null;
  lastLogin: string | null;
  passwordLastChangedAt: string | null;
};

export async function listAdminUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const usersResult = await runQuery<DbUserRow>(
      `
      SELECT
        id,
        display_name AS name,
        email,
        role,
        is_guest AS isGuest,
        company_id AS companyId,
        status,
        power_bi_access AS powerBiAccess,
        power_bi_workspace_id AS powerBiWorkspaceId,
        power_bi_report_id AS powerBiReportId,
        temporary_password AS temporaryPassword,
        CONVERT(varchar(33), last_login_at, 127) AS lastLogin,
        CONVERT(varchar(33), password_last_changed_at, 127) AS passwordLastChangedAt
      FROM dbo.users
      ORDER BY created_at DESC
      `
    );

    const permissionsResult = await runQuery<{ userId: string; permission: string }>(
      'SELECT user_id AS userId, permission FROM dbo.user_permissions'
    );
    const permissionMap = new Map<string, string[]>();
    for (const row of permissionsResult.recordset) {
      const next = permissionMap.get(row.userId) || [];
      next.push(row.permission);
      permissionMap.set(row.userId, next);
    }

    return ok({
      users: usersResult.recordset.map((user) => ({
        ...user,
        companyId: user.companyId || '',
        powerBiWorkspaceId: user.powerBiWorkspaceId || '',
        powerBiReportId: user.powerBiReportId || '',
        permissions: permissionMap.get(user.id) || [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/users list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-users-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/users',
  handler: listAdminUsers,
});
