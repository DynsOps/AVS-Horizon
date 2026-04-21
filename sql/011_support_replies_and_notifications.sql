/*
  Add support ticket replies and user notifications.
  Refresh company isolation policy to include notifications.
*/

IF OBJECT_ID('dbo.support_ticket_replies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.support_ticket_replies (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        ticket_id NVARCHAR(64) NOT NULL,
        author_user_id NVARCHAR(64) NOT NULL,
        author_role NVARCHAR(20) NOT NULL CHECK (author_role IN ('supadmin', 'admin', 'user')),
        message NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_support_ticket_replies_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_support_ticket_replies_ticket FOREIGN KEY (ticket_id) REFERENCES dbo.support_tickets(id) ON DELETE CASCADE,
        CONSTRAINT FK_support_ticket_replies_author FOREIGN KEY (author_user_id) REFERENCES dbo.users(id)
    );
END;
GO

IF OBJECT_ID('dbo.user_notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_notifications (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        user_id NVARCHAR(64) NOT NULL,
        notification_type NVARCHAR(80) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        target_route NVARCHAR(300) NOT NULL,
        is_read BIT NOT NULL CONSTRAINT DF_user_notifications_is_read DEFAULT (0),
        meta_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_notifications_created_at DEFAULT (SYSUTCDATETIME()),
        read_at DATETIME2 NULL,
        CONSTRAINT FK_user_notifications_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_support_ticket_replies_ticket_created' AND object_id = OBJECT_ID('dbo.support_ticket_replies'))
BEGIN
    CREATE INDEX IX_support_ticket_replies_ticket_created ON dbo.support_ticket_replies(ticket_id, created_at);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_notifications_user_created' AND object_id = OBJECT_ID('dbo.user_notifications'))
BEGIN
    CREATE INDEX IX_user_notifications_user_created ON dbo.user_notifications(user_id, created_at DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'security')
BEGIN
    EXEC('CREATE SCHEMA security');
END;
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'CompanyIsolationPolicy')
BEGIN
    DROP SECURITY POLICY security.CompanyIsolationPolicy;
END;
GO

CREATE OR ALTER FUNCTION security.fn_company_scope(@company_id NVARCHAR(64))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS fn_company_scope_result
    WHERE
        CAST(SESSION_CONTEXT(N'app.internal_bypass') AS INT) = 1
        OR
        CAST(SESSION_CONTEXT(N'app.role') AS NVARCHAR(20)) = 'supadmin'
        OR (
            @company_id IS NOT NULL
            AND CAST(SESSION_CONTEXT(N'app.company_id') AS NVARCHAR(64)) = @company_id
        );
GO

CREATE OR ALTER FUNCTION security.fn_user_scope(@user_id NVARCHAR(64))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS fn_user_scope_result
    WHERE
        CAST(SESSION_CONTEXT(N'app.internal_bypass') AS INT) = 1
        OR
        CAST(SESSION_CONTEXT(N'app.role') AS NVARCHAR(20)) = 'supadmin'
        OR EXISTS (
            SELECT 1
            FROM dbo.users u
            WHERE u.id = @user_id
              AND u.company_id = CAST(SESSION_CONTEXT(N'app.company_id') AS NVARCHAR(64))
        );
GO

CREATE SECURITY POLICY security.CompanyIsolationPolicy
ADD FILTER PREDICATE security.fn_company_scope(company_id) ON dbo.users,
ADD FILTER PREDICATE security.fn_user_scope(user_id) ON dbo.user_permissions,
ADD FILTER PREDICATE security.fn_user_scope(created_by_user_id) ON dbo.support_tickets,
ADD FILTER PREDICATE security.fn_user_scope(created_by_user_id) ON dbo.guest_rfqs,
ADD FILTER PREDICATE security.fn_user_scope(user_id) ON dbo.user_notifications
WITH (STATE = ON);
GO
