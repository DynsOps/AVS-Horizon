import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type CompanyRow = {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  country: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
};

export async function listAdminCompanies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies') && !actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:companies/manage:users');
    }

    const isAdminActor = actor.role === 'admin';
    if (isAdminActor && !actor.companyId) return ok({ companies: [] });

    const result = await runQuery<CompanyRow>(
      `
      SELECT
        id,
        name,
        type,
        country,
        contact_email AS contactEmail,
        status
      FROM dbo.companies
      ${isAdminActor ? 'WHERE id = @companyId' : ''}
      ORDER BY created_at DESC
      `,
      isAdminActor ? { companyId: actor.companyId } : undefined
    );

    return ok({ companies: result.recordset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/companies list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-companies-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/companies',
  handler: listAdminCompanies,
});
