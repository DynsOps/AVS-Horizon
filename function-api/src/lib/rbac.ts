export type UserRole = 'supadmin' | 'admin' | 'user';

// Permissions are now resolved from templates — see resolvePermissions.ts
// Kept for backward compatibility with any callers.
export const getDefaultPermissionsForRole = (_role: UserRole): string[] => [];
