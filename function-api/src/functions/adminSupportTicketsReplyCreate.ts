import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { sendTicketRepliedEmail } from '../lib/mail';

type ReplyCreateBody = {
  message?: string;
};

type TicketRow = {
  id: string;
  subject: string;
  createdByUserId: string;
  createdByEmail: string | null;
  creatorName: string | null;
  status: 'Open' | 'Resolved';
};

export async function createAdminSupportTicketReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can reply to support tickets.');
    }

    const ticketId = request.params.id;
    if (!ticketId) return errorResponse(400, 'Ticket id is required.');

    const body = (await request.json()) as ReplyCreateBody;
    const message = (body.message || '').trim();
    if (!message) {
      return errorResponse(400, 'message is required.');
    }

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const ticketResult = await runScopedQuery<TicketRow>(
      dbContext,
      `
      SELECT TOP 1
        t.id,
        t.subject,
        t.created_by_user_id AS createdByUserId,
        t.created_by_email AS createdByEmail,
        u.display_name AS creatorName,
        t.status
      FROM dbo.support_tickets t
      LEFT JOIN dbo.users u ON u.id = t.created_by_user_id
      WHERE t.id = @id
      `,
      { id: ticketId }
    );

    const ticket = ticketResult.recordset[0];
    if (!ticket) {
      return errorResponse(404, 'Support ticket not found.');
    }
    if (ticket.status === 'Resolved') {
      return errorResponse(409, 'Support ticket is already resolved.');
    }

    const replyId = `REP-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const notificationId = `NTF-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    await runScopedQuery(
      dbContext,
      `
      INSERT INTO dbo.support_ticket_replies (
        id, ticket_id, author_user_id, author_role, message, created_at
      ) VALUES (
        @id, @ticketId, @authorUserId, @authorRole, @message, SYSUTCDATETIME()
      );

      UPDATE dbo.support_tickets
      SET status = 'Resolved'
      WHERE id = @ticketId;

      INSERT INTO dbo.user_notifications (
        id, user_id, notification_type, title, message, target_route, is_read, created_at
      ) VALUES (
        @notificationId, @notificationUserId, 'support_ticket_reply',
        'Support ticket resolved', @notificationMessage, '/support/tickets', 0, SYSUTCDATETIME()
      );
      `,
      {
        id: replyId,
        ticketId,
        authorUserId: actor.id,
        authorRole: actor.role,
        message,
        notificationId,
        notificationUserId: ticket.createdByUserId,
        notificationMessage: `Your ticket ${ticketId} has been resolved with a response.`,
      }
    );

    if (ticket.createdByEmail) {
      void sendTicketRepliedEmail({
        ticketId,
        subject: ticket.subject,
        replyMessage: message,
        userName: ticket.creatorName || ticket.createdByEmail,
        userEmail: ticket.createdByEmail,
      }).catch((err) => context.warn('ticket replied email failed', err instanceof Error ? err.message : String(err)));
    }

    return created({
      reply: {
        id: replyId,
        ticketId,
        authorUserId: actor.id,
        authorRole: actor.role,
        message,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('admin/support/tickets reply create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-support-tickets-reply-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'support/admin/tickets/{id}/replies',
  handler: createAdminSupportTicketReply,
});
