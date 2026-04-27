export type PermissionKind = 'screen' | 'action' | 'report' | 'system';

export type PermissionEntry = {
  key: string;
  label: string;
  group: string;
  kind: PermissionKind;
};

export const STATIC_PERMISSIONS: PermissionEntry[] = [
  // Operasyon
  { key: 'view:dashboard',         label: 'Dashboard',              group: 'Operasyon', kind: 'screen' },
  { key: 'view:operational-list',  label: 'Operasyon Listesi',      group: 'Operasyon', kind: 'screen' },
  { key: 'view:orders',            label: 'Siparişler',             group: 'Operasyon', kind: 'screen' },
  { key: 'edit:orders',            label: 'Sipariş Düzenle',        group: 'Operasyon', kind: 'action' },
  { key: 'view:fleet',             label: 'Filo',                   group: 'Operasyon', kind: 'screen' },
  { key: 'view:shipments',         label: 'Sevkiyatlar',            group: 'Operasyon', kind: 'screen' },
  { key: 'view:supplier',          label: 'Tedarikçi',              group: 'Operasyon', kind: 'screen' },
  { key: 'view:maritime-map',      label: 'Denizcilik Haritası',    group: 'Operasyon', kind: 'screen' },
  // Finans
  { key: 'view:invoices',          label: 'Faturalar',              group: 'Finans',    kind: 'screen' },
  { key: 'view:port-fees',         label: 'Liman Ücretleri',        group: 'Finans',    kind: 'screen' },
  { key: 'view:finance',           label: 'Finans',                 group: 'Finans',    kind: 'screen' },
  { key: 'view:business',          label: 'İş',                     group: 'Finans',    kind: 'screen' },
  // Raporlar
  { key: 'view:reports',           label: 'Raporlar',               group: 'Raporlar',  kind: 'screen' },
  { key: 'view:analytics',         label: 'Analitik',               group: 'Raporlar',  kind: 'screen' },
  { key: 'view:sustainability',    label: 'Sürdürülebilirlik',      group: 'Raporlar',  kind: 'screen' },
  // Talepler
  { key: 'submit:rfq',             label: 'RFQ Gönder',             group: 'Talepler',  kind: 'action' },
  { key: 'create:support-ticket',  label: 'Destek Talebi Oluştur', group: 'Talepler',  kind: 'action' },
  // Yönetim
  { key: 'manage:users',           label: 'Kullanıcı Yönetimi',    group: 'Yönetim',   kind: 'screen' },
  { key: 'manage:companies',       label: 'Şirket Yönetimi',       group: 'Yönetim',   kind: 'screen' },
  { key: 'manage:reports',         label: 'Rapor Yönetimi',        group: 'Yönetim',   kind: 'screen' },
  { key: 'manage:vessels',         label: 'Gemi Yönetimi',         group: 'Yönetim',   kind: 'screen' },
  { key: 'manage:templates',       label: 'Template Yönetimi',     group: 'Yönetim',   kind: 'screen' },
  // Sistem
  { key: 'system:settings',        label: 'Sistem Ayarları',       group: 'Sistem',    kind: 'system' },
];
