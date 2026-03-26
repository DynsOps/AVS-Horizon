import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest, touchLastLogin } from '../lib/auth';
import { errorResponse, ok } from '../lib/http';

export async function authMe(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await authenticateRequest(request);
    await touchLastLogin(user.id);
    return ok({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    context.warn('auth/me failed', message);
    return errorResponse(401, message);
  }
}

app.http('auth-me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: authMe,
});
