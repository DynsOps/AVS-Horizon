import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateCompanyBody = {
  name?: string;
  type?: 'Customer' | 'Supplier';
  country?: string;
  contactEmail?: string;
  status?: 'Active' | 'Inactive';
};

type CompanyRow = {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  country: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
};

export async function updateAdminCompany(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies')) {
      return errorResponse(403, 'Missing permission: manage:companies');
    }

    const companyId = request.params.id;
    if (!companyId) return errorResponse(400, 'Company id is required.');

    const currentResult = await runQuery<CompanyRow>(
      `
      SELECT TOP 1 id, name, type, country, contact_email AS contactEmail, status
      FROM dbo.companies
      WHERE id = @id
      `,
      { id: companyId }
    );
    const current = currentResult.recordset[0];
    if (!current) return errorResponse(404, 'Company not found.');

    const body = (await request.json()) as UpdateCompanyBody;
    const next = {
      name: (body.name || current.name).trim(),
      type: body.type || current.type,
      country: (body.country || current.country).trim(),
      contactEmail: (body.contactEmail || current.contactEmail).trim().toLowerCase(),
      status: body.status || current.status,
    };

    await runQuery(
      `
      UPDATE dbo.companies
      SET
        name = @name,
        type = @type,
        country = @country,
        contact_email = @contactEmail,
        status = @status,
        updated_at = SYSUTCDATETIME()
      WHERE id = @id
      `,
      { id: companyId, ...next }
    );

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/companies update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-companies-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'identity/companies/{id}',
  handler: updateAdminCompany,
});
