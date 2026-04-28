import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateTemplateBody = { name?: string; description?: string; permissions?: string[] };

export async function templatesUpdate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') {
      return errorResponse(403, 'Access denied.');
    }

    const id = request.params.id;
    if (!id) return errorResponse(400, 'Template id required.');

    const existing = await runQuery<{ id: string; scope: string; company_id: string | null }>(
      `SELECT id, scope, company_id FROM dbo.entitlement_templates WHERE id = @id AND is_active = 1`,
      { id }
    );
    if (!existing.recordset[0]) return errorResponse(404, 'Template not found.');

    const tpl = existing.recordset[0];
    if (actor.role === 'admin' && (tpl.scope !== 'company' || tpl.company_id !== actor.activeCompanyId)) {
      return errorResponse(403, 'Admin can only modify their own company templates.');
    }

    const body = (await request.json()) as UpdateTemplateBody;
    const name = (body.name || '').trim() || null;
    const description = body.description !== undefined ? body.description.trim() : undefined;
    const permissions = Array.isArray(body.permissions) ? body.permissions : undefined;

    if (actor.role === 'admin' && permissions) {
      const actorPerms = new Set(actor.permissions);
      const invalid = permissions.filter((p) => !actorPerms.has(p));
      if (invalid.length > 0) return errorResponse(403, `Cannot assign permissions not in your own set: ${invalid.join(', ')}`);
    }

    await runQuery(
      `UPDATE dbo.entitlement_templates
       SET name = COALESCE(@name, name),
           description = CASE WHEN @descriptionProvided = 1 THEN @description ELSE description END,
           permissions = CASE WHEN @permissionsProvided = 1 THEN @permissions ELSE permissions END,
           updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
      {
        id,
        name: name || null,
        description: description !== undefined ? description : null,
        descriptionProvided: description !== undefined ? 1 : 0,
        permissions: permissions ? JSON.stringify(permissions) : null,
        permissionsProvided: permissions !== undefined ? 1 : 0,
      }
    );

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('templates/update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('templates-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'identity/templates/{id}',
  handler: templatesUpdate,
});
