-- Migration 021: Add UNIQUE constraints for per-vessel UPSERT on maritime tables
-- vessel_positions and vessel_routes now support one-row-per-vessel UPSERT (via T-SQL MERGE).
-- Deletes existing mock data and adds UNIQUE constraints on vessel_id.

-- Delete existing mock data from vessel_positions
DELETE FROM dbo.vessel_positions;
GO

-- Delete existing mock data from vessel_routes
DELETE FROM dbo.vessel_routes;
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
