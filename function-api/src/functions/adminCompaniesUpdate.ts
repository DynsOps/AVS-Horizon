import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateCompanyBody = {
  name?: string;
  type?: 'Customer' | 'Supplier';
  dataAreaId?: string;
  projId?: string;
  status?: 'Active' | 'Inactive';
};

type CompanyRow = {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  dataAreaId: string | null;
  projId: string | null;
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

    const currentResult = await runScopedQuery<CompanyRow>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      SELECT TOP 1 id, name, type, data_area_id AS dataAreaId, proj_id AS projId, status
      FROM dbo.companies
      WHERE id = @id
      `,
      { id: companyId }
    );
    const current = currentResult.recordset[0];
    if (!current) return errorResponse(404, 'Company not found.');
    if (actor.role === 'admin') {
      if (!actor.companyId) return errorResponse(403, 'Admin user is not linked to a company.');
      if (current.id !== actor.companyId) {
        return errorResponse(403, 'Admin can only manage their own company.');
      }
    }

    const body = (await request.json()) as UpdateCompanyBody;
    const next = {
      name: (body.name || current.name).trim(),
      type: body.type || current.type,
      dataAreaId:
        body.dataAreaId !== undefined
          ? (body.dataAreaId || '').trim() || null
          : current.dataAreaId,
      projId:
        body.projId !== undefined
          ? (body.projId || '').trim() || null
          : current.projId,
      status: body.status || current.status,
    };

    await runScopedQuery(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      UPDATE dbo.companies
      SET
        name = @name,
        type = @type,
        data_area_id = @dataAreaId,
        proj_id = @projId,
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
