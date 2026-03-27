import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { UserRole } from '../lib/rbac';

type TargetUser = { id: string; role: UserRole };

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

    const targetResult = await runQuery<TargetUser>(
      'SELECT TOP 1 id, role FROM dbo.users WHERE id = @userId',
      { userId }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'User not found.');

    if (!canManageRole(actor.role, target.role)) {
      return errorResponse(403, 'Only supadmin can delete supadmin users.');
    }

    await runQuery('DELETE FROM dbo.users WHERE id = @userId', { userId });
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
