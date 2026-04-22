/*
  Multi-company admin support.
  An admin user can now manage multiple companies via dbo.admin_company_access.
  The existing users.company_id column is kept as the "active/primary" company
  for RLS session context; admin_company_access holds the full set of companies
  an admin is authorised to manage.
*/

IF OBJECT_ID('dbo.admin_company_access', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin_company_access (
        id            NVARCHAR(64)  NOT NULL CONSTRAINT PK_admin_company_access PRIMARY KEY,
        admin_user_id NVARCHAR(64)  NOT NULL CONSTRAINT FK_aca_user    REFERENCES dbo.users(id)     ON DELETE CASCADE,
        company_id    NVARCHAR(64)  NOT NULL CONSTRAINT FK_aca_company REFERENCES dbo.companies(id) ON DELETE CASCADE,
        created_at    DATETIME2     NOT NULL CONSTRAINT DF_aca_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_aca_admin_company UNIQUE (admin_user_id, company_id)
    );

    CREATE INDEX IX_aca_admin_user_id ON dbo.admin_company_access (admin_user_id);
    CREATE INDEX IX_aca_company_id    ON dbo.admin_company_access (company_id);
END;
GO

/*
  Back-fill: every existing admin who already has a company_id gets
  a row in admin_company_access so nothing breaks after the migration.
*/
INSERT INTO dbo.admin_company_access (id, admin_user_id, company_id)
SELECT
    CONCAT('aca-', REPLACE(NEWID(), '-', '')),
    u.id,
    u.company_id
FROM dbo.users u
WHERE u.role = 'admin'
  AND u.company_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.admin_company_access aca
      WHERE aca.admin_user_id = u.id
        AND aca.company_id    = u.company_id
  );
GO
