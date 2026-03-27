import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { safeStringEqual, verifyPassword } from '../lib/password';

type LoginPasswordBody = {
  email?: string;
  password?: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'supadmin' | 'admin' | 'user';
  isGuest: boolean;
  companyId: string | null;
  status: 'Active' | 'Inactive' | 'Suspended';
  powerBiAccess: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId: string | null;
  powerBiReportId: string | null;
  lastLogin: string | null;
  passwordHash: string | null;
  temporaryPassword: string | null;
};

export async function authLoginPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as LoginPasswordBody;
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!email || !password) {
      return errorResponse(400, 'Email and password are required.');
    }

    const userResult = await runQuery<UserRow>(
      `
      SELECT TOP 1
        id,
        display_name AS name,
        email,
        role,
        is_guest AS isGuest,
        company_id AS companyId,
        status,
        power_bi_access AS powerBiAccess,
        power_bi_workspace_id AS powerBiWorkspaceId,
        power_bi_report_id AS powerBiReportId,
        CONVERT(varchar(33), last_login_at, 127) AS lastLogin,
        password_hash AS passwordHash,
        temporary_password AS temporaryPassword
      FROM dbo.users
      WHERE LOWER(email) = @email
      `,
      { email }
    );

    const row = userResult.recordset[0];
    if (!row || row.status !== 'Active') {
      return errorResponse(401, 'Invalid email or password.');
    }

    const passwordMatches = row.passwordHash
      ? verifyPassword(password, row.passwordHash)
      : Boolean(row.temporaryPassword && safeStringEqual(password, row.temporaryPassword));

    if (!passwordMatches) {
      return errorResponse(401, 'Invalid email or password.');
    }

    const permissionsResult = await runQuery<{ permission: string }>(
      'SELECT permission FROM dbo.user_permissions WHERE user_id = @userId',
      { userId: row.id }
    );
    const permissions = permissionsResult.recordset.map((p) => p.permission);

    await runQuery(
      'UPDATE dbo.users SET last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @userId',
      { userId: row.id }
    );

    return ok({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        isGuest: row.isGuest,
        companyId: row.companyId || '',
        status: row.status,
        permissions,
        powerBiAccess: row.powerBiAccess,
        powerBiWorkspaceId: row.powerBiWorkspaceId || '',
        powerBiReportId: row.powerBiReportId || '',
        lastLogin: row.lastLogin,
      },
    });
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
