import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { syncPermissions } from '../lib/permissionSync';

let syncDone = false;
async function ensureSynced() {
  if (!syncDone) {
    await syncPermissions();
    syncDone = true;
  }
}

type PermissionRow = { key: string; label: string; group_name: string; kind: string };

export async function permissionsCatalogList(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (actor.role !== 'supadmin' && actor.role !== 'admin') {
      return errorResponse(403, 'Access denied.');
    }

    await ensureSynced();

    const res = await runQuery<PermissionRow>(
      `SELECT [key], label, group_name, kind
       FROM dbo.permissions
       WHERE is_active = 1
       ORDER BY group_name, kind DESC, label`,
      {}
    );

    const grouped: Record<string, { key: string; label: string; kind: string }[]> = {};
    for (const row of res.recordset) {
      if (!grouped[row.group_name]) grouped[row.group_name] = [];
      grouped[row.group_name].push({ key: row.key, label: row.label, kind: row.kind });
    }

    return ok({ groups: grouped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('permissions/catalog failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('permissions-catalog-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'identity/permissions/catalog',
  handler: permissionsCatalogList,
});
