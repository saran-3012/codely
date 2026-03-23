import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initConfig, CONFIG } from './config';
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { startLogCleanup } from './lib/logCleanup';
import { accessLogMiddleware } from './middleware/accessLog';
import authRoutes from './routes/auth';
import executeRoutes from './routes/execute';
import logsRoutes from './routes/logs';
import usersRoutes from './routes/users';

initConfig();

const app = express();
const PORT = CONFIG.PORT.getIntegerValue();

app.use(helmet());
app.use(
  cors({
    origin: CONFIG.FRONTEND_URL.getStringValue().split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(accessLogMiddleware);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/execute', executeRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use('/api/v1/users', usersRoutes);

// ── Global error handler ────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }
  console.error('[Unhandled error]', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
});

// ── Process-level fault guards ──────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('UnhandledRejection', { reason: String(reason) });
  console.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('UncaughtException', { error: err.message });
  console.error('[UncaughtException]', err);
  process.exit(1);
});

app.listen(PORT, () => {
  startLogCleanup();
  logger.info('Server started', { port: PORT });
  console.log(`Server running on port ${PORT}`);
});
