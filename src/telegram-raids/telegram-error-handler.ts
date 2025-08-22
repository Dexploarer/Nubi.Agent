/**
 * Telegram Error Handler & Rate Limiter
 *
 * Implements robust error handling and rate limiting for Telegram operations
 * Based on Telegram API best practices and optimization guidelines
 */

import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { LRUCache } from "lru-cache";

export interface TelegramError {
  error_code: number;
  description: string;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfter: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
  timeoutMs: number;
}

export class TelegramErrorHandler extends Service {
  static serviceType = "telegram_error_handler" as const;
  capabilityDescription = "Telegram API error handling and rate limiting";

  public runtime: IAgentRuntime;
  private rateLimitCache: LRUCache<string, number[]>;
  private errorCache: LRUCache<string, any>;
  private retryQueue: Map<string, NodeJS.Timeout>;

  public config: {
    rateLimit: RateLimitConfig;
    errorHandler: ErrorHandlerConfig;
  };

  // Error counters for monitoring
  private metrics = {
    totalRequests: 0,
    rateLimitHits: 0,
    retries: 0,
    failures: 0,
    successes: 0,
  };

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;

    // Initialize rate limiting cache
    this.rateLimitCache = new LRUCache<string, number[]>({
      max: 10000, // Track up to 10k users/chats
      ttl: 1000 * 60 * 60, // 1 hour TTL
    });

    // Initialize error cache for circuit breaker pattern
    this.errorCache = new LRUCache<string, any>({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minute TTL
    });

    this.retryQueue = new Map();

