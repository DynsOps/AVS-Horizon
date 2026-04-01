import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { created, errorResponse } from '../lib/http';
import { buildAnalysisReportId, ensureAnalysisReportsTable, toPermissionSlug } from '../lib/analysisReports';

type CreateReportBody = {
  name?: string;
  description?: string;
  embedUrl?: string;
  workspaceId?: string;
  reportId?: string;
  datasetId?: string;
  defaultRoles?: string[];
};

export async function adminReportsCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:reports') || actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can manage reports.');
    }

    const body = (await request.json()) as CreateReportBody;
    const name = (body.name || '').trim();
    const description = (body.description || '').trim();
    const embedUrl = (body.embedUrl || '').trim();
    const workspaceId = (body.workspaceId || '').trim();
    const reportId = (body.reportId || '').trim();
    const datasetId = (body.datasetId || '').trim();
    const defaultRoles = Array.isArray(body.defaultRoles) ? body.defaultRoles.map((r) => String(r).trim()).filter(Boolean) : [];
    const defaultRolesCsv = defaultRoles.join(',');
    if (!name) return errorResponse(400, 'Report name is required.');

    const slug = toPermissionSlug(name);
    if (!slug) return errorResponse(400, 'Report name must include alphanumeric characters.');
    const permissionKey = `view:analysis-report:${slug}`;

    await ensureAnalysisReportsTable();

    const existing = await runQuery<{ count: number }>(
      `
      SELECT COUNT(1) AS count
      FROM dbo.analysis_reports
      WHERE LOWER(name) = @name OR permission_key = @permissionKey
      `,
      { name: name.toLowerCase(), permissionKey }
    );
    if ((existing.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'A report with the same name/permission already exists.');
    }

    const id = buildAnalysisReportId();
    await runQuery(
      `
      INSERT INTO dbo.analysis_reports (
        id,
        name,
        description,
        permission_key,
        embed_url,
        workspace_id,
        report_id,
        dataset_id,
        default_roles,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @name,
        @description,
        @permissionKey,
        @embedUrl,
        @workspaceId,
        @reportId,
        @datasetId,
        @defaultRoles,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
      )
      `,
      {
        id,
        name,
        description: description || null,
        permissionKey,
        embedUrl: embedUrl || null,
        workspaceId: workspaceId || null,
        reportId: reportId || null,
        datasetId: datasetId || null,
        defaultRoles: defaultRolesCsv || null,
      }
    );

    return created({
      report: {
        id,
        name,
        description: description || '',
        permissionKey,
        embedUrl: embedUrl || '',
        workspaceId: workspaceId || '',
        reportId: reportId || '',
        datasetId: datasetId || '',
        defaultRoles,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/reports create failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-reports-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'identity/reports',
  handler: adminReportsCreate,
});
