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
    'manage:reports',
    'view:finance',
    'view:sustainability',
    'view:business',
    'edit:orders',
    'view:analytics',
    'system:settings',
    'view:analysis-report:contracted',
    'view:analysis-report:bi-overview',
  ],
  admin: [
    'view:dashboard',
    'view:reports',
    'manage:users',
    'view:analytics',
    'view:analysis-report:contracted',
    'view:analysis-report:bi-overview',
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
    'view:analysis-report:contracted',
    'view:analysis-report:bi-overview',
  ],
};

export const getDefaultPermissionsForRole = (role: UserRole): string[] => {
  return defaults[role] || defaults.user;
};
