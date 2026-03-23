import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';

/**
 * Access log middleware.
 * Records every request to the AccessLog table: method, path, status, response time, IP, userId.
 * Must be registered BEFORE routes so it can measure full response time.
 */
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const responseTimeMs = Date.now() - startedAt;
    const userId = (req as AuthRequest).userId ?? null;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    prisma.accessLog.create({
      data: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTimeMs,
        ip,
        userId,
      },
    }).catch((err) => {
      process.stderr.write(`[accessLog] Failed to write access log: ${err}\n`);
    });
  });

  next();
}
