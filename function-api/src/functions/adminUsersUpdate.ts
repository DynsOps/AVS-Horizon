import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { UserRole, getDefaultPermissionsForRole } from '../lib/rbac';

type UpdateUserBody = {
  name?: string;
  email?: string;
  role?: UserRole;
  isGuest?: boolean;
  companyId?: string | null;
  status?: 'Active' | 'Inactive' | 'Suspended';
  permissions?: string[];
  powerBiAccess?: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId?: string;
  powerBiReportId?: string;
};

type TargetUser = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  companyId: string | null;
  isGuest: boolean;
  status: 'Active' | 'Inactive' | 'Suspended';
  powerBiAccess: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId: string | null;
  powerBiReportId: string | null;
};

const SUPADMIN_CONTROLLED_PERMISSIONS = new Set<string>([
  'system:settings',
  'view:finance',
  'view:sustainability',
  'view:business',
]);

const canManageRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin') return targetRole !== 'supadmin';
  return false;
};

export async function updateAdminUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const userId = request.params.id;
    if (!userId) return errorResponse(400, 'User id is required.');

    const body = (await request.json()) as UpdateUserBody;
    const targetResult = await runQuery<TargetUser>(
      `
      SELECT TOP 1
        id,
        display_name AS name,
        role,
        email,
        company_id AS companyId,
        is_guest AS isGuest,
        status,
        power_bi_access AS powerBiAccess,
        power_bi_workspace_id AS powerBiWorkspaceId,
        power_bi_report_id AS powerBiReportId
      FROM dbo.users
      WHERE id = @userId
      `,
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');

    const nextRole = body.role || target.role;
    if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, nextRole)) {
      return errorResponse(403, 'Only supadmin can manage supadmin users.');
    }

    const nextEmail = (body.email || target.email).trim().toLowerCase();
    const nextName = (body.name || target.name).trim();
    if (!nextName) return errorResponse(400, 'Name is required.');
    if (!nextEmail) return errorResponse(400, 'Email is required.');
    if (nextEmail !== target.email.toLowerCase()) {
      const existsResult = await runQuery<{ count: number }>(
        'SELECT COUNT(1) AS count FROM dbo.users WHERE LOWER(email) = @email AND id <> @userId',
        { email: nextEmail, userId }
      );
      if ((existsResult.recordset[0]?.count || 0) > 0) {
        return errorResponse(409, 'A user with this email already exists.');
      }
    }

    const nextIsGuest = typeof body.isGuest === 'boolean' ? body.isGuest : target.isGuest;
    const nextCompanyId = body.companyId !== undefined ? body.companyId : target.companyId;
    if (nextRole === 'user' && !nextIsGuest && !nextCompanyId) {
      return errorResponse(400, 'Company is required for non-guest users.');
    }

    const nextPowerBiAccess = body.powerBiAccess || target.powerBiAccess || 'none';
    const nextWorkspace = nextPowerBiAccess === 'none' ? '' : (body.powerBiWorkspaceId ?? target.powerBiWorkspaceId ?? '');
    const nextReport = nextPowerBiAccess === 'none' ? '' : (body.powerBiReportId ?? target.powerBiReportId ?? '');
    if (nextPowerBiAccess !== 'none' && (!nextWorkspace || !nextReport)) {
      return errorResponse(400, 'Power BI workspace/report is required when access is not none.');
    }

    const currentPermissionsResult = await runQuery<{ permission: string }>(
      'SELECT permission FROM dbo.user_permissions WHERE user_id = @userId',
      { userId }
    );
    const currentPermissions = currentPermissionsResult.recordset.map((p) => p.permission);
    const requestedPermissions = (body.permissions && body.permissions.length > 0)
      ? body.permissions
      : (body.role ? getDefaultPermissionsForRole(nextRole) : currentPermissions);

    if (actor.role === 'admin') {
      const actorSet = new Set(actor.permissions);
      const existingSet = new Set(currentPermissions);
      const disallowedByActor = requestedPermissions.filter((permission) => !actorSet.has(permission) && !existingSet.has(permission));
      if (disallowedByActor.length > 0) {
        return errorResponse(403, `Admin can only grant permissions they already have: ${disallowedByActor.join(', ')}`);
      }
      const disallowedControlled = requestedPermissions.filter((permission) => SUPADMIN_CONTROLLED_PERMISSIONS.has(permission) && !existingSet.has(permission));
      if (disallowedControlled.length > 0) {
        return errorResponse(403, `Only supadmin can grant controlled permissions: ${disallowedControlled.join(', ')}`);
      }
    }

    await runQuery(
      `
      UPDATE dbo.users
      SET
        display_name = @displayName,
        email = @email,
        role = @role,
        is_guest = @isGuest,
        company_id = @companyId,
        status = @status,
        power_bi_access = @powerBiAccess,
        power_bi_workspace_id = @workspaceId,
        power_bi_report_id = @reportId,
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId,
        displayName: nextName,
        email: nextEmail,
        role: nextRole,
        isGuest: nextIsGuest,
        companyId: nextRole === 'user' && !nextIsGuest ? nextCompanyId || null : null,
        status: body.status || target.status,
        powerBiAccess: nextPowerBiAccess,
        workspaceId: nextWorkspace,
        reportId: nextReport,
      }
    );

    await runQuery('DELETE FROM dbo.user_permissions WHERE user_id = @userId', { userId });
    for (const permission of requestedPermissions) {
      await runQuery('INSERT INTO dbo.user_permissions (user_id, permission) VALUES (@userId, @permission)', { userId, permission });
    }

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/users update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-users-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'identity/users/{id}',
  handler: updateAdminUser,
});
