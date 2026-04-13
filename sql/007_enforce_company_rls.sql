/*
  Enforce company isolation with SQL session context + row-level security.
  Expected session keys:
  - app.role
  - app.company_id
  - app.user_id
*/

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
ADD FILTER PREDICATE security.fn_user_scope(created_by_user_id) ON dbo.guest_rfqs
WITH (STATE = ON);
GO
