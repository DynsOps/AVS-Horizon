import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { invalidatePermissionCache } from '../lib/resolvePermissions';

export async function userTemplateAssign(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') return errorResponse(403, 'Access denied.');

    const userId = request.params.userId;
    if (!userId) return errorResponse(400, 'userId required.');

    const body = (await request.json()) as { templateId?: string };
    const templateId = (body.templateId || '').trim();
    if (!templateId) return errorResponse(400, 'templateId required.');

    const targetUser = await runQuery<{ id: string; company_id: string | null; role: string }>(
      `SELECT id, company_id, role FROM dbo.users WHERE id = @userId AND status = 'Active'`,
      { userId }
    );
    if (!targetUser.recordset[0]) return errorResponse(404, 'User not found.');
    if (targetUser.recordset[0].role !== 'user') return errorResponse(400, 'Can only assign templates to role=user.');

    if (actor.role === 'admin' && targetUser.recordset[0].company_id !== actor.activeCompanyId) {
      return errorResponse(403, 'Admin can only manage users in their active company.');
    }

    const tpl = await runQuery<{ id: string; scope: string; company_id: string | null; permissions: string }>(
      `SELECT id, scope, company_id, permissions FROM dbo.entitlement_templates WHERE id = @templateId AND is_active = 1`,
      { templateId }
    );
    if (!tpl.recordset[0]) return errorResponse(404, 'Template not found.');
    if (tpl.recordset[0].scope !== 'company') return errorResponse(400, 'User must be assigned a company-scope template.');

    const targetCompany = actor.role === 'admin' ? actor.activeCompanyId : targetUser.recordset[0].company_id;
    if (tpl.recordset[0].company_id !== targetCompany) {
      return errorResponse(403, 'Template does not belong to the target company.');
    }

    if (actor.role === 'admin') {
      const tplPerms: string[] = (() => { try { return JSON.parse(tpl.recordset[0].permissions); } catch { return []; } })();
      const actorPerms = new Set(actor.permissions);
      const invalid = tplPerms.filter((p) => !actorPerms.has(p));
      if (invalid.length > 0) return errorResponse(403, `Template contains permissions beyond your own: ${invalid.join(', ')}`);
    }

    await runQuery(
      `MERGE dbo.user_template_assignment AS target
       USING (SELECT @userId AS user_id, @templateId AS template_id) AS source
         ON target.user_id = source.user_id
       WHEN MATCHED THEN
         UPDATE SET template_id = source.template_id, assigned_by_user_id = @actorId, updated_at = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (user_id, template_id, assigned_by_user_id, assigned_at, updated_at)
         VALUES (source.user_id, source.template_id, @actorId, SYSUTCDATETIME(), SYSUTCDATETIME());`,
      { userId, templateId, actorId: actor.id }
    );

    invalidatePermissionCache(userId);

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user/template-assign failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('user-template-assign', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'identity/users/{userId}/template',
  handler: userTemplateAssign,
});

export async function userTemplateGet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') return errorResponse(403, 'Access denied.');

    const userId = request.params.userId;
    if (!userId) return errorResponse(400, 'userId required.');

    const res = await runQuery<{ templateId: string }>(
      `SELECT template_id AS templateId FROM dbo.user_template_assignment WHERE user_id = @userId`,
      { userId }
    );
    const templateId = res.recordset[0]?.templateId ?? null;
    return ok({ templateId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('user/template-get failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('user-template-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/users/{userId}/template',
  handler: userTemplateGet,
});
