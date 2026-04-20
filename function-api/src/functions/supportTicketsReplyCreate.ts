import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { errorResponse } from '../lib/http';

export async function createSupportTicketReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role === 'supadmin') {
      return errorResponse(403, 'Supadmin cannot post replies from user ticket flow.');
    }
    if (!actor.permissions.includes('create:support-ticket')) {
      return errorResponse(403, 'Missing permission: create:support-ticket');
    }

    return errorResponse(409, 'This ticket is closed for follow-up. Please create a new support ticket.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('support/tickets reply create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('support-tickets-reply-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'support/tickets/{id}/replies',
  handler: createSupportTicketReply,
});
