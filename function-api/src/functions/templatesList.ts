import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function templatesList(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') {
      return errorResponse(403, 'Access denied.');
    }

    const scopeParam = (request.query.get('scope') || '').trim() || null;
    const companyIdParam = (request.query.get('company_id') || '').trim() || null;

    let whereClause = 'WHERE t.is_active = 1';
    const params: Record<string, string> = {};

    if (actor.role === 'admin') {
      whereClause += ' AND t.scope = @scope AND t.company_id = @companyId';
      params.scope = 'company';
      params.companyId = actor.activeCompanyId || '';
    } else if (scopeParam) {
      whereClause += ' AND t.scope = @scope';
      params.scope = scopeParam;
      if (companyIdParam) {
        whereClause += ' AND t.company_id = @companyId';
        params.companyId = companyIdParam;
      }
    }

    const res = await runQuery<{
      id: string; name: string; description: string | null;
      scope: string; company_id: string | null; permissions: string;
      created_at: string; updated_at: string;
    }>(
      `SELECT id, name, description, scope, company_id, permissions, created_at, updated_at
       FROM dbo.entitlement_templates t
       ${whereClause}
       ORDER BY scope, name`,
      params
    );

    const templates = res.recordset.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      scope: t.scope,
      companyId: t.company_id,
      permissions: (() => { try { return JSON.parse(t.permissions); } catch { return []; } })(),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return ok({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('templates/list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('templates-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/templates',
  handler: templatesList,
});
