import { Permission, User, UserRole } from '../types';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    'view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'edit:orders', 'create:support-ticket',
    'view:analysis-report:contracted', 'view:analysis-report:bi-overview',
  ],
  admin: [
    'view:dashboard', 'view:reports', 'manage:users', 'view:analytics',
    'view:analysis-report:contracted', 'view:analysis-report:bi-overview',
  ],
  supadmin: [
    'view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'view:supplier', 'submit:rfq', 'manage:users', 'manage:companies', 'manage:reports', 'manage:vessels', 'view:maritime-map', 'view:finance', 'view:sustainability', 'view:business', 'edit:orders', 'view:analytics', 'system:settings',
    'view:analysis-report:contracted', 'view:analysis-report:bi-overview',
  ],
};

export const getDefaultRouteForRole = (role: UserRole): string => {
  if (role === 'user' || role === 'admin') return '/customer/dashboard';
  return '/admin/system-health';
};

export const isPendingAccessUser = (user: Pick<User, 'accessState' | 'permissions'>): boolean => {
  if (user.accessState && user.accessState !== 'active') return true;
  return user.permissions.length === 0;
};

export const getDefaultRouteForUser = (user: Pick<User, 'role' | 'isGuest' | 'accessState' | 'permissions'>): string => {
  if (isPendingAccessUser(user)) return '/access-pending';
  if (user.role === 'user' && user.isGuest) return '/guest/rfq';
  return getDefaultRouteForRole(user.role);
};

export const hasRoleAccess = (userRole: UserRole, allowedRoles?: UserRole[]): boolean => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
};

export const hasPermissions = (userPermissions: Permission[], requiredPermissions?: Permission[]): boolean => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return requiredPermissions.every((permission) => userPermissions.includes(permission));
};

export const getDefaultPermissionsForRole = (role: UserRole): Permission[] => {
  return [...ROLE_PERMISSIONS[role]];
};
