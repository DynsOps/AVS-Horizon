import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http';

export async function authLoginPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await request.text();
    return errorResponse(410, 'Password login is managed by Entra ID. Use the hosted Entra sign-in flow.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/login-password failed', message);
    return errorResponse(500, message);
  }
}

app.http('auth-login-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login-password',
  handler: authLoginPassword,
});
