/*
  Align existing DB schema with Function API expectations (non-destructive)
  Target: Azure SQL Database
*/

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        display_name NVARCHAR(200) NOT NULL,
        email NVARCHAR(320) NOT NULL,
        role NVARCHAR(20) NOT NULL,
        is_guest BIT NOT NULL CONSTRAINT DF_users_is_guest DEFAULT (0),
        show_only_core_admin_permissions BIT NOT NULL CONSTRAINT DF_users_show_only_core_admin_permissions DEFAULT (0),
        company_id NVARCHAR(64) NULL,
        identity_provider_type NVARCHAR(40) NOT NULL CONSTRAINT DF_users_identity_provider_type DEFAULT ('workforce_federated'),
        identity_tenant_id NVARCHAR(128) NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT ('Active'),
        temporary_password NVARCHAR(128) NULL,
        password_hash NVARCHAR(512) NULL,
        power_bi_access NVARCHAR(20) NOT NULL CONSTRAINT DF_users_power_bi_access DEFAULT ('none'),
        power_bi_workspace_id NVARCHAR(128) NULL,
        power_bi_report_id NVARCHAR(128) NULL,
        password_last_changed_at DATETIME2 NULL,
        last_login_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated_at DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF COL_LENGTH('dbo.users', 'display_name') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD display_name NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'email') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD email NVARCHAR(320) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'entra_object_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD entra_object_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD role NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'is_guest') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD is_guest BIT NOT NULL CONSTRAINT DF_users_is_guest_align DEFAULT (0);
END;
GO

IF COL_LENGTH('dbo.users', 'show_only_core_admin_permissions') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD show_only_core_admin_permissions BIT NOT NULL CONSTRAINT DF_users_show_only_core_admin_permissions_align DEFAULT (0);
END;
GO

IF COL_LENGTH('dbo.users', 'company_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD company_id NVARCHAR(64) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'identity_provider_type') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD identity_provider_type NVARCHAR(40) NOT NULL CONSTRAINT DF_users_identity_provider_type_align DEFAULT ('workforce_federated');
END;
GO

IF COL_LENGTH('dbo.users', 'identity_tenant_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD identity_tenant_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'status') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status_align DEFAULT ('Active');
END;
GO

IF COL_LENGTH('dbo.users', 'provisioning_source') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD provisioning_source NVARCHAR(40) NOT NULL CONSTRAINT DF_users_provisioning_source_align DEFAULT ('corporate_precreated');
END;
GO

IF COL_LENGTH('dbo.users', 'access_state') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD access_state NVARCHAR(20) NOT NULL CONSTRAINT DF_users_access_state_align DEFAULT ('active');
END;
GO

IF COL_LENGTH('dbo.users', 'temporary_password') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD temporary_password NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'password_hash') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD password_hash NVARCHAR(512) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'power_bi_access') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD power_bi_access NVARCHAR(20) NOT NULL CONSTRAINT DF_users_power_bi_access_align DEFAULT ('none');
END;
GO

IF COL_LENGTH('dbo.users', 'power_bi_workspace_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD power_bi_workspace_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'power_bi_report_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD power_bi_report_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'password_last_changed_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD password_last_changed_at DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'last_login_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD last_login_at DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at_align DEFAULT (SYSUTCDATETIME());
END;
GO

IF COL_LENGTH('dbo.users', 'updated_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated_at_align DEFAULT (SYSUTCDATETIME());
END;
GO

IF OBJECT_ID('dbo.companies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.companies (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        type NVARCHAR(20) NOT NULL,
        country NVARCHAR(100) NOT NULL,
        contact_email NVARCHAR(320) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_companies_created_at_align DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_companies_updated_at_align DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF COL_LENGTH('dbo.companies', 'name') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD name NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'type') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD type NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'country') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD country NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'contact_email') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD contact_email NVARCHAR(320) NULL;
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.companies')
      AND name = 'contact_email'
      AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.companies ALTER COLUMN contact_email NVARCHAR(320) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'status') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD status NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_companies_created_at_align_2 DEFAULT (SYSUTCDATETIME());
END;
GO

IF COL_LENGTH('dbo.companies', 'updated_at') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_companies_updated_at_align_2 DEFAULT (SYSUTCDATETIME());
END;
GO

IF OBJECT_ID('dbo.user_permissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_permissions (
        user_id NVARCHAR(64) NOT NULL,
        permission NVARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_permissions_created_at_align DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_user_permissions_align PRIMARY KEY (user_id, permission)
    );
END;
GO

IF OBJECT_ID('dbo.company_domains', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.company_domains (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        company_id NVARCHAR(64) NOT NULL,
        domain NVARCHAR(320) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_company_domains_created_at_align DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_company_domains_updated_at_align DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_company_domains_company_align FOREIGN KEY (company_id) REFERENCES dbo.companies(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
    CREATE UNIQUE INDEX UX_users_email ON dbo.users(email);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_entra_object_id' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
    CREATE UNIQUE INDEX UX_users_entra_object_id ON dbo.users(entra_object_id) WHERE entra_object_id IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_company_domains_company_domain' AND object_id = OBJECT_ID('dbo.company_domains'))
BEGIN
    CREATE UNIQUE INDEX UX_company_domains_company_domain ON dbo.company_domains(company_id, domain);
END;
GO

UPDATE dbo.users
SET provisioning_source = CASE
        WHEN LOWER(email) IN ('dynamicsops14@avsglobalsupply.com') THEN 'bootstrap_supadmin'
        ELSE 'corporate_precreated'
    END
WHERE provisioning_source IS NULL OR LTRIM(RTRIM(provisioning_source)) = '';
GO

UPDATE dbo.users
SET access_state = CASE
        WHEN status <> 'Active' THEN 'pending'
        WHEN EXISTS (SELECT 1 FROM dbo.user_permissions up WHERE up.user_id = dbo.users.id) THEN 'active'
        ELSE 'pending'
    END
WHERE access_state IS NULL OR LTRIM(RTRIM(access_state)) = '';
GO

UPDATE dbo.users
SET identity_provider_type = CASE
        WHEN provisioning_source IN ('invited_personal', 'external_local_account') THEN 'external_local'
        ELSE 'workforce_federated'
    END
WHERE identity_provider_type IS NULL OR LTRIM(RTRIM(identity_provider_type)) = '';
GO
