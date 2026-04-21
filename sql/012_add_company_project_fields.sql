/*
  Add company project mapping fields used by Fabric groupProjtables lookups
  Target: Azure SQL Database
*/

IF COL_LENGTH('dbo.companies', 'data_area_id') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD data_area_id NVARCHAR(64) NULL;
END;
GO

IF COL_LENGTH('dbo.companies', 'proj_id') IS NULL
BEGIN
    ALTER TABLE dbo.companies ADD proj_id NVARCHAR(64) NULL;
END;
GO
