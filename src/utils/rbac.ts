import { Permission, User, UserRole } from '../types';

export const getDefaultRouteForRole = (role: UserRole): string => {
  if (role === 'user' || role === 'admin') return '/customer/dashboard';
  return '/admin/system-health';
};

export const isPendingAccessUser = (user: Pick<User, 'role' | 'accessState' | 'permissions'>): boolean => {
  if (user.role === 'supadmin') return false;
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

// Permissions now come from templates via authStore — this always returns empty.
export const getDefaultPermissionsForRole = (_role: UserRole): Permission[] => [];
