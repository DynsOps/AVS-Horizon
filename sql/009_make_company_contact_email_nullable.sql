/*
  Allow companies.contact_email to be nullable for relaxed entity management flows
  Target: Azure SQL Database
*/

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
