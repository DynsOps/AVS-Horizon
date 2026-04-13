import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { errorResponse } from '../lib/http';

export async function resetAdminUserPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:users');
    }

    await request.text();
    return errorResponse(410, 'Password reset is managed by Entra ID. Use the hosted Entra reset flow.');
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
