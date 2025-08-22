import { logger } from "@elizaos/core";

/**
 * Error Handling Utilities for ElizaOS Services
 */

export interface ServiceError {
  service: string;
  method: string;
  error: Error;
  context?: any;
  timestamp: Date;
  correlationId?: string;
}

export class ServiceErrorHandler {
  private static errors: ServiceError[] = [];
  private static readonly MAX_ERROR_HISTORY = 100;

  /**
   * Wrap a service method with error handling
   */
  static async wrapMethod<T>(
    serviceName: string,
    methodName: string,
    fn: () => Promise<T>,
    fallback?: T,
    context?: any
  ): Promise<T> {
    const correlationId = `${serviceName}_${methodName}_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.debug(`[${serviceName}] Executing ${methodName} - ${JSON.stringify({ correlationId, context })}`);
      const result = await fn();
      const duration = Date.now() - startTime;
      logger.debug(`[${serviceName}] ${methodName} completed in ${duration}ms - ${JSON.stringify({ correlationId })}`);
      return result;
    } catch (error) {
      const serviceError: ServiceError = {
        service: serviceName,
        method: methodName,
        error: error instanceof Error ? error : new Error(String(error)),
        context,
        timestamp: new Date(),
        correlationId,
      };

      this.logError(serviceError);
      this.recordError(serviceError);

      // Return fallback if provided
      if (fallback !== undefined) {
        logger.warn(`[${serviceName}] ${methodName} failed, using fallback`, JSON.stringify({ correlationId }));
        return fallback;
      }

      // Re-throw if no fallback
      throw serviceError.error;
    }
  }

  /**
   * Wrap a service method that doesn't return a value
   */
  static async wrapVoid(
    serviceName: string,
    methodName: string,
    fn: () => Promise<void>,
    context?: any
  ): Promise<void> {
    await this.wrapMethod(serviceName, methodName, fn, undefined, context);
  }

  /**
   * Create a transaction wrapper with rollback support
   */
  static async wrapTransaction<T>(
    serviceName: string,
    methodName: string,
    fn: () => Promise<T>,
    rollback?: () => Promise<void>,
    context?: any
  ): Promise<T> {
    try {
      return await this.wrapMethod(serviceName, methodName, fn, undefined, context);
    } catch (error) {
      if (rollback) {
        logger.warn(`[${serviceName}] Rolling back ${methodName}`);
        try {
          await rollback();
          logger.info(`[${serviceName}] Rollback completed for ${methodName}`);
        } catch (rollbackError) {
          logger.error(`[${serviceName}] Rollback failed for ${methodName}:`, rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Log error with structured format
   */
  private static logError(error: ServiceError): void {
    logger.error(
      `[${error.service}] ${error.method} failed: ${error.error.message}`,
      JSON.stringify({
        stack: error.error.stack,
        context: error.context,
        correlationId: error.correlationId,
      })
    );
  }

  /**
   * Record error for metrics and debugging
   */
  private static recordError(error: ServiceError): void {
    this.errors.push(error);
    if (this.errors.length > this.MAX_ERROR_HISTORY) {
      this.errors.shift();
    }
  }

  /**
   * Get recent errors for debugging
   */
  static getRecentErrors(): ServiceError[] {
    return [...this.errors];
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const error of this.errors) {
      const key = `${error.service}.${error.method}`;
      stats[key] = (stats[key] || 0) + 1;
    }
    return stats;
  }

  /**
   * Clear error history
   */
  static clearErrors(): void {
    this.errors = [];
  }
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(serviceName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return ServiceErrorHandler.wrapMethod(
        serviceName,
        propertyKey,
        () => originalMethod.apply(this, args),
        undefined,
        { args }
      );
    };

    return descriptor;
  };
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        logger.debug(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Retry failed");
}

export default ServiceErrorHandler;
