import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';

type TicketCategory = 'General' | 'Operational' | 'Invoice' | 'Technical';

export async function createSupportTicket(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = await authenticateRequest(request);
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

    await runQuery(
      `
      INSERT INTO dbo.support_tickets (
        id,
        created_by_user_id,
        created_by_email,
        subject,
        description,
        category,
        status,
        created_at
      ) VALUES (
        @id,
        @createdByUserId,
        @createdByEmail,
        @subject,
        @description,
        @category,
        'Open',
        SYSUTCDATETIME()
      )
      `,
      {
        id: ticketId,
        createdByUserId: user.id,
        createdByEmail: user.email,
        subject: body.subject.trim(),
        description: body.description.trim(),
        category: body.category,
      }
    );

    return created({
      ticket: {
        id: ticketId,
        createdByUserId: user.id,
        createdByEmail: user.email,
        subject: body.subject.trim(),
        description: body.description.trim(),
        category: body.category,
        status: 'Open',
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
