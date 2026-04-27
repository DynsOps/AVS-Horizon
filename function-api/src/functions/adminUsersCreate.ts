import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { env } from '../lib/env';
import { createExternalLocalAccount, deleteExternalIdentityUser } from '../lib/externalIdentity';
import { created, errorResponse } from '../lib/http';
import { sendWelcomeCredentialsEmail } from '../lib/mail';
import { UserRole, getDefaultPermissionsForRole } from '../lib/rbac';
import {
  deriveAccessState,
  getIdentityProviderTypeForProvisioningSource,
  getProvisioningSourceForEmail,
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
  provisioningMode?: 'external_local_account';
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
const COMPANY_ADMIN_BASE_PERMISSIONS = new Set(['view:dashboard', 'view:reports', 'create:support-ticket']);

const getCompanyAdminAllowedPermissions = (actorPermissions: string[]): Set<string> => {
  const actorReportPermissions = actorPermissions.filter((permission) => permission.startsWith('view:analysis-report:'));
  return new Set([...COMPANY_ADMIN_BASE_PERMISSIONS, ...actorReportPermissions]);
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

    const normalizedEmail = normalizeEmail(body.email);
    const role = body.role;
    const isAdminActor = actor.role === 'admin';
    if (isAdminActor && role !== 'user') {
      return errorResponse(403, 'Admin can only manage standard user accounts.');
    }
    const normalizedRole: UserRole = isAdminActor ? 'user' : role;
    const isGuest = isAdminActor ? false : (role === 'user' ? Boolean(body.isGuest) : false);
    const showOnlyCoreAdminPermissions = isAdminActor ? false : (role === 'admin' ? Boolean(body.showOnlyCoreAdminPermissions) : false);
    const companyId = body.companyId || null;
    const status = body.status || 'Active';

    if (isAdminActor) {
      if (actor.companyIds.length === 0) {
        return errorResponse(403, 'Admin user is not linked to any company.');
      }
      if (body.isGuest) {
        return errorResponse(403, 'Admin cannot create guest users.');
      }
      if (companyId && !actor.companyIds.includes(companyId)) {
        return errorResponse(403, 'Admin can only create users for their own companies.');
      }
    }

    const scopedCompanyId = isAdminActor ? (companyId || actor.companyIds[0]) : companyId;

    if ((normalizedRole === 'user' && !isGuest && !scopedCompanyId) || (normalizedRole === 'admin' && !scopedCompanyId)) {
      return errorResponse(400, 'Company is required for admin and non-guest user roles.');
    }

    const existsResult = await runScopedQuery<{ count: number }>(
      { role: 'user', internalBypass: true },
      'SELECT COUNT(1) AS count FROM dbo.users WHERE LOWER(email) = @email',
      { email: normalizedEmail }
    );

    if ((existsResult.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'A user with this email already exists.');
    }

    const userId = `u-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const requestedPermissions = body.permissions !== undefined
      ? body.permissions
      : getDefaultPermissionsForRole(normalizedRole);
    if (isAdminActor) {
      const allowedPermissions = getCompanyAdminAllowedPermissions(actor.permissions);
      const disallowedByRole = requestedPermissions.filter((permission) => !allowedPermissions.has(permission));
      if (disallowedByRole.length > 0) {
        return errorResponse(403, 'Admin can only grant user-role permissions.');
      }
    }
    const effectivePermissions = isAdminActor
      ? requestedPermissions.filter((permission) => getCompanyAdminAllowedPermissions(actor.permissions).has(permission))
      : requestedPermissions;
    const provisioningSource: ProvisioningSource = isAdminActor
      ? 'external_local_account'
      : (body.provisioningMode
      ? body.provisioningMode
      : getProvisioningSourceForEmail(normalizedEmail));

    if (actor.role !== 'supadmin') {
      const disallowed = effectivePermissions.filter((permission) => SUPADMIN_CONTROLLED_PERMISSIONS.has(permission));
      if (disallowed.length > 0) {
        return errorResponse(403, `Only supadmin can grant controlled permissions: ${disallowed.join(', ')}`);
      }
    }

    let entraObjectId: string | null = null;
    let identityTenantId: string | null = null;
    let bootstrapCredentials: { email: string; temporaryPassword: string } | null = null;
    let welcomeEmailStatus: { sent: boolean; error?: string } | null = null;
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
          role: normalizedRole,
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

    if (bootstrapCredentials) {
      try {
        context.info('admin/users create welcome email sending', {
          sender: env.mailSender,
          recipient: normalizedEmail,
          userId,
        });
        await sendWelcomeCredentialsEmail({
          email: normalizedEmail,
          displayName: body.name.trim(),
          temporaryPassword: bootstrapCredentials.temporaryPassword,
        });
        welcomeEmailStatus = { sent: true };
        context.info('admin/users create welcome email sent', {
          sender: env.mailSender,
          recipient: normalizedEmail,
          userId,
        });
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : 'Welcome email could not be delivered.';
        welcomeEmailStatus = { sent: false, error: message };
        context.warn('admin/users create welcome email failed', {
          sender: env.mailSender,
          recipient: normalizedEmail,
          userId,
          error: message,
        });
      }
    }

    return created({
      user: {
        id: userId,
        name: body.name.trim(),
        email: normalizedEmail,
        role: normalizedRole,
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
      notifications: welcomeEmailStatus ? { welcomeEmail: welcomeEmailStatus } : undefined,
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
