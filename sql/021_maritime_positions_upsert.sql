-- ============================================================
-- 021: Add UNIQUE constraints for per-vessel UPSERT on maritime tables
-- vessel_positions and vessel_routes now support one-row-per-vessel UPSERT (via T-SQL MERGE).
-- ============================================================

-- Delete existing mock data from vessel_positions (idempotent: only if constraint doesn't exist)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_positions')
      AND name = 'UQ_vessel_positions_vessel_id'
)
BEGIN
    DELETE FROM dbo.vessel_positions;
    PRINT 'Cleared mock data from dbo.vessel_positions';
END
GO

-- Delete existing mock data from vessel_routes (idempotent: only if constraint doesn't exist)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_routes')
      AND name = 'UQ_vessel_routes_vessel_id'
)
BEGIN
    DELETE FROM dbo.vessel_routes;
    PRINT 'Cleared mock data from dbo.vessel_routes';
END
GO

-- Add UNIQUE constraint on vessel_positions.vessel_id
-- This enforces exactly one position row per vessel, enabling deterministic MERGE upserts
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_positions')
      AND name = 'UQ_vessel_positions_vessel_id'
)
BEGIN
    ALTER TABLE dbo.vessel_positions
    ADD CONSTRAINT UQ_vessel_positions_vessel_id UNIQUE (vessel_id);
    PRINT 'Created UNIQUE constraint on dbo.vessel_positions(vessel_id)';
END
GO

-- NOTE: This enforces a "current state" snapshot model for vessel_routes.
-- The Datadocked integration uses MERGE to keep one active row per vessel.
-- Historical routes must NOT be inserted as new rows; MERGE updates in place.
-- If voyage history is needed in future, introduce a separate vessel_route_history table.

-- Add UNIQUE constraint on vessel_routes.vessel_id
-- This enforces exactly one route row per vessel, enabling deterministic MERGE upserts
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_routes')
      AND name = 'UQ_vessel_routes_vessel_id'
)
BEGIN
    ALTER TABLE dbo.vessel_routes
    ADD CONSTRAINT UQ_vessel_routes_vessel_id UNIQUE (vessel_id);
    PRINT 'Created UNIQUE constraint on dbo.vessel_routes(vessel_id)';
END
GO

-- Drop redundant non-unique indexes from migration 010 (now superseded by UNIQUE constraints)
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_positions')
      AND name = 'IX_vessel_positions_vessel_id'
)
    DROP INDEX IX_vessel_positions_vessel_id ON dbo.vessel_positions;
GO

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.vessel_routes')
      AND name = 'IX_vessel_routes_vessel_id'
)
    DROP INDEX IX_vessel_routes_vessel_id ON dbo.vessel_routes;
GO
