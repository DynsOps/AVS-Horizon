/*
  Add secure password hash support for change-password flow
  Target: Azure SQL Database
*/

IF COL_LENGTH('dbo.users', 'password_hash') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD password_hash NVARCHAR(512) NULL;
END;
GO
