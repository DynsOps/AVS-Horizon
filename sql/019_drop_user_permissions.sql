-- Migration 019: Drop dbo.user_permissions table
-- Run ONLY after smoke testing the template-based permission system.
-- Permissions are now resolved from entitlement_templates via resolveEffectivePermissions.

-- Drop RLS security policy that references user_permissions
DECLARE @policySchema NVARCHAR(128);
DECLARE @dropSql     NVARCHAR(500);

SELECT @policySchema = SCHEMA_NAME(schema_id)
FROM sys.security_policies
WHERE name = 'CompanyIsolationPolicy';

IF @policySchema IS NOT NULL
BEGIN
    SET @dropSql = N'DROP SECURITY POLICY ' + QUOTENAME(@policySchema) + N'.' + QUOTENAME(N'CompanyIsolationPolicy');
    EXEC sp_executesql @dropSql;
    PRINT 'CompanyIsolationPolicy dropped from schema: ' + @policySchema;
END

IF OBJECT_ID('dbo.user_permissions', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.user_permissions;
    PRINT 'dbo.user_permissions dropped.';
END
ELSE
BEGIN
    PRINT 'dbo.user_permissions does not exist — skipped.';
END
