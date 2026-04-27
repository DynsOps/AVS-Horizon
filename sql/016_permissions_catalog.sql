-- sql/016_permissions_catalog.sql

IF OBJECT_ID('dbo.permissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.permissions (
    [key]        VARCHAR(150)  NOT NULL,
    label        NVARCHAR(255) NOT NULL,
    group_name   NVARCHAR(100) NOT NULL,
    kind         VARCHAR(20)   NOT NULL
                 CHECK (kind IN ('screen', 'action', 'report', 'system')),
    is_dynamic   BIT           NOT NULL DEFAULT 0,
    is_active    BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_permissions PRIMARY KEY ([key])
  );
END
GO
