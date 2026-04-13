/*
  AVS Horizon - Identity + Support baseline
  Target: Azure SQL Database
*/

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        display_name NVARCHAR(200) NOT NULL,
        email NVARCHAR(320) NOT NULL,
        entra_object_id NVARCHAR(128) NULL,
        role NVARCHAR(20) NOT NULL CHECK (role IN ('supadmin', 'admin', 'user')),
        is_guest BIT NOT NULL CONSTRAINT DF_users_is_guest DEFAULT (0),
        show_only_core_admin_permissions BIT NOT NULL CONSTRAINT DF_users_show_only_core_admin_permissions DEFAULT (0),
        company_id NVARCHAR(64) NULL,
        identity_provider_type NVARCHAR(40) NOT NULL CONSTRAINT DF_users_identity_provider_type DEFAULT ('workforce_federated')
            CHECK (identity_provider_type IN ('workforce_federated', 'external_local')),
        identity_tenant_id NVARCHAR(128) NULL,
        status NVARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Inactive', 'Suspended')),
        provisioning_source NVARCHAR(40) NOT NULL CONSTRAINT DF_users_provisioning_source DEFAULT ('corporate_precreated')
            CHECK (provisioning_source IN ('bootstrap_supadmin', 'corporate_precreated', 'invited_personal', 'external_local_account', 'auto_domain')),
        access_state NVARCHAR(20) NOT NULL CONSTRAINT DF_users_access_state DEFAULT ('active')
            CHECK (access_state IN ('invited', 'pending', 'active')),
        temporary_password NVARCHAR(128) NULL,
        password_hash NVARCHAR(512) NULL,
        power_bi_access NVARCHAR(20) NOT NULL CONSTRAINT DF_users_power_bi_access DEFAULT ('none') CHECK (power_bi_access IN ('none', 'viewer', 'editor')),
        power_bi_workspace_id NVARCHAR(128) NULL,
        power_bi_report_id NVARCHAR(128) NULL,
        password_last_changed_at DATETIME2 NULL,
        last_login_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated_at DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF OBJECT_ID('dbo.company_domains', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.company_domains (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        company_id NVARCHAR(64) NOT NULL,
        domain NVARCHAR(320) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_company_domains_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_company_domains_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_company_domains_company FOREIGN KEY (company_id) REFERENCES dbo.companies(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('dbo.companies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.companies (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        type NVARCHAR(20) NOT NULL CHECK (type IN ('Customer', 'Supplier')),
        country NVARCHAR(100) NOT NULL,
        contact_email NVARCHAR(320) NOT NULL,
        status NVARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Inactive')),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_companies_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_companies_updated_at DEFAULT (SYSUTCDATETIME())
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

IF OBJECT_ID('dbo.user_permissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_permissions (
        user_id NVARCHAR(64) NOT NULL,
        permission NVARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_permissions_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_user_permissions PRIMARY KEY (user_id, permission),
        CONSTRAINT FK_user_permissions_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('dbo.support_tickets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.support_tickets (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        created_by_user_id NVARCHAR(64) NOT NULL,
        created_by_email NVARCHAR(320) NULL,
        subject NVARCHAR(300) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(30) NOT NULL CHECK (category IN ('General', 'Operational', 'Invoice', 'Technical')),
        status NVARCHAR(30) NOT NULL CHECK (status IN ('Open', 'In Progress', 'Resolved')),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_support_tickets_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_support_tickets_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id)
    );
END;
GO

IF OBJECT_ID('dbo.guest_rfqs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.guest_rfqs (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        created_by_user_id NVARCHAR(64) NOT NULL,
        created_by_email NVARCHAR(320) NULL,
        vessel_name NVARCHAR(200) NOT NULL,
        port NVARCHAR(200) NOT NULL,
        details NVARCHAR(MAX) NOT NULL,
        suggested_items_json NVARCHAR(MAX) NULL,
        attachments_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_guest_rfqs_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_guest_rfqs_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id)
    );
END;
GO
