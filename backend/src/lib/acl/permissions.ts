/**
 * All permissions in the system.
 * Routes declare which permission they require — never a role directly.
 * This makes the ACL flexible: adding a new role is purely additive in roles.ts.
 */
export const Permission = {
  // Code execution
  CODE_EXECUTE: 'code:execute',

  // Own profile
  PROFILE_READ_OWN:   'profile:read:own',
  PROFILE_UPDATE_OWN: 'profile:update:own',

  // User management
  USERS_READ:        'users:read',
  USERS_UPDATE_ROLE: 'users:update:role',

  // Logs
  LOGS_ACCESS_READ: 'logs:access:read',
  LOGS_APP_READ:    'logs:app:read',
} as const;

export type Permission = typeof Permission[keyof typeof Permission];
