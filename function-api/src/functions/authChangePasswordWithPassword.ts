import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { hashPassword, safeStringEqual, verifyPassword } from '../lib/password';

type ChangePasswordBody = {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

type PasswordRow = {
  id: string;
  passwordHash: string | null;
  temporaryPassword: string | null;
  status: 'Active' | 'Inactive' | 'Suspended';
};

const isStrongEnough = (password: string): boolean => {
  return password.length >= 8;
};

export async function authChangePasswordWithPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as ChangePasswordBody;
    const email = (body.email || '').trim().toLowerCase();
    const currentPassword = (body.currentPassword || '').trim();
    const newPassword = (body.newPassword || '').trim();

    if (!email || !currentPassword || !newPassword) {
      return errorResponse(400, 'Email, current and new password are required.');
    }
    if (!isStrongEnough(newPassword)) {
      return errorResponse(400, 'New password must be at least 8 characters.');
    }

    const result = await runQuery<PasswordRow>(
      `
      SELECT TOP 1
        id,
        password_hash AS passwordHash,
        temporary_password AS temporaryPassword,
        status
      FROM dbo.users
      WHERE LOWER(email) = @email
      `,
      { email }
    );

    const row = result.recordset[0];
    if (!row || row.status !== 'Active') {
      return errorResponse(401, 'Invalid credentials.');
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
        userId: row.id,
        passwordHash,
      }
    );

    return ok({ success: true });
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
