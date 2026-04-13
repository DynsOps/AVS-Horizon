import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { IdentityProviderType, ProvisioningSource } from '../lib/identity';

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

export async function listAdminUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const isAdminActor = actor.role === 'admin';
    if (isAdminActor && !actor.companyId) {
      return ok({ users: [] });
    }

    const usersResult = await runScopedQuery<DbUserRow>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      SELECT
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
      ORDER BY created_at DESC
      `
    );

    const permissionsResult = await runScopedQuery<{ userId: string; permission: string }>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
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
        identityTenantId: user.identityTenantId || '',
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
