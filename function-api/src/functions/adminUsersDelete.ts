import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { UserRole } from '../lib/rbac';

type TargetUser = { id: string; role: UserRole; companyId: string | null };

const canManageRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin') return targetRole !== 'supadmin';
  return false;
};

export async function deleteAdminUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    const userId = request.params.id;
    if (!userId) return errorResponse(400, 'User id is required.');

    const targetResult = await runScopedQuery<TargetUser>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      'SELECT TOP 1 id, role, company_id AS companyId FROM dbo.users WHERE id = @userId',
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
      return errorResponse(403, 'Only supadmin can delete supadmin users.');
    }

    await runScopedQuery(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      'DELETE FROM dbo.users WHERE id = @userId',
      { userId }
    );
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/users delete failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-users-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'identity/users/{id}',
  handler: deleteAdminUser,
});
