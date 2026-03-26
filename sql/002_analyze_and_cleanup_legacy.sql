/*
  AVS Horizon - Legacy object analysis and cleanup helpers
  Target: Azure SQL Database
*/

/* 1) Table row counts (quick usage signal) */
SELECT
    t.name AS table_name,
    SUM(p.rows) AS row_count
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY row_count DESC, t.name;
GO

/* 2) Last user seek/scan/lookup/update activity for indexes */
SELECT
    OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    us.user_seeks,
    us.user_scans,
    us.user_lookups,
    us.user_updates,
    us.last_user_seek,
    us.last_user_scan,
    us.last_user_lookup,
    us.last_user_update
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats us
    ON us.database_id = DB_ID()
   AND us.object_id = i.object_id
   AND us.index_id = i.index_id
WHERE i.object_id IN (SELECT object_id FROM sys.tables)
ORDER BY table_name, index_name;
GO

/* 3) Dependency scan for a target object before drop */
DECLARE @target SYSNAME = N'dbo.legacy_table_name';

SELECT
    referencing_schema_name = OBJECT_SCHEMA_NAME(referencing_id),
    referencing_object_name = OBJECT_NAME(referencing_id),
    referenced_schema_name = referenced_schema_name,
    referenced_entity_name = referenced_entity_name
FROM sys.sql_expression_dependencies
WHERE referenced_id = OBJECT_ID(@target)
   OR (referenced_schema_name + N'.' + referenced_entity_name) = @target;
GO

/* 4) Safe pattern: rename first, then drop after soak period */
-- EXEC sp_rename 'dbo.legacy_table_name', 'legacy_table_name_to_delete_20260326';
-- DROP TABLE dbo.legacy_table_name_to_delete_20260326;
