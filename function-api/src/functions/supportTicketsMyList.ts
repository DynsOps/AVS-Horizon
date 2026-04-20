import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type TicketStatus = 'Open' | 'In Progress' | 'Resolved';
type TicketCategory = 'General' | 'Operational' | 'Invoice' | 'Technical';

type SupportTicketRow = {
  id: string;
  createdByUserId: string;
  createdByEmail: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: string;
};

type SupportTicketReplyRow = {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorRole: 'supadmin' | 'admin' | 'user';
  message: string;
  createdAt: string;
};

export async function listMySupportTickets(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const ticketsResult = await runScopedQuery<SupportTicketRow>(
      dbContext,
      `
      SELECT
        t.id,
        t.created_by_user_id AS createdByUserId,
        t.created_by_email AS createdByEmail,
        t.subject,
        t.description,
        t.category,
        t.status,
        CONVERT(varchar(33), t.created_at, 127) AS createdAt
      FROM dbo.support_tickets t
      WHERE t.created_by_user_id = @userId
      ORDER BY t.created_at DESC
      `,
      { userId: actor.id }
    );

    const repliesResult = await runScopedQuery<SupportTicketReplyRow>(
      dbContext,
      `
      SELECT
        r.id,
        r.ticket_id AS ticketId,
        r.author_user_id AS authorUserId,
        r.author_role AS authorRole,
        r.message,
        CONVERT(varchar(33), r.created_at, 127) AS createdAt
      FROM dbo.support_ticket_replies r
      INNER JOIN dbo.support_tickets t ON t.id = r.ticket_id
      WHERE t.created_by_user_id = @userId
      ORDER BY r.created_at ASC
      `,
      { userId: actor.id }
    );

    const repliesByTicket = new Map<string, SupportTicketReplyRow[]>();
    for (const reply of repliesResult.recordset) {
      const next = repliesByTicket.get(reply.ticketId) || [];
      next.push(reply);
      repliesByTicket.set(reply.ticketId, next);
    }

    return ok({
      tickets: ticketsResult.recordset.map((ticket) => ({
        ...ticket,
        createdByEmail: ticket.createdByEmail || undefined,
        replies: repliesByTicket.get(ticket.id) || [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('support/tickets/me list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('support-tickets-my-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'support/tickets/me',
  handler: listMySupportTickets,
});
