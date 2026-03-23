import { Request, Response, NextFunction } from 'express';

/**
 * Error handling framework wrapper for async Express route handlers.
 *
 * All async route handlers MUST use this wrapper — it auto-catches thrown errors
 * (including AppError subclasses) and forwards them to the global error handler,
 * eliminating repetitive try/catch boilerplate.
 *
 * Usage (standard route):
 *   router.post('/path', asyncHandler(async (req, res) => {
 *     if (!valid) throw new ValidationError('...', '...');  // no try/catch needed
 *     res.json({ ok: true });
 *   }));
 *
 * Usage (auth-protected route, after authMiddleware):
 *   router.get('/me', authMiddleware, asyncHandler<AuthRequest>(async (req, res) => {
 *     const userId = req.userId;  // req is typed as AuthRequest
 *   }));
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
