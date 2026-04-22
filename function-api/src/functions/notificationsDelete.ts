import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function deleteNotification(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    const notificationId = request.params.id;
    if (!notificationId) return errorResponse(400, 'Notification id is required.');

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const result = await runScopedQuery<{ id: string }>(
      dbContext,
      `
      DELETE FROM dbo.user_notifications
      OUTPUT DELETED.id AS id
      WHERE id = @id AND user_id = @userId
      `,
      { id: notificationId, userId: actor.id }
    );

    if (!result.recordset[0]) {
      return errorResponse(404, 'Notification not found.');
    }

    return ok({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('notifications delete failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('notifications-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'notifications/{id}',
  handler: deleteNotification,
});
