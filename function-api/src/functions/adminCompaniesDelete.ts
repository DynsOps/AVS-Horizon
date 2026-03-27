import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function deleteAdminCompany(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies')) {
      return errorResponse(403, 'Missing permission: manage:companies');
    }

    const companyId = request.params.id;
    if (!companyId) return errorResponse(400, 'Company id is required.');

    const inUseResult = await runQuery<{ count: number }>(
      'SELECT COUNT(1) AS count FROM dbo.users WHERE company_id = @companyId',
      { companyId }
    );
    if ((inUseResult.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'Company is assigned to existing users. Remove assignments first.');
    }

    await runQuery('DELETE FROM dbo.companies WHERE id = @companyId', { companyId });
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/companies delete failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-companies-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'identity/companies/{id}',
  handler: deleteAdminCompany,
});
