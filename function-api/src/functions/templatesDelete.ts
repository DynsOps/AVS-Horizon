import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function templatesDelete(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
      return errorResponse(403, 'Admin can only delete their own company templates.');
    }

    const companyAssigned = await runQuery<{ cnt: number }>(
      `SELECT COUNT(1) AS cnt FROM dbo.company_template_assignment WHERE template_id = @id`,
      { id }
    );
    const userAssigned = await runQuery<{ cnt: number }>(
      `SELECT COUNT(1) AS cnt FROM dbo.user_template_assignment WHERE template_id = @id`,
      { id }
    );
    if ((companyAssigned.recordset[0]?.cnt || 0) + (userAssigned.recordset[0]?.cnt || 0) > 0) {
      return errorResponse(409, 'Template is currently assigned and cannot be deleted. Reassign first.');
    }

    await runQuery(
      `UPDATE dbo.entitlement_templates SET is_active = 0, updated_at = SYSUTCDATETIME() WHERE id = @id`,
      { id }
    );

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('templates/delete failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('templates-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'identity/templates/{id}',
  handler: templatesDelete,
});
