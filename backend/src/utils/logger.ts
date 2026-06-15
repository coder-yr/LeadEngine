import pino from 'pino';
import crypto from 'node:crypto';

// Base logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Creates a child logger bound with a specific traceId.
 * If no traceId is provided, generates a new one.
 */
export const createTraceLogger = (traceId?: string) => {
  const id = traceId || crypto.randomUUID();
  return {
    traceId: id,
    logger: logger.child({ traceId: id }),
  };
};
