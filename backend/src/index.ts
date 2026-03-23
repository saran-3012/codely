import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initConfig, CONFIG } from './config';
import { AppError } from './lib/errors';
import authRoutes from './routes/auth';
import executeRoutes from './routes/execute';

initConfig();

const app = express();
const PORT = CONFIG.PORT.getIntegerValue();

app.use(helmet());
app.use(
  cors({
    origin: CONFIG.FRONTEND_URL.getStringValue(),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/execute', executeRoutes);

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
  console.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
