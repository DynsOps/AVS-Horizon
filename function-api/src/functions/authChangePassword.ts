import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { hashPassword, safeStringEqual, verifyPassword } from '../lib/password';

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

type PasswordRow = {
  passwordHash: string | null;
  temporaryPassword: string | null;
};

const isStrongEnough = (password: string): boolean => {
  return password.length >= 8;
};

export async function authChangePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await authenticateRequest(request);
    const body = (await request.json()) as ChangePasswordBody;
    const currentPassword = (body.currentPassword || '').trim();
    const newPassword = (body.newPassword || '').trim();

    if (!currentPassword || !newPassword) {
      return errorResponse(400, 'Current and new password are required.');
    }
    if (!isStrongEnough(newPassword)) {
      return errorResponse(400, 'New password must be at least 8 characters.');
    }

    const result = await runQuery<PasswordRow>(
      `
      SELECT TOP 1
        password_hash AS passwordHash,
        temporary_password AS temporaryPassword
      FROM dbo.users
      WHERE id = @userId
      `,
      { userId: user.id }
    );

    const row = result.recordset[0];
    if (!row) {
      return errorResponse(404, 'User not found.');
    }

    const currentMatches = row.passwordHash
      ? verifyPassword(currentPassword, row.passwordHash)
      : Boolean(row.temporaryPassword && safeStringEqual(currentPassword, row.temporaryPassword));

    if (!currentMatches) {
      return errorResponse(400, 'Current password is incorrect.');
    }

    const newEqualsCurrent = row.passwordHash
      ? verifyPassword(newPassword, row.passwordHash)
      : Boolean(row.temporaryPassword && safeStringEqual(newPassword, row.temporaryPassword));

    if (newEqualsCurrent) {
      return errorResponse(400, 'New password must be different from current password.');
    }

    const passwordHash = hashPassword(newPassword);
    await runQuery(
      `
      UPDATE dbo.users
      SET
        password_hash = @passwordHash,
        temporary_password = NULL,
        password_last_changed_at = SYSUTCDATETIME(),
        updated_at = SYSUTCDATETIME()
      WHERE id = @userId
      `,
      {
        userId: user.id,
        passwordHash,
      }
    );

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('auth/change-password failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('auth-change-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/change-password',
  handler: authChangePassword,
});
