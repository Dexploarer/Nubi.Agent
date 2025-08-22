import winston from 'winston';
export type LogContext = Record<string, unknown>;
export declare const logger: winston.Logger;
export declare const logStream: {
    write: (message: string) => void;
};
export declare const logError: (message: string, error: unknown, context?: LogContext) => void;
export declare const logInfo: (message: string, context?: LogContext) => void;
export declare const logWarning: (message: string, context?: LogContext) => void;
export declare const logDebug: (message: string, context?: LogContext) => void;
export declare const sanitizeForLogging: (data: Record<string, unknown>) => Record<string, unknown>;
