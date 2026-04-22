import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type CompanyRow = {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  dataAreaId: string | null;
  projId: string | null;
  status: 'Active' | 'Inactive';
  latestCreatedAt: string;
};

export async function listAdminCompanies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies') && !actor.permissions.includes('manage:users')) {
      return errorResponse(403, 'Missing permission: manage:companies/manage:users');
    }

    const isAdminActor = actor.role === 'admin';
    if (isAdminActor && actor.companyIds.length === 0) return ok({ companies: [] });

    let whereClause = '';
    let queryParams: Record<string, string> | undefined;

    if (isAdminActor) {
      const placeholders = actor.companyIds.map((_, i) => `@cid${i}`).join(', ');
      whereClause = `WHERE c.id IN (${placeholders})`;
      queryParams = {};
      actor.companyIds.forEach((id, i) => { queryParams![`cid${i}`] = id; });
    }

    const result = await runScopedQuery<CompanyRow>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      SELECT
        c.id,
        c.name,
        c.type,
        c.data_area_id AS dataAreaId,
        c.proj_id AS projId,
        c.status,
        MAX(c.created_at) AS latestCreatedAt
      FROM dbo.companies c
      ${whereClause}
      GROUP BY c.id, c.name, c.type, c.data_area_id, c.proj_id, c.status
      ORDER BY latestCreatedAt DESC
      `,
      queryParams
    );

    return ok({
      companies: result.recordset,
    });
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
