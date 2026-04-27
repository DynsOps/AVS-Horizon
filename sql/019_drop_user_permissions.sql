-- Migration 019: Drop dbo.user_permissions table
-- Run ONLY after smoke testing the template-based permission system.
-- Permissions are now resolved from entitlement_templates via resolveEffectivePermissions.

-- Drop RLS security policy that references user_permissions
IF EXISTS (
    SELECT 1 FROM sys.security_policies WHERE name = 'CompanyIsolationPolicy'
)
BEGIN
    DROP SECURITY POLICY dbo.CompanyIsolationPolicy;
    PRINT 'CompanyIsolationPolicy dropped.';
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
