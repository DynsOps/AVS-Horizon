import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http';

export async function authUpdateProfilePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await request.text();
    return errorResponse(410, 'Public profile updates without Entra authentication are retired.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/profile-password failed', message);
    return errorResponse(500, message);
  }
}

app.http('auth-update-profile-password', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'auth/profile-password',
  handler: authUpdateProfilePassword,
});
