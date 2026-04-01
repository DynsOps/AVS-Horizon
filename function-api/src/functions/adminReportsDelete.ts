import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { ensureAnalysisReportsTable } from '../lib/analysisReports';
import { errorResponse, ok } from '../lib/http';

export async function adminReportsDelete(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:reports') || actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can manage reports.');
    }

    const id = request.params.id;
    if (!id) return errorResponse(400, 'Report id is required.');

    await ensureAnalysisReportsTable();

    const targetResult = await runQuery<{ id: string; permissionKey: string }>(
      `
      SELECT TOP 1
        id,
        permission_key AS permissionKey
      FROM dbo.analysis_reports
      WHERE id = @id
      `,
      { id }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'Report not found.');

    await runQuery('DELETE FROM dbo.user_permissions WHERE permission = @permission', { permission: target.permissionKey });
    await runQuery('DELETE FROM dbo.analysis_reports WHERE id = @id', { id });

    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/reports delete failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-reports-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'identity/reports/{id}',
  handler: adminReportsDelete,
});
