import { Permission } from './permissions';

/**
 * Maps each role to its granted permissions.
 * To add a new role: add an entry here — no route changes needed.
 * To add a new permission to a role: append it to that role's array.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  USER: [
    Permission.CODE_EXECUTE,
    Permission.PROFILE_READ_OWN,
    Permission.PROFILE_UPDATE_OWN,
  ],
  ADMIN: [
    Permission.CODE_EXECUTE,
    Permission.PROFILE_READ_OWN,
    Permission.PROFILE_UPDATE_OWN,
    Permission.USERS_READ,
    Permission.USERS_UPDATE_ROLE,
    Permission.LOGS_ACCESS_READ,
    Permission.LOGS_APP_READ,
  ],
};
