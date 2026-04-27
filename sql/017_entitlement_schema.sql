-- sql/017_entitlement_schema.sql

-- ─── entitlement_templates ────────────────────────────────────────────────────
IF OBJECT_ID('dbo.entitlement_templates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.entitlement_templates (
    id                  VARCHAR(64)    NOT NULL,
    name                NVARCHAR(255)  NOT NULL,
    description         NVARCHAR(1000) NULL,
    scope               VARCHAR(20)    NOT NULL CHECK (scope IN ('global', 'company')),
    company_id          VARCHAR(64)    NULL REFERENCES dbo.companies(id),
    permissions         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
    created_by_user_id  VARCHAR(64)    NULL,
    is_active           BIT            NOT NULL DEFAULT 1,
    created_at          DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_entitlement_templates PRIMARY KEY (id)
  );
END
GO

-- Drop override columns from company_template_assignment if they exist
IF COL_LENGTH('dbo.company_template_assignment', 'override_add') IS NOT NULL
  ALTER TABLE dbo.company_template_assignment DROP COLUMN override_add;

IF COL_LENGTH('dbo.company_template_assignment', 'override_remove') IS NOT NULL
  ALTER TABLE dbo.company_template_assignment DROP COLUMN override_remove;
GO

-- Ensure company_template_assignment exists without override columns
IF OBJECT_ID('dbo.company_template_assignment', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.company_template_assignment (
    company_id          VARCHAR(64)  NOT NULL,
    template_id         VARCHAR(64)  NOT NULL REFERENCES dbo.entitlement_templates(id),
    assigned_by_user_id VARCHAR(64)  NULL,
    assigned_at         DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_company_template_assignment PRIMARY KEY (company_id)
  );
END
GO

-- Ensure user_template_assignment exists
IF OBJECT_ID('dbo.user_template_assignment', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.user_template_assignment (
    user_id             VARCHAR(64)  NOT NULL,
    template_id         VARCHAR(64)  NOT NULL REFERENCES dbo.entitlement_templates(id),
    assigned_by_user_id VARCHAR(64)  NULL,
    assigned_at         DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_template_assignment PRIMARY KEY (user_id)
  );
END
GO

-- ─── Seed TPL-DEFAULT global template ────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.entitlement_templates WHERE id = 'TPL-DEFAULT')
BEGIN
  INSERT INTO dbo.entitlement_templates (
    id, name, description, scope, company_id, permissions, created_by_user_id, is_active
  ) VALUES (
    'TPL-DEFAULT',
    'Tam Erişim',
    'Default global template. Admin-level access.',
    'global',
    NULL,
    '["view:dashboard","view:operational-list","view:invoices","view:port-fees","view:reports","view:fleet","view:shipments","view:orders","view:supplier","create:support-ticket","submit:rfq","view:finance","view:sustainability","view:business","edit:orders","view:analytics","manage:users","manage:reports"]',
    NULL,
    1
  );
END
GO