    this.config = {
      rateLimit: {
        maxRequests: 30, // Telegram limit is ~30/second per bot
        windowMs: 1000, // 1 second window
        retryAfter: 1000, // 1 second retry delay
      },
      errorHandler: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffDelay: 30000, // 30 seconds max
        timeoutMs: 30000, // 30 second timeout
      },
    };
  }

  /**
   * Check rate limit for a specific endpoint/chat
   */
  checkRateLimit(identifier: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
  } {
    const now = Date.now();
    const requests = this.rateLimitCache.get(identifier) || [];

    // Clean expired requests
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < this.config.rateLimit.windowMs,
    );

    if (validRequests.length >= this.config.rateLimit.maxRequests) {
      this.metrics.rateLimitHits++;

      const oldestRequest = Math.min(...validRequests);
      const retryAfter = this.config.rateLimit.windowMs - (now - oldestRequest);

      return {
        allowed: false,
        retryAfter: Math.max(retryAfter, this.config.rateLimit.retryAfter),
        remaining: 0,
      };
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitCache.set(identifier, validRequests);
    this.metrics.totalRequests++;

    return {
      allowed: true,
      remaining: this.config.rateLimit.maxRequests - validRequests.length,
    };
  }

  /**
   * Handle Telegram API errors with appropriate retry logic
   */
  async handleError(
    error: any,
    operation: string,
    attempt: number = 1,
  ): Promise<{
    shouldRetry: boolean;
    retryAfter: number;
    finalError?: Error;
  }> {
    // Parse Telegram error if present
    let telegramError: TelegramError | null = null;
    if (error.response?.data) {
      telegramError = error.response.data;
    }

    const errorCode = telegramError?.error_code || error.code || "UNKNOWN";
    const description =
      telegramError?.description || error.message || "Unknown error";

    logger.warn(
      `[TELEGRAM_ERROR] ${operation} failed (attempt ${attempt}): ${errorCode} - ${description}`,
    );

    // Handle specific Telegram error codes
    switch (errorCode) {
      case 429: // Too Many Requests
        const retryAfter = (telegramError?.parameters?.retry_after || 1) * 1000;
        this.metrics.rateLimitHits++;

        if (attempt < this.config.errorHandler.maxRetries) {
          return { shouldRetry: true, retryAfter };
        }
        break;

      case 400: // Bad Request
        // Usually permanent errors, don't retry
        this.metrics.failures++;
        return {
          shouldRetry: false,
          retryAfter: 0,
          finalError: new Error(`Bad Request: ${description}`),
        };

      case 401: // Unauthorized
      case 403: // Forbidden
        // Authentication/permission errors, don't retry
        this.metrics.failures++;
        return {
          shouldRetry: false,
          retryAfter: 0,
          finalError: new Error(`Authentication error: ${description}`),
        };

      case 404: // Not Found
        // Resource not found, don't retry
        this.metrics.failures++;
        return {
          shouldRetry: false,
          retryAfter: 0,
          finalError: new Error(`Resource not found: ${description}`),
        };

      case 500: // Internal Server Error
      case 502: // Bad Gateway
      case 503: // Service Unavailable
      case 504: // Gateway Timeout
        // Server errors, retry with backoff
        if (attempt < this.config.errorHandler.maxRetries) {
          const backoffDelay = Math.min(
            1000 *
              Math.pow(this.config.errorHandler.backoffMultiplier, attempt - 1),
            this.config.errorHandler.maxBackoffDelay,
          );
          this.metrics.retries++;
          return { shouldRetry: true, retryAfter: backoffDelay };
        }
        break;

      default:
        // Network or unknown errors, retry with backoff
        if (attempt < this.config.errorHandler.maxRetries) {
          const backoffDelay = Math.min(
            1000 *
              Math.pow(this.config.errorHandler.backoffMultiplier, attempt - 1),
            this.config.errorHandler.maxBackoffDelay,
          );
          this.metrics.retries++;
          return { shouldRetry: true, retryAfter: backoffDelay };
        }
    }

    // Max retries exceeded
    this.metrics.failures++;
    return {
      shouldRetry: false,
      retryAfter: 0,
      finalError: new Error(`Max retries exceeded: ${description}`),
    };
  }

  /**
   * Execute operation with rate limiting and error handling
   */
  async executeWithHandling<T>(
    operation: () => Promise<T>,
    identifier: string,
    operationName: string,
  ): Promise<T> {
    // Check rate limit first
    const rateLimitCheck = this.checkRateLimit(identifier);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter}ms`,
      );
    }

    let attempt = 1;
    let lastError: any;

    while (attempt <= this.config.errorHandler.maxRetries) {
      try {
        // Execute the operation with timeout
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(this.config.errorHandler.timeoutMs),
        ]);

        this.metrics.successes++;
        return result as T;
      } catch (error) {
        lastError = error;

        const errorResult = await this.handleError(
          error,
          operationName,
          attempt,
        );

        if (!errorResult.shouldRetry) {
          throw errorResult.finalError || error;
        }

        // Wait before retrying
        if (errorResult.retryAfter > 0) {
          await this.delay(errorResult.retryAfter);
        }

        attempt++;
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Queue operation for later execution (useful for rate limiting)
   */
  async queueOperation<T>(
    operation: () => Promise<T>,
    identifier: string,
    operationName: string,
    delay: number = 0,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const result = await this.executeWithHandling(
            operation,
            identifier,
            operationName,
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (delay > 0) {
        const timeout = setTimeout(execute, delay);
        this.retryQueue.set(`${identifier}_${Date.now()}`, timeout);
      } else {
        execute();
      }
    });
  }

  /**
   * Circuit breaker pattern - stop trying if too many failures
   */
  isCircuitBreakerOpen(identifier: string): boolean {
    const errorHistory = this.errorCache.get(identifier) || {
      failures: 0,
      lastFailure: 0,
    };
    const now = Date.now();

    // Reset if last failure was more than 5 minutes ago
    if (now - errorHistory.lastFailure > 5 * 60 * 1000) {
      errorHistory.failures = 0;
    }

    // Open circuit if too many recent failures
    return errorHistory.failures > 5;
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure(identifier: string): void {
    const errorHistory = this.errorCache.get(identifier) || {
      failures: 0,
      lastFailure: 0,
    };
    errorHistory.failures++;
    errorHistory.lastFailure = Date.now();
    this.errorCache.set(identifier, errorHistory);
  }

  /**
   * Record success for circuit breaker
   */
  recordSuccess(identifier: string): void {
    const errorHistory = this.errorCache.get(identifier);
    if (errorHistory) {
      errorHistory.failures = 0;
      this.errorCache.set(identifier, errorHistory);
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      rateLimitCacheSize: this.rateLimitCache.size,
      errorCacheSize: this.errorCache.size,
      queuedOperations: this.retryQueue.size,
      successRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.successes / this.metrics.totalRequests) * 100
          : 0,
    };
  }

  /**
   * Clear rate limits for a specific identifier (admin function)
   */
  clearRateLimit(identifier: string): void {
    this.rateLimitCache.delete(identifier);
  }

  /**
   * Reset circuit breaker for a specific identifier
   */
  resetCircuitBreaker(identifier: string): void {
    this.errorCache.delete(identifier);
  }

  // Helper methods
  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Operation timeout")), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async stop(): Promise<void> {
    // Clear all pending operations
    for (const timeout of this.retryQueue.values()) {
      clearTimeout(timeout);
    }
    this.retryQueue.clear();

    // Clear caches
    this.rateLimitCache.clear();
    this.errorCache.clear();

    logger.info("TelegramErrorHandler stopped");
  }
}

export default TelegramErrorHandler;
