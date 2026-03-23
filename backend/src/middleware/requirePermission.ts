import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthError, ForbiddenError } from '../lib/errors';
import { ROLE_PERMISSIONS, Permission } from '../lib/acl';
import { AuthRequest } from './auth';

/**
 * Permission-based access control middleware.
 *
 * Usage on any route — role is never mentioned at the route level:
 *   router.post('/v1/execute', authMiddleware, requirePermission('code:execute'), asyncHandler(...));
 *   router.get('/v1/logs/access', authMiddleware, requirePermission('logs:access:read'), asyncHandler(...));
 *
 * To grant a role access to a route, edit src/lib/acl/roles.ts — no route changes needed.
 */
export function requirePermission(permission: Permission) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      next(new AuthError('Authentication required', 'NO_TOKEN'));
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      });

      if (!user) {
        next(new AuthError('User not found', 'USER_NOT_FOUND'));
        return;
      }

      const granted = ROLE_PERMISSIONS[user.role] ?? [];
      if (!granted.includes(permission)) {
        next(new ForbiddenError('You do not have permission to access this resource', 'FORBIDDEN'));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
