-- ============================================================
-- 022: Make vessel position lat/lng and route departure_date nullable
-- Required because Datadocked may return vessels without coordinates
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.vessel_positions')
      AND name = 'lat'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.vessel_positions ALTER COLUMN lat DECIMAL(10,6) NULL;
    ALTER TABLE dbo.vessel_positions ALTER COLUMN lng DECIMAL(10,6) NULL;
    PRINT 'vessel_positions.lat/lng made nullable';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.vessel_routes')
      AND name = 'departure_date'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.vessel_routes ALTER COLUMN departure_date DATETIME2 NULL;
    PRINT 'vessel_routes.departure_date made nullable';
END
GO
