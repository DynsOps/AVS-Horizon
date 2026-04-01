import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { listAnalysisReports } from '../lib/analysisReports';
import { errorResponse, ok } from '../lib/http';

export async function adminReportsList(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:users') && !actor.permissions.includes('manage:reports')) {
      return errorResponse(403, 'Missing permission: manage:users/manage:reports');
    }

    const reports = await listAnalysisReports();
    return ok({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/reports list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-reports-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/reports',
  handler: adminReportsList,
});
