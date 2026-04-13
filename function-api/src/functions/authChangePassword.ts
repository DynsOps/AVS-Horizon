import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { errorResponse } from '../lib/http';

export async function authChangePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await authenticateRequest(request);
    await request.text();
    return errorResponse(410, 'Password change is managed by Entra ID. Use the hosted Entra account settings.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/change-password failed', message);
    return errorResponse(500, message);
  }
}

app.http('auth-change-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/change-password',
  handler: authChangePassword,
});
