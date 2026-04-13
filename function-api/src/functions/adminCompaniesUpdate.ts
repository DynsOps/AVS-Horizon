import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery, runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { normalizeDomain } from '../lib/identity';

type UpdateCompanyBody = {
  name?: string;
  type?: 'Customer' | 'Supplier';
  country?: string;
  contactEmail?: string;
  status?: 'Active' | 'Inactive';
  domains?: string[];
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

    const currentResult = await runScopedQuery<CompanyRow>(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      `
      SELECT TOP 1 id, name, type, country, contact_email AS contactEmail, status
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
      country: (body.country || current.country).trim(),
      contactEmail: (body.contactEmail || current.contactEmail).trim().toLowerCase(),
      status: body.status || current.status,
    };
    const nextDomains = body.domains
      ? Array.from(new Set(body.domains.map(normalizeDomain).filter(Boolean)))
      : null;

    await runScopedQuery(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
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

    if (nextDomains) {
      await runQuery('DELETE FROM dbo.company_domains WHERE company_id = @companyId', { companyId });
      for (const domain of nextDomains) {
        await runQuery(
          `
          INSERT INTO dbo.company_domains (id, company_id, domain, created_at, updated_at)
          VALUES (@id, @companyId, @domain, SYSUTCDATETIME(), SYSUTCDATETIME())
          `,
          {
            id: `CD-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
            companyId,
            domain,
          }
        );
      }
    }

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
