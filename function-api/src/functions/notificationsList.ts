import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  targetRoute: string;
  isRead: boolean;
  createdAt: string;
};

export async function listNotifications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    const dbContext = { role: actor.role, companyId: actor.companyId, userId: actor.id };

    const result = await runScopedQuery<NotificationRow>(
      dbContext,
      `
      SELECT
        id,
        title,
        message,
        target_route AS targetRoute,
        is_read AS isRead,
        CONVERT(varchar(33), created_at, 127) AS createdAt
      FROM dbo.user_notifications
      WHERE user_id = @userId
      ORDER BY created_at DESC
      `,
      { userId: actor.id }
    );

    return ok({ notifications: result.recordset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('notifications list failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('notifications-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications',
  handler: listNotifications,
});
