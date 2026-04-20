/*
  Remove deprecated company contact fields.
  Target: Azure SQL Database
*/

IF COL_LENGTH('dbo.companies', 'contact_email') IS NOT NULL
BEGIN
    ALTER TABLE dbo.companies DROP COLUMN contact_email;
END;
GO

IF COL_LENGTH('dbo.companies', 'country') IS NOT NULL
BEGIN
    ALTER TABLE dbo.companies DROP COLUMN country;
END;
GO
