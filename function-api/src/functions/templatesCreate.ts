import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { randomUUID } from 'crypto';

type CreateTemplateBody = {
  name?: string;
  description?: string;
  scope?: string;
  companyId?: string;
  permissions?: string[];
};

export async function templatesCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') {
      return errorResponse(403, 'Access denied.');
    }

    const body = (await request.json()) as CreateTemplateBody;
    const name = (body.name || '').trim();
    const description = (body.description || '').trim();
    const scope = (body.scope || '').trim();
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!name) return errorResponse(400, 'Template name is required.');
    if (!['global', 'company'].includes(scope)) return errorResponse(400, "scope must be 'global' or 'company'.");

    if (actor.role === 'admin') {
      if (scope !== 'company') return errorResponse(403, 'Admin can only create company-scope templates.');
      if (!actor.activeCompanyId) return errorResponse(400, 'No active company.');
      const actorPerms = new Set(actor.permissions);
      const invalid = permissions.filter((p) => !actorPerms.has(p));
      if (invalid.length > 0) return errorResponse(403, `Cannot assign permissions not in your own set: ${invalid.join(', ')}`);
    }

    const companyId = scope === 'company'
      ? (actor.role === 'admin' ? actor.activeCompanyId : (body.companyId || null))
      : null;
    if (scope === 'company' && !companyId) return errorResponse(400, 'companyId is required for company-scope templates.');

    const id = `TPL-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    await runQuery(
      `INSERT INTO dbo.entitlement_templates (id, name, description, scope, company_id, permissions, created_by_user_id, is_active)
       VALUES (@id, @name, @description, @scope, @companyId, @permissions, @createdBy, 1)`,
      {
        id,
        name,
        description: description || null,
        scope,
        companyId: companyId || null,
        permissions: JSON.stringify(permissions),
        createdBy: actor.id,
      }
    );

    return created({ template: { id, name, description, scope, companyId, permissions } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('templates/create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('templates-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'identity/templates',
  handler: templatesCreate,
});
