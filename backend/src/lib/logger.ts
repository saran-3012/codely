import prisma from './prisma';

/**
 * Application logger — writes to the AppLog table.
 * Access: import { logger } from './logger';
 *
 * Usage:
 *   logger.info('Server started', { port: 3000 });
 *   logger.error('DB connection failed', { error: err.message });
 */
export const logger = {
  info:  (message: string, meta?: Record<string, unknown>) => write('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => write('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
};

function write(level: string, message: string, meta?: Record<string, unknown>): void {
  // Fire-and-forget — never block the request path
  prisma.appLog.create({ data: { level, message, meta: meta as object ?? undefined } }).catch((err) => {
    // Fallback to stderr if DB insert fails (avoids infinite loop)
    process.stderr.write(`[logger fallback] ${level.toUpperCase()} ${message} ${JSON.stringify(meta ?? {})} — ${err}\n`);
  });
}
