import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { UserRole } from '../lib/rbac';

type TargetUser = {
  id: string;
  role: UserRole;
  email: string;
  companyId: string | null;
};

const canManageRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin') return targetRole !== 'supadmin';
  return false;
};

export async function resetAdminUserPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const userId = request.params.id;
    if (!userId) return errorResponse(400, 'User id is required.');

    const targetResult = await runQuery<TargetUser>(
      'SELECT TOP 1 id, role, email, company_id AS companyId FROM dbo.users WHERE id = @userId',
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');

    if (actor.role === 'admin') {
      if (!actor.companyId) return errorResponse(403, 'Admin user is not linked to a company.');
      if (target.companyId !== actor.companyId) {
        return errorResponse(403, 'Admin can only manage users in their own company.');
      }
    }

    if (!canManageRole(actor.role, target.role)) {
      return errorResponse(403, 'Only supadmin can reset supadmin passwords.');
    }

    const temporaryPassword = `AVS-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    await runQuery(
      `
      UPDATE dbo.users
      SET
        temporary_password = @temporaryPassword,
        password_hash = NULL,
        password_last_changed_at = SYSUTCDATETIME(),
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId,
        temporaryPassword,
      }
    );

    return ok({
      userId: target.id,
      email: target.email,
      temporaryPassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/users reset-password failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-users-reset-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'identity/users/{id}/reset-password',
  handler: resetAdminUserPassword,
});
