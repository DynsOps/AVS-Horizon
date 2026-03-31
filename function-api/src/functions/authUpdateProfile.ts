import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateProfileBody = {
  name?: string;
};

export async function authUpdateProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await authenticateRequest(request);
    const body = (await request.json()) as UpdateProfileBody;
    const name = (body.name || '').trim();

    if (!name) {
      return errorResponse(400, 'Name is required.');
    }

    await runQuery(
      `
      UPDATE dbo.users
      SET
        display_name = @name,
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId: user.id,
        name,
      }
    );

    return ok({
      user: {
        ...user,
        name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/profile update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('auth-update-profile', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'auth/profile',
  handler: authUpdateProfile,
});

