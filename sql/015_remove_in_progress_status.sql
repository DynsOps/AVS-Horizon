/*
  Migration 015 — Remove "In Progress" support ticket status
  Tickets now have only two states: Open and Resolved.
  Backfills any existing 'In Progress' rows to 'Open' before
  updating the CHECK constraint.
*/

-- Backfill any existing 'In Progress' tickets to 'Open'
UPDATE dbo.support_tickets
SET status = 'Open'
WHERE status = 'In Progress';
GO

-- Drop the old CHECK constraint on the status column (name is system-generated)
DECLARE @constraintName NVARCHAR(128);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c
    ON c.object_id = cc.parent_object_id
   AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.support_tickets')
  AND c.name = 'status'
  AND cc.definition LIKE '%In Progress%';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.support_tickets DROP CONSTRAINT [' + @constraintName + ']');
END
GO

-- Re-add the CHECK constraint with only 'Open' and 'Resolved'
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.support_tickets')
      AND name = 'CK_support_tickets_status'
)
BEGIN
    ALTER TABLE dbo.support_tickets
    ADD CONSTRAINT CK_support_tickets_status
    CHECK (status IN ('Open', 'Resolved'));
END
GO
