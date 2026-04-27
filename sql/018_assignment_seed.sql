-- sql/018_assignment_seed.sql

-- ─── Assign all existing companies to TPL-DEFAULT ─────────────────────────────
INSERT INTO dbo.company_template_assignment (company_id, template_id)
SELECT
  c.id,
  'TPL-DEFAULT'
FROM dbo.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.company_template_assignment cta WHERE cta.company_id = c.id
);
GO

-- ─── Seed a "Default User" company-scope template for each company ────────────
-- and assign all existing users to it
DECLARE @compId VARCHAR(64);
DECLARE @tplId  VARCHAR(64);

DECLARE cCursor CURSOR FOR
  SELECT id FROM dbo.companies;

OPEN cCursor;
FETCH NEXT FROM cCursor INTO @compId;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @tplId = 'TPL-USER-' + @compId;

  IF NOT EXISTS (SELECT 1 FROM dbo.entitlement_templates WHERE id = @tplId)
  BEGIN
    INSERT INTO dbo.entitlement_templates (
      id, name, description, scope, company_id, permissions, is_active
    ) VALUES (
      @tplId,
      'Standart Kullanıcı',
      'Default user template for company.',
      'company',
      @compId,
      '["view:dashboard","view:operational-list","view:invoices","view:port-fees","view:fleet","view:shipments","view:orders","create:support-ticket","view:analytics"]',
      1
    );
  END

  -- Assign any unassigned users of this company
  INSERT INTO dbo.user_template_assignment (user_id, template_id)
  SELECT
    u.id,
    @tplId
  FROM dbo.users u
  WHERE u.company_id = @compId
    AND u.role = 'user'
    AND NOT EXISTS (
      SELECT 1 FROM dbo.user_template_assignment uta WHERE uta.user_id = u.id
    );

  FETCH NEXT FROM cCursor INTO @compId;
END

CLOSE cCursor;
DEALLOCATE cCursor;
GO
