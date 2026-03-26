import { Permission, User, UserRole } from '../types';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'edit:orders', 'create:support-ticket'],
  admin: ['view:dashboard', 'view:operational-list', 'view:port-fees', 'view:reports', 'manage:users', 'manage:companies', 'view:analytics', 'system:settings', 'create:support-ticket'],
  supadmin: ['view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'manage:users', 'manage:companies', 'view:finance', 'edit:orders', 'view:analytics', 'system:settings', 'view:supplier', 'create:support-ticket'],
};

export const getDefaultRouteForRole = (role: UserRole): string => {
  if (role === 'user') return '/customer/dashboard';
  return '/admin/system-health';
};

export const getDefaultRouteForUser = (user: Pick<User, 'role' | 'isGuest'>): string => {
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
