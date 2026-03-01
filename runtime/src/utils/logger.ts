import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

const baseLogger = pino({
  level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export function createLogger(name: string) {
  return baseLogger.child({ name });
}

export { baseLogger as logger };
