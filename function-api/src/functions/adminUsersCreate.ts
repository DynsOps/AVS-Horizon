import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { createExternalLocalAccount, deleteExternalIdentityUser } from '../lib/externalIdentity';
import { created, errorResponse } from '../lib/http';
import { UserRole, getDefaultPermissionsForRole } from '../lib/rbac';
import {
  deriveAccessState,
  getIdentityProviderTypeForProvisioningSource,
  getProvisioningSourceForEmail,
  isPersonalEmailDomain,
  normalizeEmail,
  ProvisioningSource,
} from '../lib/identity';

type CreateUserRequest = {
  name: string;
  email: string;
  role: UserRole;
  isGuest?: boolean;
  showOnlyCoreAdminPermissions?: boolean;
  companyId?: string | null;
  status?: 'Active' | 'Inactive' | 'Suspended';
  permissions?: string[];
  provisioningMode?: 'corporate_precreated' | 'external_local_account';
};

const assertCanManageRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin' && targetRole !== 'supadmin') return true;
  return false;
};

const SUPADMIN_CONTROLLED_PERMISSIONS = new Set<string>([
  'system:settings',
  'view:finance',
  'view:sustainability',
  'view:business',
  'manage:reports',
]);

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

    const normalizedEmail = normalizeEmail(body.email);
    const role = body.role;
    const isAdminActor = actor.role === 'admin';
    const isGuest = role === 'user' ? Boolean(body.isGuest) : false;
    const showOnlyCoreAdminPermissions = role === 'admin' ? Boolean(body.showOnlyCoreAdminPermissions) : false;
    const companyId = body.companyId || null;
    const status = body.status || 'Active';

    if (isAdminActor) {
      if (!actor.companyId) {
        return errorResponse(403, 'Admin user is not linked to a company.');
      }
      if (role === 'user' && isGuest) {
        return errorResponse(403, 'Admin cannot create guest users.');
      }
      if (companyId && companyId !== actor.companyId) {
        return errorResponse(403, 'Admin can only create users for their own company.');
      }
    }

    const scopedCompanyId = isAdminActor ? actor.companyId : companyId;

    if ((role === 'user' && !isGuest && !scopedCompanyId) || (role === 'admin' && !scopedCompanyId)) {
      return errorResponse(400, 'Company is required for admin and non-guest user roles.');
    }

    const existsResult = await runScopedQuery<{ count: number }>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      'SELECT COUNT(1) AS count FROM dbo.users WHERE LOWER(email) = @email',
      { email: normalizedEmail }
    );

    if ((existsResult.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'A user with this email already exists.');
    }

    const userId = `u-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const effectivePermissions = body.permissions !== undefined
      ? body.permissions
      : getDefaultPermissionsForRole(role);
    const provisioningSource: ProvisioningSource = body.provisioningMode
      ? body.provisioningMode
      : getProvisioningSourceForEmail(normalizedEmail);

    if (provisioningSource === 'corporate_precreated' && isPersonalEmailDomain(normalizedEmail)) {
      return errorResponse(400, 'Personal email addresses must use external_local_account provisioning.');
    }

    if (actor.role === 'admin') {
      const actorPermissionSet = new Set(actor.permissions);
      const disallowedByActor = effectivePermissions.filter((permission) => !actorPermissionSet.has(permission));
      if (disallowedByActor.length > 0) {
        return errorResponse(403, `Admin can only grant permissions they already have: ${disallowedByActor.join(', ')}`);
      }
    }

    if (actor.role !== 'supadmin') {
      const disallowed = effectivePermissions.filter((permission) => SUPADMIN_CONTROLLED_PERMISSIONS.has(permission));
      if (disallowed.length > 0) {
        return errorResponse(403, `Only supadmin can grant controlled permissions: ${disallowed.join(', ')}`);
      }
    }

    let entraObjectId: string | null = null;
    let identityTenantId: string | null = null;
    let bootstrapCredentials: { email: string; temporaryPassword: string } | null = null;
    const identityProviderType = getIdentityProviderTypeForProvisioningSource(provisioningSource);

    if (provisioningSource === 'external_local_account') {
      const externalAccount = await createExternalLocalAccount({
        email: normalizedEmail,
        displayName: body.name.trim(),
      });
      entraObjectId = externalAccount.entraObjectId;
      identityTenantId = externalAccount.identityTenantId;
      bootstrapCredentials = {
        email: normalizedEmail,
        temporaryPassword: externalAccount.temporaryPassword,
      };
    }

    const accessState = deriveAccessState({
      provisioningSource,
      permissions: effectivePermissions,
      hasLinkedIdentity: Boolean(entraObjectId),
    });

    try {
      await runScopedQuery(
        { role: actor.role, companyId: actor.companyId, userId: actor.id },
        `
        INSERT INTO dbo.users (
          id,
          display_name,
          email,
          entra_object_id,
          role,
          is_guest,
          show_only_core_admin_permissions,
          company_id,
          status,
          provisioning_source,
          access_state,
          identity_provider_type,
          identity_tenant_id,
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
          @entraObjectId,
          @role,
          @isGuest,
          @showOnlyCoreAdminPermissions,
          @companyId,
          @status,
          @provisioningSource,
          @accessState,
          @identityProviderType,
          @identityTenantId,
          NULL,
          'none',
          NULL,
          NULL,
          SYSUTCDATETIME(),
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        )
        `,
        {
          id: userId,
          displayName: body.name.trim(),
          email: normalizedEmail,
          entraObjectId,
          role,
          isGuest,
          showOnlyCoreAdminPermissions,
          companyId: scopedCompanyId,
          status,
          provisioningSource,
          accessState,
          identityProviderType,
          identityTenantId,
        }
      );

      for (const permission of effectivePermissions) {
        await runScopedQuery(
          { role: actor.role, companyId: actor.companyId, userId: actor.id },
          'INSERT INTO dbo.user_permissions (user_id, permission) VALUES (@userId, @permission)',
          { userId, permission }
        );
      }
    } catch (error) {
      if (entraObjectId) {
        try {
          await deleteExternalIdentityUser(entraObjectId);
        } catch (cleanupError) {
          context.error('admin/users create external identity cleanup failed', cleanupError);
        }
      }
      throw error;
    }

    return created({
      user: {
        id: userId,
        name: body.name.trim(),
        email: normalizedEmail,
        role,
        isGuest,
        showOnlyCoreAdminPermissions,
        companyId: scopedCompanyId,
        status,
        permissions: effectivePermissions,
        provisioningSource,
        accessState,
        entraObjectId: entraObjectId || undefined,
        identityProviderType,
        identityTenantId: identityTenantId || undefined,
      },
      bootstrapCredentials,
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
