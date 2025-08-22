import winston from 'winston';

// Define more specific types for logging context
export type LogContext = Record<string, unknown>;

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'twitter-mcp-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          return `${timestamp} ${level}: ${message} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}`;
        })
      ),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Create a stream object with a write function that will call the logger
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Utility functions for common logging patterns
export const logError = (message: string, error: unknown, context?: LogContext) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(message, {
    error: errorMessage,
    stack,
    ...context,
  });
};

export const logInfo = (message: string, context?: LogContext) => {
  logger.info(message, context);
};

export const logWarning = (message: string, context?: LogContext) => {
  logger.warn(message, context);
};

export const logDebug = (message: string, context?: LogContext) => {
  logger.debug(message, context);
};

// Sanitize sensitive data before logging
export const sanitizeForLogging = (data: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'cookie',
    'auth',
    'credential',
    'apiKey',
    'apiSecret',
    'accessToken',
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key] as Record<string, unknown>);
    }
  }

  return sanitized;
};
