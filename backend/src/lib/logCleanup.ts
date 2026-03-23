import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

const ACCESS_LOG_RETENTION_MS = 60 * 60 * 1000;      // 1 hour
const APP_LOG_RETENTION_MS    = 24 * 60 * 60 * 1000; // 1 day
const CLEANUP_INTERVAL_MS     = 5 * 60 * 1000;        // every 5 minutes

async function runCleanup(): Promise<void> {
  const now = Date.now();

  const [accessDeleted, appDeleted] = await Promise.all([
    prisma.accessLog.deleteMany({
      where: { createdAt: { lt: new Date(now - ACCESS_LOG_RETENTION_MS) } },
    }),
    prisma.appLog.deleteMany({
      where: { createdAt: { lt: new Date(now - APP_LOG_RETENTION_MS) } },
    }),
  ]);

  if (accessDeleted.count > 0 || appDeleted.count > 0) {
    logger.info('Log cleanup completed', {
      accessLogsDeleted: accessDeleted.count,
      appLogsDeleted: appDeleted.count,
    });
  }
}

export function startLogCleanup(): void {
  // Run once immediately on startup, then on schedule
  runCleanup().catch((err) => logger.error('Log cleanup failed', { error: String(err) }));

  setInterval(() => {
    runCleanup().catch((err) => logger.error('Log cleanup failed', { error: String(err) }));
  }, CLEANUP_INTERVAL_MS);
}
