import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function companyTemplateAssign(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin') return errorResponse(403, 'Only supadmin can assign company templates.');

    const companyId = request.params.companyId;
    if (!companyId) return errorResponse(400, 'companyId required.');

    const body = (await request.json()) as { templateId?: string };
    const templateId = (body.templateId || '').trim();
    if (!templateId) return errorResponse(400, 'templateId required.');

    const tpl = await runQuery<{ id: string; scope: string }>(
      `SELECT id, scope FROM dbo.entitlement_templates WHERE id = @templateId AND is_active = 1`,
      { templateId }
    );
    if (!tpl.recordset[0]) return errorResponse(404, 'Template not found.');
    if (tpl.recordset[0].scope !== 'global') return errorResponse(400, 'Company must be assigned a global-scope template.');

    await runQuery(
      `MERGE dbo.company_template_assignment AS target
       USING (SELECT @companyId AS company_id, @templateId AS template_id) AS source
         ON target.company_id = source.company_id
       WHEN MATCHED THEN
         UPDATE SET template_id = source.template_id, assigned_by_user_id = @actorId, updated_at = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (company_id, template_id, assigned_by_user_id, assigned_at, updated_at)
         VALUES (source.company_id, source.template_id, @actorId, SYSUTCDATETIME(), SYSUTCDATETIME());`,
      { companyId, templateId, actorId: actor.id }
    );

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('company/template-assign failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('company-template-assign', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'identity/companies/{companyId}/template',
  handler: companyTemplateAssign,
});

export async function companyTemplateGet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin') return errorResponse(403, 'Only supadmin can view company templates.');

    const companyId = request.params.companyId;
    if (!companyId) return errorResponse(400, 'companyId required.');

    const res = await runQuery<{ templateId: string }>(
      `SELECT template_id AS templateId FROM dbo.company_template_assignment WHERE company_id = @companyId`,
      { companyId }
    );
    const templateId = res.recordset[0]?.templateId ?? null;
    return ok({ templateId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('company/template-get failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('company-template-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/companies/{companyId}/template',
  handler: companyTemplateGet,
});
