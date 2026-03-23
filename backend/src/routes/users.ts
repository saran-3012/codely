import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { Permission } from '../lib/acl';
import { NotFoundError, ValidationError } from '../lib/errors';

const router = Router();

const VALID_ROLES = ['USER', 'ADMIN'];

// ── GET /api/v1/users ───────────────────────────────────────────
router.get(
  '/',
  authMiddleware,
  requirePermission(Permission.USERS_READ),
  asyncHandler<AuthRequest>(async (req: AuthRequest, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip  = (page - 1) * limit;

    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, email: true, role: true, createdAt: true },
      }),
    ]);

    res.json({ total, page, limit, users });
  })
);

// ── PATCH /api/v1/users/:id/role ────────────────────────────────
router.patch(
  '/:id/role',
  authMiddleware,
  requirePermission(Permission.USERS_UPDATE_ROLE),
  asyncHandler<AuthRequest>(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      throw new ValidationError(`role must be one of: ${VALID_ROLES.join(', ')}`, 'INVALID_ROLE');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    res.json({ user: updated });
  })
);

export default router;
