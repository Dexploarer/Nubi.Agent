/**
 * Observability exports for ElizaOS NUBI Agent
 *
 * Provides comprehensive metrics, monitoring, and observability capabilities
 */

import { logger } from "@elizaos/core";
import {
  metricsIncrementMessageReceived,
  metricsIncrementErrors,
  metricsGetText,
} from "./metrics";

export {
  metricsIncrementMessageReceived,
  metricsIncrementErrors,
  metricsGetText,
} from "./metrics";

// Re-export the metrics registry for advanced usage
// Note: metrics.ts doesn't export a default, so we'll export the functions directly

/**
 * Observability utilities for enhanced monitoring
 */
export const observabilityUtils = {
  /**
   * Create a performance timer for measuring execution time
   */
  createTimer: (name: string) => {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        logger.debug(`[PERF] ${name}: ${duration}ms`);
        return duration;
      },
      getElapsed: () => Date.now() - startTime,
    };
  },

  /**
   * Track memory usage
   */
  getMemoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
    };
  },

  /**
   * Create a health check response
   */
  createHealthCheck: () => {
    const memoryUsage = observabilityUtils.getMemoryUsage();
    const uptime = process.uptime();

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      memory: memoryUsage,
      version: process.env.npm_package_version || "1.0.0",
    };
  },

  /**
   * Log structured metrics
   */
  logMetrics: (metrics: Record<string, any>) => {
    logger.info(
      `[METRICS] ${JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "metrics",
        ...metrics,
      })}`,
    );
  },
};

/**
 * Enhanced metrics collection for NUBI agent
 */
export const nubiMetrics = {
  /**
   * Track message processing
   */
  trackMessageProcessing: (
    platform: string,
    success: boolean,
    duration: number,
  ) => {
    observabilityUtils.logMetrics({
      event: "message_processed",
      platform,
      success,
      duration_ms: duration,
    });
  },

  /**
   * Track action execution
   */
  trackActionExecution: (
    actionName: string,
    success: boolean,
    duration: number,
  ) => {
    observabilityUtils.logMetrics({
      event: "action_executed",
      action: actionName,
      success,
      duration_ms: duration,
    });
  },

  /**
   * Track model usage
   */
  trackModelUsage: (modelName: string, tokensUsed: number, cost: number) => {
    observabilityUtils.logMetrics({
      event: "model_used",
      model: modelName,
      tokens: tokensUsed,
      cost_usd: cost,
    });
  },

  /**
   * Track error occurrence
   */
  trackError: (
    errorType: string,
    errorMessage: string,
    context?: Record<string, any>,
  ) => {
    observabilityUtils.logMetrics({
      event: "error_occurred",
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    });
  },
};

// Export default observability interface
export default {
  metrics: {
    incrementMessageReceived: metricsIncrementMessageReceived,
    incrementErrors: metricsIncrementErrors,
    getText: metricsGetText,
  },
  utils: observabilityUtils,
  nubiMetrics,
};
