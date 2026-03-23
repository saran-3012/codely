import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
});

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    res.status(201).json({ message: 'Account created', userId: user.id });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies.refreshToken;

  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as { userId: string };

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: decoded.userId, expiresAt },
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
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
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
