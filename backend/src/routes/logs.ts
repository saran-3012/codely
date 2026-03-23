import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { Permission } from '../lib/acl';
import { ValidationError } from '../lib/errors';

const router = Router();

// ── GET /api/v1/logs/access ─────────────────────────────────────
// Query params: page, limit, from, to, status, method, path, userId
router.get(
  '/access',
  authMiddleware,
  requirePermission(Permission.LOGS_ACCESS_READ),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const page   = Math.max(1, parseInt(req.query.page   as string) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip   = (page - 1) * limit;

    const from   = req.query.from   ? new Date(req.query.from as string)   : undefined;
    const to     = req.query.to     ? new Date(req.query.to   as string)   : undefined;
    const status = req.query.status ? parseInt(req.query.status as string) : undefined;
    const method = req.query.method as string | undefined;
    const path   = req.query.path   as string | undefined;
    const userId = req.query.userId as string | undefined;

    if (from && isNaN(from.getTime())) throw new ValidationError('Invalid "from" date', 'INVALID_DATE');
    if (to   && isNaN(to.getTime()))   throw new ValidationError('Invalid "to" date',   'INVALID_DATE');

    const where = {
      ...(from || to   ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(status       ? { statusCode: status }                                    : {}),
      ...(method       ? { method: method.toUpperCase() }                          : {}),
      ...(path         ? { path: { contains: path } }                              : {}),
      ...(userId       ? { userId }                                                 : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.accessLog.count({ where }),
      prisma.accessLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);

    res.json({ total, page, limit, logs });
  })
);

// ── GET /api/v1/logs/app ────────────────────────────────────────
// Query params: page, limit, from, to, level
router.get(
  '/app',
  authMiddleware,
  requirePermission(Permission.LOGS_APP_READ),
  asyncHandler<AuthRequest>(async (req: AuthRequest, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip  = (page - 1) * limit;

    const from  = req.query.from  ? new Date(req.query.from  as string) : undefined;
    const to    = req.query.to    ? new Date(req.query.to    as string) : undefined;
    const level = req.query.level as string | undefined;

    if (from && isNaN(from.getTime())) throw new ValidationError('Invalid "from" date', 'INVALID_DATE');
    if (to   && isNaN(to.getTime()))   throw new ValidationError('Invalid "to" date',   'INVALID_DATE');

    const VALID_LEVELS = ['error', 'warn', 'info', 'debug'];
    if (level && !VALID_LEVELS.includes(level)) {
      throw new ValidationError(`level must be one of: ${VALID_LEVELS.join(', ')}`, 'INVALID_LEVEL');
    }

    const where = {
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(level      ? { level }                                                                        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.appLog.count({ where }),
      prisma.appLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);

    res.json({ total, page, limit, logs });
  })
);

export default router;
