/*
  Grant DB access to Azure Function App system-assigned managed identity
  Target: Azure SQL Database

  Before running, replace the identity name if your Function App name differs:
  - avs-horizon-global-func-auth
*/

DECLARE @principal_name SYSNAME = N'avs-horizon-global-func-auth';

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_principals
    WHERE name = @principal_name
)
BEGIN
    DECLARE @create_sql NVARCHAR(500) = N'CREATE USER [' + @principal_name + N'] FROM EXTERNAL PROVIDER;';
    EXEC sp_executesql @create_sql;
END;
GO

DECLARE @principal_name SYSNAME = N'avs-horizon-global-func-auth';
DECLARE @grant_reader NVARCHAR(500) = N'ALTER ROLE db_datareader ADD MEMBER [' + @principal_name + N'];';
DECLARE @grant_writer NVARCHAR(500) = N'ALTER ROLE db_datawriter ADD MEMBER [' + @principal_name + N'];';
DECLARE @grant_executor NVARCHAR(500) = N'GRANT EXECUTE TO [' + @principal_name + N'];';

BEGIN TRY
    EXEC sp_executesql @grant_reader;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 15023 THROW;
END CATCH;

BEGIN TRY
    EXEC sp_executesql @grant_writer;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 15023 THROW;
END CATCH;

BEGIN TRY
    EXEC sp_executesql @grant_executor;
END TRY
BEGIN CATCH
    -- Ignore if already granted.
END CATCH;
GO
