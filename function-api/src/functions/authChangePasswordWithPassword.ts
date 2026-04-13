import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http';

export async function authChangePasswordWithPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await request.text();
    return errorResponse(410, 'Password change is managed by Entra ID. Use the hosted Entra account settings.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/change-password-password failed', message);
    return errorResponse(500, message);
  }
}

app.http('auth-change-password-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/change-password-password',
  handler: authChangePasswordWithPassword,
});
