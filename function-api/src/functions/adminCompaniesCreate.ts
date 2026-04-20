import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';

type CreateCompanyBody = {
  name?: string;
  type?: 'Customer' | 'Supplier';
  dataAreaId?: string;
  projId?: string;
  status?: 'Active' | 'Inactive';
};

export async function createAdminCompany(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies')) {
      return errorResponse(403, 'Missing permission: manage:companies');
    }
    if (actor.role === 'admin') {
      return errorResponse(403, 'Admin cannot create companies.');
    }

    const body = (await request.json()) as CreateCompanyBody;
    const name = (body.name || '').trim();
    const type = body.type;
    const dataAreaId = (body.dataAreaId || '').trim();
    const projId = (body.projId || '').trim();
    const status = body.status || 'Active';

    if (!name || !type || !dataAreaId || !projId) {
      return errorResponse(400, 'name, type, dataAreaId and projId are required.');
    }

    const prefix = type === 'Customer' ? 'C' : 'S';
    const id = `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

    await runQuery(
      `
      INSERT INTO dbo.companies (
        id, name, type, data_area_id, proj_id, status, created_at, updated_at
      ) VALUES (
        @id, @name, @type, @dataAreaId, @projId, @status, SYSUTCDATETIME(), SYSUTCDATETIME()
      )
      `,
      { id, name, type, dataAreaId, projId, status }
    );

    return created({
      company: {
        id,
        name,
        type,
        dataAreaId,
        projId,
        status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/companies create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-companies-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'identity/companies',
  handler: createAdminCompany,
});
