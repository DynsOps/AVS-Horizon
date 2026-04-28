import { runQuery } from './db';
import { STATIC_PERMISSIONS } from './permissionCatalog';

export const syncPermissions = async (): Promise<void> => {
  for (const p of STATIC_PERMISSIONS) {
    await runQuery(
      `MERGE dbo.permissions AS target
       USING (SELECT @key AS [key], @label AS label, @groupName AS group_name, @kind AS kind) AS source
         ON target.[key] = source.[key]
       WHEN MATCHED THEN
         UPDATE SET label = source.label,
                    group_name = source.group_name,
                    kind = source.kind,
                    updated_at = SYSUTCDATETIME(),
                    is_active = 1
       WHEN NOT MATCHED THEN
         INSERT ([key], label, group_name, kind, is_dynamic, is_active)
         VALUES (source.[key], source.label, source.group_name, @kind, 0, 1);`,
      { key: p.key, label: p.label, groupName: p.group, kind: p.kind }
    );
  }

  // Deactivate static entries that are no longer in the catalog
  const staticKeys = STATIC_PERMISSIONS.map((p) => `'${p.key.replace(/'/g, "''")}'`).join(',');
  await runQuery(
    `UPDATE dbo.permissions
     SET is_active = 0, updated_at = SYSUTCDATETIME()
     WHERE is_dynamic = 0 AND [key] NOT IN (${staticKeys})`
  );
};
