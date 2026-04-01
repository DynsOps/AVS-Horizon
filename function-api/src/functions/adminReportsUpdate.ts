import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ensureAnalysisReportsTable, toPermissionSlug } from '../lib/analysisReports';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';

type UpdateReportBody = {
  name?: string;
  description?: string;
  embedUrl?: string;
  workspaceId?: string;
  reportId?: string;
  datasetId?: string;
  defaultRoles?: string[];
};

type ReportRow = {
  id: string;
  name: string;
  description: string | null;
  permissionKey: string;
  embedUrl: string | null;
  workspaceId: string | null;
  reportId: string | null;
  datasetId: string | null;
  defaultRoles: string | null;
  isActive: boolean | number;
  createdAt: string;
};

export async function adminReportsUpdate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:reports') || actor.role !== 'supadmin') {
      return errorResponse(403, 'Only supadmin can manage reports.');
    }

    const id = request.params.id;
    if (!id) return errorResponse(400, 'Report id is required.');

    const body = (await request.json()) as UpdateReportBody;
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
    const nextPermissionKey = `view:analysis-report:${slug}`;

    await ensureAnalysisReportsTable();

    const targetResult = await runQuery<{ id: string; permissionKey: string }>(
      `
      SELECT TOP 1
        id,
        permission_key AS permissionKey
      FROM dbo.analysis_reports
      WHERE id = @id
      `,
      { id }
    );
    const target = targetResult.recordset[0];
    if (!target) return errorResponse(404, 'Report not found.');

    const duplicateResult = await runQuery<{ count: number }>(
      `
      SELECT COUNT(1) AS count
      FROM dbo.analysis_reports
      WHERE id <> @id AND (LOWER(name) = @name OR permission_key = @permissionKey)
      `,
      {
        id,
        name: name.toLowerCase(),
        permissionKey: nextPermissionKey,
      }
    );
    if ((duplicateResult.recordset[0]?.count || 0) > 0) {
      return errorResponse(409, 'A report with the same name/permission already exists.');
    }

    await runQuery(
      `
      UPDATE dbo.analysis_reports
      SET
        name = @name,
        description = @description,
        permission_key = @permissionKey,
        embed_url = @embedUrl,
        workspace_id = @workspaceId,
        report_id = @reportId,
        dataset_id = @datasetId,
        default_roles = @defaultRoles,
        updated_at = SYSUTCDATETIME()
      WHERE id = @id
      `,
      {
        id,
        name,
        description: description || null,
        permissionKey: nextPermissionKey,
        embedUrl: embedUrl || null,
        workspaceId: workspaceId || null,
        reportId: reportId || null,
        datasetId: datasetId || null,
        defaultRoles: defaultRolesCsv || null,
      }
    );

    if (target.permissionKey !== nextPermissionKey) {
      await runQuery(
        `
        UPDATE dbo.user_permissions
        SET permission = @nextPermission
        WHERE permission = @previousPermission
        `,
        {
          previousPermission: target.permissionKey,
          nextPermission: nextPermissionKey,
        }
      );
    }

    const updatedResult = await runQuery<ReportRow>(
      `
      SELECT TOP 1
        id,
        name,
        description,
        permission_key AS permissionKey,
        embed_url AS embedUrl,
        workspace_id AS workspaceId,
        report_id AS reportId,
        dataset_id AS datasetId,
        default_roles AS defaultRoles,
        is_active AS isActive,
        CONVERT(varchar(33), created_at, 127) AS createdAt
      FROM dbo.analysis_reports
      WHERE id = @id
      `,
      { id }
    );
    const updated = updatedResult.recordset[0];
    if (!updated) return errorResponse(404, 'Report not found after update.');

    return ok({
      report: {
        id: updated.id,
        name: updated.name,
        description: updated.description || '',
        permissionKey: updated.permissionKey,
        embedUrl: updated.embedUrl || '',
        workspaceId: updated.workspaceId || '',
        reportId: updated.reportId || '',
        datasetId: updated.datasetId || '',
        defaultRoles: (updated.defaultRoles || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        isActive: updated.isActive === true || updated.isActive === 1,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('identity/reports update failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('admin-reports-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'identity/reports/{id}',
  handler: adminReportsUpdate,
});
