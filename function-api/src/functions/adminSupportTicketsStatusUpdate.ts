import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type TicketStatus = 'Open' | 'In Progress' | 'Resolved';
type StatusUpdateBody = { status?: TicketStatus };

export async function updateAdminSupportTicketStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can update support ticket status.');
    }

    const ticketId = request.params.id;
    if (!ticketId) return errorResponse(400, 'Ticket id is required.');

    const body = (await request.json()) as StatusUpdateBody;
    const allowedStatuses: TicketStatus[] = ['Open', 'In Progress', 'Resolved'];
    if (!body.status || !allowedStatuses.includes(body.status)) {
      return errorResponse(400, 'Invalid status.');
    }

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const updateResult = await runScopedQuery<{ id: string; status: TicketStatus }>(
      dbContext,
      `
      UPDATE dbo.support_tickets
      SET status = @status
      OUTPUT INSERTED.id AS id, INSERTED.status AS status
      WHERE id = @ticketId
      `,
      { ticketId, status: body.status }
    );

    const updated = updateResult.recordset[0];
    if (!updated) {
      return errorResponse(404, 'Support ticket not found.');
    }

    return ok({ ticket: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('admin/support/tickets status update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-support-tickets-status-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'support/admin/tickets/{id}/status',
  handler: updateAdminSupportTicketStatus,
});
