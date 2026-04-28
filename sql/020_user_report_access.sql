-- 020: user_report_access + backfill existing analysis reports into permissions catalog

-- Direct per-user report access table (independent of template system)
IF OBJECT_ID('dbo.user_report_access', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_report_access (
    user_id             NVARCHAR(64)  NOT NULL,
    report_id           NVARCHAR(32)  NOT NULL,
    assigned_by_user_id NVARCHAR(64)  NOT NULL,
    assigned_at         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_report_access PRIMARY KEY (user_id, report_id),
    CONSTRAINT FK_ura_user   FOREIGN KEY (user_id)   REFERENCES dbo.users(id),
    CONSTRAINT FK_ura_report FOREIGN KEY (report_id) REFERENCES dbo.analysis_reports(id)
  );
END;

-- Backfill existing analysis reports that pre-date the permissions catalog
INSERT INTO dbo.permissions ([key], label, group_name, kind, is_dynamic, is_active, created_at, updated_at)
SELECT
  ar.permission_key,
  ar.name,
  N'Raporlar',
  'report',
  1,
  1,
  SYSUTCDATETIME(),
  SYSUTCDATETIME()
FROM dbo.analysis_reports ar
WHERE ar.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.permissions p WHERE p.[key] = ar.permission_key
  );
