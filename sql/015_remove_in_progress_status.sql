-- sql/015_remove_in_progress_status.sql

-- Backfill any existing 'In Progress' tickets to 'Open'
UPDATE dbo.support_tickets
SET status = 'Open'
WHERE status = 'In Progress';

-- Drop the old CHECK constraint dynamically (name varies)
DECLARE @constraintName NVARCHAR(128);
SELECT @constraintName = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.support_tickets')
  AND definition LIKE '%In Progress%';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.support_tickets DROP CONSTRAINT [' + @constraintName + ']');
END

-- Re-add the CHECK constraint with only 'Open' and 'Resolved'
ALTER TABLE dbo.support_tickets
ADD CONSTRAINT CK_support_tickets_status
CHECK (status IN ('Open', 'Resolved'));
