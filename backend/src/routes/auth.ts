import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { CONFIG } from '../config';
import { ValidationError, AuthError, ConflictError, NotFoundError } from '../lib/errors';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS.getIntegerValue(),
  max: CONFIG.RATE_LIMIT_MAX.getIntegerValue(),
  message: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' },
});

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, CONFIG.JWT_SECRET.getStringValue(), {
    expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY.getStringValue() as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ userId }, CONFIG.REFRESH_TOKEN_SECRET.getStringValue(), {
    expiresIn: CONFIG.REFRESH_TOKEN_EXPIRY.getStringValue() as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
};

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ValidationError('Email and password are required', 'MISSING_FIELDS');
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('Email already in use', 'EMAIL_IN_USE');

  const passwordHash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS.getIntegerValue());
  const user = await prisma.user.create({ data: { email, passwordHash } });

  res.status(201).json({ message: 'Account created', userId: user.id });
}));

// Login
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ValidationError('Email and password are required', 'MISSING_FIELDS');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');

  const { accessToken, refreshToken } = generateTokens(user.id);

  const expiresAt = new Date(Date.now() + CONFIG.REFRESH_TOKEN_MAX_AGE_MS.getIntegerValue());
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: CONFIG.NODE_ENV.getStringValue() === 'production',
    sameSite: 'strict',
    maxAge: CONFIG.REFRESH_TOKEN_MAX_AGE_MS.getIntegerValue(),
  });

  res.json({ accessToken, user: { id: user.id, email: user.email } });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw new AuthError('No refresh token', 'NO_REFRESH_TOKEN');

  let decoded: { userId: string };
  try {
    decoded = jwt.verify(token, CONFIG.REFRESH_TOKEN_SECRET.getStringValue()) as { userId: string };
  } catch {
    throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AuthError('Session expired, please log in again', 'REFRESH_TOKEN_EXPIRED');
  }

  await prisma.refreshToken.delete({ where: { token } });

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

  const expiresAt = new Date(Date.now() + CONFIG.REFRESH_TOKEN_MAX_AGE_MS.getIntegerValue());
  await prisma.refreshToken.create({
    data: { token: newRefreshToken, userId: decoded.userId, expiresAt },
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: CONFIG.NODE_ENV.getStringValue() === 'production',
    sameSite: 'strict',
    maxAge: CONFIG.REFRESH_TOKEN_MAX_AGE_MS.getIntegerValue(),
  });

  res.json({ accessToken });
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    try {
      await prisma.refreshToken.delete({ where: { token } });
    } catch {
      // Token may not exist in DB — that's fine
    }
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
}));

// Get current user
router.get('/me', authMiddleware, asyncHandler<AuthRequest>(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  res.json({ user });
}));

export default router;
