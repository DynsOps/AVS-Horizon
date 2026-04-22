import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function getAdminSupportTicketsOpenCount(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can access this endpoint.');
    }

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const result = await runScopedQuery<{ count: number }>(
      dbContext,
      `SELECT COUNT(*) AS count FROM dbo.support_tickets WHERE status = 'Open'`
    );

    return ok({ count: result.recordset[0]?.count ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('admin/support/tickets open-count failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-support-tickets-open-count', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'support/admin/tickets/open-count',
  handler: getAdminSupportTicketsOpenCount,
});
