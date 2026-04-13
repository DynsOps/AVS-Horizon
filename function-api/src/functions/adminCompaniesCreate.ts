import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { normalizeDomain } from '../lib/identity';

type CreateCompanyBody = {
  name?: string;
  type?: 'Customer' | 'Supplier';
  country?: string;
  contactEmail?: string;
  status?: 'Active' | 'Inactive';
  domains?: string[];
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
    const country = (body.country || '').trim();
    const contactEmail = (body.contactEmail || '').trim().toLowerCase();
    const status = body.status || 'Active';
    const domains = Array.from(new Set((body.domains || []).map(normalizeDomain).filter(Boolean)));

    if (!name || !type || !country || !contactEmail) {
      return errorResponse(400, 'name, type, country and contactEmail are required.');
    }

    const prefix = type === 'Customer' ? 'C' : 'S';
    const id = `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

    await runQuery(
      `
      INSERT INTO dbo.companies (
        id, name, type, country, contact_email, status, created_at, updated_at
      ) VALUES (
        @id, @name, @type, @country, @contactEmail, @status, SYSUTCDATETIME(), SYSUTCDATETIME()
      )
      `,
      { id, name, type, country, contactEmail, status }
    );

    for (const domain of domains) {
      await runQuery(
        `
        INSERT INTO dbo.company_domains (id, company_id, domain, created_at, updated_at)
        VALUES (@id, @companyId, @domain, SYSUTCDATETIME(), SYSUTCDATETIME())
        `,
        {
          id: `CD-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
          companyId: id,
          domain,
        }
      );
    }

    return created({
      company: { id, name, type, country, contactEmail, status, domains },
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
