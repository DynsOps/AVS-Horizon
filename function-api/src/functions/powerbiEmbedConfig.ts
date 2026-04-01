import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { ensureAnalysisReportsTable } from '../lib/analysisReports';
import { runQuery } from '../lib/db';
import { errorResponse, ok } from '../lib/http';
import { generateReportEmbedToken } from '../lib/powerbi';

type EmbedConfigBody = {
  reportConfigId?: string;
};

type ReportRow = {
  id: string;
  name: string;
  permissionKey: string;
  workspaceId: string | null;
  reportId: string | null;
  datasetId: string | null;
  defaultRoles: string | null;
};

export async function powerBiEmbedConfig(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('view:reports')) {
      return errorResponse(403, 'Missing permission: view:reports');
    }

    const body = (await request.json()) as EmbedConfigBody;
    const reportConfigId = (body.reportConfigId || '').trim();
    if (!reportConfigId) return errorResponse(400, 'reportConfigId is required.');

    await ensureAnalysisReportsTable();

    const reportResult = await runQuery<ReportRow>(
      `
      SELECT TOP 1
        id,
        name,
        permission_key AS permissionKey,
        workspace_id AS workspaceId,
        report_id AS reportId,
        dataset_id AS datasetId,
        default_roles AS defaultRoles
      FROM dbo.analysis_reports
      WHERE id = @id AND is_active = 1
      `,
      { id: reportConfigId }
    );
    const report = reportResult.recordset[0];
    if (!report) return errorResponse(404, 'Report config not found.');

    const canViewReport =
      actor.role === 'supadmin' ||
      actor.permissions.includes('manage:reports') ||
      actor.permissions.includes(report.permissionKey);
    if (!canViewReport) {
      return errorResponse(403, `Missing report permission: ${report.permissionKey}`);
    }

    if (!report.workspaceId || !report.reportId || !report.datasetId) {
      return errorResponse(400, 'Report is missing workspaceId/reportId/datasetId configuration.');
    }

    const roles = (report.defaultRoles || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const rlsRoles = roles.length > 0 ? roles : ['Customer'];

    const tokenPayload = await generateReportEmbedToken({
      workspaceId: report.workspaceId,
      reportId: report.reportId,
      datasetId: report.datasetId,
      username: actor.email,
      roles: rlsRoles,
    });

    return ok({
      report: {
        id: report.id,
        name: report.name,
        permissionKey: report.permissionKey,
      },
      embedConfig: {
        type: 'report',
        reportId: report.reportId,
        embedUrl: tokenPayload.embedUrl,
        tokenType: 'Embed',
        accessToken: tokenPayload.embedToken,
        expiration: tokenPayload.expiration,
      },
      rls: {
        username: actor.email,
        roles: rlsRoles,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('powerbi/embed-config failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('powerbi-embed-config', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'powerbi/embed-config',
  handler: powerBiEmbedConfig,
});
