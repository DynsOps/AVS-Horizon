-- ============================================================
-- 010: Create vessel tracking tables
-- Maritime Tracking Module
-- ============================================================

CREATE TABLE dbo.vessels (
    id              NVARCHAR(64)    NOT NULL PRIMARY KEY,
    company_id      NVARCHAR(64)    NOT NULL REFERENCES dbo.companies(id),
    name            NVARCHAR(200)   NOT NULL,
    imo             NVARCHAR(20)    NOT NULL UNIQUE,
    type            NVARCHAR(50)    NOT NULL,
    flag_country    NVARCHAR(100)   NULL,
    built_year      INT             NULL,
    dwt             DECIMAL(12,2)   NULL,
    vessel_status   NVARCHAR(30)    NOT NULL DEFAULT 'Active'
        CHECK (vessel_status IN ('Active', 'Laid Up', 'Under Repair', 'Scrapped')),
    created_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_vessels_company_id ON dbo.vessels(company_id);

-- ============================================================

CREATE TABLE dbo.vessel_positions (
    id              NVARCHAR(64)    NOT NULL PRIMARY KEY,
    vessel_id       NVARCHAR(64)    NOT NULL REFERENCES dbo.vessels(id) ON DELETE CASCADE,
    lat             DECIMAL(10,6)   NOT NULL,
    lng             DECIMAL(10,6)   NOT NULL,
    speed           DECIMAL(6,2)    NULL,
    course          DECIMAL(6,2)    NULL,
    heading         DECIMAL(6,2)    NULL,
    nav_status      NVARCHAR(50)    NULL,
    destination     NVARCHAR(200)   NULL,
    eta             DATETIME2       NULL,
    fetched_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_vessel_positions_vessel_id ON dbo.vessel_positions(vessel_id);
CREATE INDEX IX_vessel_positions_fetched_at ON dbo.vessel_positions(fetched_at DESC);

-- ============================================================

CREATE TABLE dbo.vessel_routes (
    id              NVARCHAR(64)    NOT NULL PRIMARY KEY,
    vessel_id       NVARCHAR(64)    NOT NULL REFERENCES dbo.vessels(id) ON DELETE CASCADE,
    departure_port  NVARCHAR(200)   NOT NULL,
    arrival_port    NVARCHAR(200)   NOT NULL,
    departure_date  DATETIME2       NOT NULL,
    arrival_date    DATETIME2       NULL,
    status          NVARCHAR(30)    NOT NULL DEFAULT 'Planned'
        CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Cancelled')),
    created_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_vessel_routes_vessel_id ON dbo.vessel_routes(vessel_id);

-- ============================================================

CREATE TABLE dbo.vessel_operations (
    id              NVARCHAR(64)    NOT NULL PRIMARY KEY,
    vessel_id       NVARCHAR(64)    NOT NULL REFERENCES dbo.vessels(id) ON DELETE CASCADE,
    route_id        NVARCHAR(64)    NULL REFERENCES dbo.vessel_routes(id),
    port            NVARCHAR(200)   NOT NULL,
    operation_type  NVARCHAR(50)    NOT NULL
        CHECK (operation_type IN ('Bunkering', 'Provisioning', 'Maintenance', 'Port Fees', 'Crew Change')),
    operation_date  DATETIME2       NOT NULL,
    items           NVARCHAR(MAX)   NULL,   -- JSON array of {name, quantity, unit, unitPrice}
    total_amount    DECIMAL(12,2)   NULL,
    currency        NVARCHAR(10)    NULL DEFAULT 'USD',
    supplier_id     NVARCHAR(64)    NULL,
    notes           NVARCHAR(MAX)   NULL,
    created_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_vessel_operations_vessel_id ON dbo.vessel_operations(vessel_id);
CREATE INDEX IX_vessel_operations_route_id ON dbo.vessel_operations(route_id);
