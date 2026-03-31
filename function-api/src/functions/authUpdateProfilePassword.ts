import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateProfilePasswordBody = {
  email?: string;
  name?: string;
};

type UserRow = {
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

export async function authUpdateProfilePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as UpdateProfilePasswordBody;
    const email = (body.email || '').trim().toLowerCase();
    const name = (body.name || '').trim();

    if (!email) {
      return errorResponse(400, 'Email is required.');
    }
    if (!name) {
      return errorResponse(400, 'Name is required.');
    }

    const userResult = await runQuery<UserRow>(
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
      { email }
    );
    const user = userResult.recordset[0];
    if (!user || user.status !== 'Active') {
      return errorResponse(404, 'User not found.');
    }

    await runQuery(
      `
      UPDATE dbo.users
      SET
        display_name = @name,
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId: user.id,
        name,
      }
    );

    const permissionsResult = await runQuery<{ permission: string }>(
      'SELECT permission FROM dbo.user_permissions WHERE user_id = @userId',
      { userId: user.id }
    );
    const permissions = permissionsResult.recordset.map((p) => p.permission);

    return ok({
      user: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
        isGuest: user.isGuest,
        showOnlyCoreAdminPermissions: user.showOnlyCoreAdminPermissions,
        companyId: user.companyId || '',
        status: user.status,
        permissions,
        powerBiAccess: user.powerBiAccess,
        powerBiWorkspaceId: user.powerBiWorkspaceId || '',
        powerBiReportId: user.powerBiReportId || '',
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/profile-password update failed', message);
    return errorResponse(500, message);
  }
}

app.http('auth-update-profile-password', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'auth/profile-password',
  handler: authUpdateProfilePassword,
});
