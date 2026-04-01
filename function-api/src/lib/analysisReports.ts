import { randomUUID } from 'crypto';
import { runQuery } from './db';

export type AnalysisReportRecord = {
  id: string;
  name: string;
  description: string | null;
  permissionKey: string;
  embedUrl: string | null;
  workspaceId: string | null;
  reportId: string | null;
  datasetId: string | null;
  defaultRoles: string[];
  isActive: boolean;
  createdAt: string;
};

const DEFAULT_REPORTS = [
  {
    id: 'AR-CONTRACTED',
    name: 'Contracted Analysis',
    description: 'Operational contracted analysis overview.',
    permissionKey: 'view:analysis-report:contracted',
    embedUrl: '',
  },
  {
    id: 'AR-BI-OVERVIEW',
    name: 'BI Overview',
    description: 'Power BI general overview.',
    permissionKey: 'view:analysis-report:bi-overview',
    embedUrl: '',
  },
];

export const toPermissionSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
};

export const buildAnalysisReportId = (): string => {
  return `AR-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
};

export const ensureAnalysisReportsTable = async (): Promise<void> => {
  const existsResult = await runQuery<{ tableExists: number }>(
    `
    SELECT
      CASE WHEN OBJECT_ID('dbo.analysis_reports', 'U') IS NULL THEN 0 ELSE 1 END AS tableExists
    `
  );
  const tableExists = (existsResult.recordset[0]?.tableExists || 0) === 1;

  if (!tableExists) {
    await runQuery(
      `
      CREATE TABLE dbo.analysis_reports (
        id NVARCHAR(32) NOT NULL PRIMARY KEY,
        name NVARCHAR(160) NOT NULL,
        description NVARCHAR(1000) NULL,
        permission_key NVARCHAR(190) NOT NULL UNIQUE,
        embed_url NVARCHAR(2048) NULL,
        workspace_id NVARCHAR(128) NULL,
        report_id NVARCHAR(128) NULL,
        dataset_id NVARCHAR(128) NULL,
        default_roles NVARCHAR(512) NULL,
        is_active BIT NOT NULL CONSTRAINT DF_analysis_reports_is_active DEFAULT(1),
        created_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_reports_created_at DEFAULT(SYSUTCDATETIME()),
        updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_reports_updated_at DEFAULT(SYSUTCDATETIME())
      );
      CREATE UNIQUE INDEX UX_analysis_reports_name ON dbo.analysis_reports(name);
      `
    );
  }

  if (!tableExists) {
    for (const report of DEFAULT_REPORTS) {
      await runQuery(
        `
        INSERT INTO dbo.analysis_reports (
          id,
          name,
          description,
          permission_key,
          embed_url,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @name,
          @description,
          @permissionKey,
          @embedUrl,
          1,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        )
        `,
        {
          id: report.id,
          name: report.name,
          description: report.description,
          permissionKey: report.permissionKey,
          embedUrl: report.embedUrl,
        }
      );
    }
  }

  await runQuery(
    `
    IF COL_LENGTH('dbo.analysis_reports', 'workspace_id') IS NULL
      ALTER TABLE dbo.analysis_reports ADD workspace_id NVARCHAR(128) NULL;
    IF COL_LENGTH('dbo.analysis_reports', 'report_id') IS NULL
      ALTER TABLE dbo.analysis_reports ADD report_id NVARCHAR(128) NULL;
    IF COL_LENGTH('dbo.analysis_reports', 'dataset_id') IS NULL
      ALTER TABLE dbo.analysis_reports ADD dataset_id NVARCHAR(128) NULL;
    IF COL_LENGTH('dbo.analysis_reports', 'default_roles') IS NULL
      ALTER TABLE dbo.analysis_reports ADD default_roles NVARCHAR(512) NULL;
    `
  );
};

export const listAnalysisReports = async (): Promise<AnalysisReportRecord[]> => {
  await ensureAnalysisReportsTable();
  const result = await runQuery<{
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
  }>(
    `
    SELECT
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
    WHERE is_active = 1
    ORDER BY created_at ASC
    `
  );

  return result.recordset.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    permissionKey: row.permissionKey,
    embedUrl: row.embedUrl,
    workspaceId: row.workspaceId,
    reportId: row.reportId,
    datasetId: row.datasetId,
    defaultRoles: (row.defaultRoles || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    isActive: row.isActive === true || row.isActive === 1,
    createdAt: row.createdAt,
  }));
};
