import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { sendTicketCreatedEmails } from '../lib/mail';

type TicketCategory = 'General' | 'Operational' | 'Invoice' | 'Technical';

export async function createSupportTicket(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await authenticateRequest(request);
    if (user.role === 'supadmin') {
      return errorResponse(403, 'Supadmin cannot create support tickets.');
    }
    if (!user.permissions.includes('create:support-ticket')) {
      return errorResponse(403, 'Missing permission: create:support-ticket');
    }

    const body = (await request.json()) as Partial<{ subject: string; description: string; category: TicketCategory }>;

    if (!body.subject || !body.description || !body.category) {
      return errorResponse(400, 'subject, description and category are required.');
    }

    const allowedCategories: TicketCategory[] = ['General', 'Operational', 'Invoice', 'Technical'];
    if (!allowedCategories.includes(body.category)) {
      return errorResponse(400, 'Invalid category.');
    }

    const ticketId = `TCK-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const subject = body.subject.trim();
    const description = body.description.trim();
    const category = body.category;
    const createdAt = new Date().toISOString();

    await runScopedQuery(
      { role: user.role, companyId: user.companyId, userId: user.id },
      `
      INSERT INTO dbo.support_tickets (
        id, created_by_user_id, created_by_email, subject, description, category, status, created_at
      ) VALUES (
        @id, @createdByUserId, @createdByEmail, @subject, @description, @category, 'Open', @createdAt
      )
      `,
      {
        id: ticketId,
        createdByUserId: user.id,
        createdByEmail: user.email,
        subject,
        description,
        category,
        createdAt,
      }
    );

    if (user.email) {
      void sendTicketCreatedEmails({
        ticketId,
        subject,
        category,
        createdAt,
        userName: user.name,
        userEmail: user.email,
      }).catch((err) => context.warn('ticket created email failed', err instanceof Error ? err.message : String(err)));
    }

    return created({
      ticket: {
        id: ticketId,
        createdByUserId: user.id,
        createdByEmail: user.email,
        subject,
        description,
        category,
        status: 'Open',
        createdAt,
        replies: [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('support/tickets create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('support-tickets-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'support/tickets',
  handler: createSupportTicket,
});
