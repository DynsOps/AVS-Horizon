export type UserRole = 'supadmin' | 'admin' | 'user';

const defaults: Record<UserRole, string[]> = {
  supadmin: [
    'view:dashboard',
    'view:operational-list',
    'view:invoices',
    'view:port-fees',
    'view:reports',
    'view:fleet',
    'view:shipments',
    'view:orders',
    'view:supplier',
    'create:support-ticket',
    'submit:rfq',
    'manage:users',
    'manage:companies',
    'view:finance',
    'edit:orders',
    'view:analytics',
    'system:settings',
  ],
  admin: [
    'view:dashboard',
    'view:operational-list',
    'view:invoices',
    'view:port-fees',
    'view:reports',
    'view:fleet',
    'view:shipments',
    'view:orders',
    'create:support-ticket',
    'manage:users',
    'view:finance',
    'view:analytics',
    'system:settings',
  ],
  user: [
    'view:dashboard',
    'view:operational-list',
    'view:invoices',
    'view:port-fees',
    'view:reports',
    'view:fleet',
    'view:shipments',
    'view:orders',
    'create:support-ticket',
    'view:analytics',
  ],
};

export const getDefaultPermissionsForRole = (role: UserRole): string[] => {
  return defaults[role] || defaults.user;
};
