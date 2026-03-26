import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { UserRole, getDefaultPermissionsForRole } from '../lib/rbac';

type CreateUserRequest = {
  name: string;
  email: string;
  role: UserRole;
  isGuest?: boolean;
  companyId?: string | null;
  status?: 'Active' | 'Inactive' | 'Suspended';
  permissions?: string[];
  powerBiAccess?: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId?: string;
  powerBiReportId?: string;
};

const assertCanManageRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin' && targetRole !== 'supadmin') return true;
  return false;
};

export async function createAdminUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);

    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const body = (await request.json()) as Partial<CreateUserRequest>;
    if (!body.name || !body.email || !body.role) {
      return errorResponse(400, 'name, email and role are required.');
    }

    if (!assertCanManageRole(actor.role, body.role)) {
      return errorResponse(403, 'You are not allowed to create this role.');
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    const role = body.role;
    const isGuest = Boolean(body.isGuest);
    const companyId = body.companyId || null;
    const status = body.status || 'Active';
    const powerBiAccess = body.powerBiAccess || 'none';
    const powerBiWorkspaceId = powerBiAccess === 'none' ? null : body.powerBiWorkspaceId || null;
    const powerBiReportId = powerBiAccess === 'none' ? null : body.powerBiReportId || null;

    if (role === 'user' && !isGuest && !companyId) {
      return errorResponse(400, 'Company is required for non-guest users.');
    }

    const existsResult = await runQuery<{ count: number }>(
      'SELECT COUNT(1) AS count FROM dbo.users WHERE LOWER(email) = @email',
      { email: normalizedEmail }
    );

    if ((existsResult.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'A user with this email already exists.');
    }

    const userId = `u-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const temporaryPassword = `AVS-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const effectivePermissions = (body.permissions && body.permissions.length > 0)
      ? body.permissions
      : getDefaultPermissionsForRole(role);

    await runQuery(
      `
      INSERT INTO dbo.users (
        id,
        display_name,
        email,
        role,
        is_guest,
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
        @isGuest,
        @companyId,
        @status,
        @temporaryPassword,
        @powerBiAccess,
        @powerBiWorkspaceId,
        @powerBiReportId,
        SYSUTCDATETIME(),
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
      )
      `,
      {
        id: userId,
        displayName: body.name.trim(),
        email: normalizedEmail,
        role,
        isGuest,
        companyId,
        status,
        temporaryPassword,
        powerBiAccess,
        powerBiWorkspaceId,
        powerBiReportId,
      }
    );

    for (const permission of effectivePermissions) {
      await runQuery(
        'INSERT INTO dbo.user_permissions (user_id, permission) VALUES (@userId, @permission)',
        { userId, permission }
      );
    }

    return created({
      user: {
        id: userId,
        name: body.name.trim(),
        email: normalizedEmail,
        role,
        isGuest,
        companyId,
        status,
        permissions: effectivePermissions,
        powerBiAccess,
        powerBiWorkspaceId,
        powerBiReportId,
      },
      temporaryPassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('admin/users create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-users-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'identity/users',
  handler: createAdminUser,
});
