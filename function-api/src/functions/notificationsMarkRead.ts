import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

export async function markNotificationRead(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    const notificationId = request.params.id;
    if (!notificationId) return errorResponse(400, 'Notification id is required.');

    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };
    const result = await runScopedQuery<{ id: string; isRead: boolean }>(
      dbContext,
      `
      UPDATE dbo.user_notifications
      SET
        is_read = 1,
        read_at = COALESCE(read_at, SYSUTCDATETIME())
      OUTPUT INSERTED.id AS id, INSERTED.is_read AS isRead
      WHERE id = @id AND user_id = @userId
      `,
      { id: notificationId, userId: actor.id }
    );

    const updated = result.recordset[0];
    if (!updated) {
      return errorResponse(404, 'Notification not found.');
    }

    return ok({ notification: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('notifications mark read failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('notifications-mark-read', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'notifications/{id}/read',
  handler: markNotificationRead,
});
