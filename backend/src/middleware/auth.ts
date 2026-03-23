import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '../lib/errors';
import { CONFIG } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AuthError('No token provided', 'NO_TOKEN'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET.getStringValue()) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    next(new AuthError('Invalid or expired token', 'INVALID_TOKEN'));
  }
};
