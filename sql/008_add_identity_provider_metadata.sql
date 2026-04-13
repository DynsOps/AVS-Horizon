/*
  Add hybrid External ID provider metadata to existing identity schema.
  Safe for existing databases with data.
*/

IF COL_LENGTH('dbo.users', 'identity_provider_type') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD identity_provider_type NVARCHAR(40) NOT NULL
        CONSTRAINT DF_users_identity_provider_type_hybrid DEFAULT ('workforce_federated');
END;
GO

IF COL_LENGTH('dbo.users', 'identity_tenant_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD identity_tenant_id NVARCHAR(128) NULL;
END;
GO

UPDATE dbo.users
SET identity_provider_type = CASE
        WHEN provisioning_source IN ('invited_personal', 'external_local_account') THEN 'external_local'
        ELSE 'workforce_federated'
    END
WHERE identity_provider_type IS NULL OR LTRIM(RTRIM(identity_provider_type)) = '';
GO

DECLARE @dropProvisioningChecksSql NVARCHAR(MAX) = N'';

SELECT @dropProvisioningChecksSql = @dropProvisioningChecksSql +
    N'ALTER TABLE dbo.users DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.users')
  AND cc.definition LIKE '%provisioning_source%';

IF @dropProvisioningChecksSql <> N''
BEGIN
    EXEC sp_executesql @dropProvisioningChecksSql;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.users')
      AND name = 'CK_users_provisioning_source_hybrid'
)
BEGIN
    ALTER TABLE dbo.users ADD CONSTRAINT CK_users_provisioning_source_hybrid
        CHECK (provisioning_source IN ('bootstrap_supadmin', 'corporate_precreated', 'invited_personal', 'external_local_account', 'auto_domain'));
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.users')
      AND name = 'CK_users_identity_provider_type_hybrid'
)
BEGIN
    ALTER TABLE dbo.users ADD CONSTRAINT CK_users_identity_provider_type_hybrid
        CHECK (identity_provider_type IN ('workforce_federated', 'external_local'));
END;
GO
