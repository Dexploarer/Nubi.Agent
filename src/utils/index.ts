/**
 * Utils Module - Common utilities and helper functions
 *
 * This module provides shared utilities for error handling, logging,
 * and other common functionality across the application.
 */

// Error handling utilities
export { ServiceErrorHandler } from "./error-handler";
export type { ServiceError } from "./error-handler";

// Logger utilities (re-export from ElizaOS core)
export { logger } from "./logger";

// Utility types
export interface ErrorContext {
  service: string;
  method: string;
  context?: any;
  correlationId?: string;
}

// Utility functions
export function createCorrelationId(service: string, method: string): string {
  return `${service}_${method}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function createErrorContext(
  service: string,
  method: string,
  context?: any,
): ErrorContext {
  return {
    service,
    method,
    context,
    correlationId: createCorrelationId(service, method),
  };
}
