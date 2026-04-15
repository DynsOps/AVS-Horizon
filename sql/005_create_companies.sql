/*
  Create companies table for Entity Management module
  Target: Azure SQL Database
*/

IF OBJECT_ID('dbo.companies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.companies (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        type NVARCHAR(20) NOT NULL CHECK (type IN ('Customer', 'Supplier')),
        country NVARCHAR(100) NOT NULL,
        contact_email NVARCHAR(320) NULL,
        status NVARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Inactive')),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_companies_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_companies_updated_at DEFAULT (SYSUTCDATETIME())
    );
END;
GO
