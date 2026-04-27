import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { UserRole, getDefaultPermissionsForRole } from '../lib/rbac';
import { deriveAccessState, getProvisioningSourceForEmail, normalizeEmail, ProvisioningSource } from '../lib/identity';

type UpdateUserBody = {
  name?: string;
  email?: string;
  role?: UserRole;
  isGuest?: boolean;
  showOnlyCoreAdminPermissions?: boolean;
  companyId?: string | null;
  status?: 'Active' | 'Inactive' | 'Suspended';
  permissions?: string[];
  provisioningMode?: 'external_local_account';
};

type TargetUser = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  entraObjectId: string | null;
  companyId: string | null;
  isGuest: boolean;
  showOnlyCoreAdminPermissions: boolean;
  status: 'Active' | 'Inactive' | 'Suspended';
  provisioningSource: ProvisioningSource;
};

const SUPADMIN_CONTROLLED_PERMISSIONS = new Set<string>([
  'system:settings',
  'view:finance',
  'view:sustainability',
  'view:business',
  'manage:reports',
]);
const COMPANY_ADMIN_BASE_PERMISSIONS = new Set(['view:dashboard', 'view:reports', 'create:support-ticket']);

const getCompanyAdminAllowedPermissions = (actorPermissions: string[]): Set<string> => {
  const actorReportPermissions = actorPermissions.filter((permission) => permission.startsWith('view:analysis-report:'));
  return new Set([...COMPANY_ADMIN_BASE_PERMISSIONS, ...actorReportPermissions]);
};

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
    const targetResult = await runScopedQuery<TargetUser>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      SELECT TOP 1
        id,
        display_name AS name,
        role,
        email,
        entra_object_id AS entraObjectId,
        company_id AS companyId,
        is_guest AS isGuest,
        show_only_core_admin_permissions AS showOnlyCoreAdminPermissions,
        status,
        provisioning_source AS provisioningSource
      FROM dbo.users
      WHERE id = @userId
      `,
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');

    const isAdminActor = actor.role === 'admin';
    if (isAdminActor) {
      if (actor.companyIds.length === 0) return errorResponse(403, 'Admin user is not linked to any company.');
      if (target.role !== 'user') {
        return errorResponse(403, 'Admin can only manage standard user accounts.');
      }
      if (!target.companyId || !actor.companyIds.includes(target.companyId)) {
        return errorResponse(403, 'Admin can only manage users in their own companies.');
      }
    }

    const nextRole = body.role || target.role;
    if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, nextRole)) {
      return errorResponse(403, 'Only supadmin can manage supadmin users.');
    }
    if (isAdminActor && nextRole !== 'user') {
      return errorResponse(403, 'Admin can only manage standard user accounts.');
    }

    const nextEmail = normalizeEmail(body.email || target.email);
    const nextName = (body.name || target.name).trim();
    if (!nextName) return errorResponse(400, 'Name is required.');
    if (!nextEmail) return errorResponse(400, 'Email is required.');
    if (nextEmail !== target.email.toLowerCase()) {
      const existsResult = await runScopedQuery<{ count: number }>(
        { role: actor.role, companyId: actor.companyId, userId: actor.id },
        'SELECT COUNT(1) AS count FROM dbo.users WHERE LOWER(email) = @email AND id <> @userId',
        { email: nextEmail, userId }
      );
      if ((existsResult.recordset[0]?.count || 0) > 0) {
        return errorResponse(409, 'A user with this email already exists.');
      }
    }

    const nextIsGuest = nextRole === 'user'
      ? (isAdminActor ? false : (typeof body.isGuest === 'boolean' ? body.isGuest : target.isGuest))
      : false;
    const nextShowOnlyCoreAdminPermissions = nextRole === 'admin'
      ? (isAdminActor ? false : (typeof body.showOnlyCoreAdminPermissions === 'boolean'
        ? body.showOnlyCoreAdminPermissions
        : target.showOnlyCoreAdminPermissions))
      : false;
    const nextCompanyId = body.companyId !== undefined ? body.companyId : target.companyId;
    if (isAdminActor) {
      if (body.isGuest) {
        return errorResponse(403, 'Admin cannot assign guest scope.');
      }
      if (nextCompanyId && !actor.companyIds.includes(nextCompanyId)) {
        return errorResponse(403, 'Admin can only assign users to their own companies.');
      }
    }
    const scopedCompanyId = isAdminActor ? (nextCompanyId || actor.companyIds[0] || null) : nextCompanyId;
    const normalizedRole: UserRole = isAdminActor ? 'user' : nextRole;
    if ((normalizedRole === 'user' && !nextIsGuest && !scopedCompanyId) || (normalizedRole === 'admin' && !scopedCompanyId)) {
      return errorResponse(400, 'Company is required for admin and non-guest user roles.');
    }

    const currentPermissions: string[] = [];
    const requestedPermissions = body.permissions !== undefined
      ? body.permissions
      : (body.role ? getDefaultPermissionsForRole(normalizedRole) : currentPermissions);
    if (isAdminActor) {
      const allowedPermissions = getCompanyAdminAllowedPermissions(actor.permissions);
      const existingSet = new Set(currentPermissions);
      const disallowedByRole = requestedPermissions.filter((permission) => !allowedPermissions.has(permission) && !existingSet.has(permission));
      if (disallowedByRole.length > 0) {
        return errorResponse(403, 'Admin can only grant user-role permissions.');
      }
    }
    const effectivePermissions = isAdminActor
      ? requestedPermissions
      : requestedPermissions;
    const nextProvisioningSource: ProvisioningSource = isAdminActor
      ? (target.provisioningSource || 'external_local_account')
      : (body.provisioningMode
      ? body.provisioningMode
      : (target.provisioningSource || getProvisioningSourceForEmail(nextEmail)));

    if (target.provisioningSource !== nextProvisioningSource && target.entraObjectId) {
      return errorResponse(400, 'Changing an existing linked account between corporate and external local provisioning is not supported.');
    }

    if (actor.role === 'admin') {
      const existingSet = new Set(currentPermissions);
      const disallowedControlled = effectivePermissions.filter((permission) => SUPADMIN_CONTROLLED_PERMISSIONS.has(permission) && !existingSet.has(permission));
      if (disallowedControlled.length > 0) {
        return errorResponse(403, `Only supadmin can grant controlled permissions: ${disallowedControlled.join(', ')}`);
      }
    }

    const nextAccessState = deriveAccessState({
      provisioningSource: nextProvisioningSource,
      permissions: effectivePermissions,
      hasLinkedIdentity: Boolean(target.entraObjectId),
    });

    await runScopedQuery(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      UPDATE dbo.users
      SET
        display_name = @displayName,
        email = @email,
        role = @role,
        is_guest = @isGuest,
        show_only_core_admin_permissions = @showOnlyCoreAdminPermissions,
        company_id = @companyId,
        status = @status,
        provisioning_source = @provisioningSource,
        access_state = @accessState,
        power_bi_access = 'none',
        power_bi_workspace_id = NULL,
        power_bi_report_id = NULL,
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId,
        displayName: nextName,
        email: nextEmail,
        role: normalizedRole,
        isGuest: nextIsGuest,
        showOnlyCoreAdminPermissions: nextShowOnlyCoreAdminPermissions,
        companyId: normalizedRole === 'supadmin' ? null : (normalizedRole === 'user' && nextIsGuest ? null : scopedCompanyId || null),
        status: body.status || target.status,
        provisioningSource: nextProvisioningSource,
        accessState: nextAccessState,
      }
    );

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
