-- Migration 019: Drop dbo.user_permissions table
-- Run ONLY after smoke testing the template-based permission system.
-- Permissions are now resolved from entitlement_templates via resolveEffectivePermissions.

IF OBJECT_ID('dbo.user_permissions', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.user_permissions;
    PRINT 'dbo.user_permissions dropped.';
END
ELSE
BEGIN
    PRINT 'dbo.user_permissions does not exist — skipped.';
END
