import { Service, IAgentRuntime, Memory, logger } from "@elizaos/core";

/**
 * Messaging Analytics Service
 *
 * Comprehensive logging and analytics for the NUBI messaging pipeline:
 * - Response generation metrics
 * - Context utilization tracking
 * - Model parameter optimization insights
 * - Performance monitoring
 * - Error analysis and reporting
 */

interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ResponseMetrics {
  generationTime: number;
  modelClass: string;
  temperature: number;
  contextUsed: boolean;
  userRecords: number;
  semanticMemories: number;
  emotionalState?: string;
  responseLength: number;
  success: boolean;
  error?: string;
}

interface ContextMetrics {
  buildTime: number;
  memoriesRetrieved: number;
  patternsFound: number;
  relationshipsLoaded: number;
  userRecordsFound: number;
  semanticMatches: number;
  cacheHit: boolean;
}

export class MessagingAnalyticsService extends Service {
  static serviceType = "messaging_analytics" as const;
  capabilityDescription =
    "Comprehensive messaging pipeline analytics and monitoring";

  private events: AnalyticsEvent[] = [];
  private maxEvents = 10000; // Keep last 10k events in memory
  private responseMetrics: ResponseMetrics[] = [];
  private contextMetrics: ContextMetrics[] = [];

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<MessagingAnalyticsService> {
    const service = new MessagingAnalyticsService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    logger.info("[MESSAGING_ANALYTICS] Analytics service initialized");

    // Start periodic reporting
    setInterval(
      () => {
        this.generatePeriodicReport();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
  }

  /**
   * Track response generation metrics
   */
  trackResponseGeneration(metrics: ResponseMetrics): void {
    this.responseMetrics.push({
      ...metrics,
      timestamp: Date.now(),
    } as any);

    // Keep only recent metrics
    if (this.responseMetrics.length > 1000) {
      this.responseMetrics = this.responseMetrics.slice(-500);
    }

    // Log significant events
    if (!metrics.success) {
      logger.warn(
        "[MESSAGING_ANALYTICS] Response generation failed:",
        JSON.stringify({
          error: metrics.error,
          modelClass: metrics.modelClass,
          temperature: metrics.temperature,
          contextUsed: metrics.contextUsed,
        }),
      );
    } else if (metrics.generationTime > 5000) {
      logger.warn(
        "[MESSAGING_ANALYTICS] Slow response generation:",
        JSON.stringify({
          time: metrics.generationTime,
          modelClass: metrics.modelClass,
          contextUsed: metrics.contextUsed,
        }),
      );
    }

    this.recordEvent("response_generated", metrics);
  }

  /**
   * Track context building metrics
   */
  trackContextBuilding(metrics: ContextMetrics): void {
    this.contextMetrics.push({
      ...metrics,
      timestamp: Date.now(),
    } as any);

    // Keep only recent metrics
    if (this.contextMetrics.length > 1000) {
      this.contextMetrics = this.contextMetrics.slice(-500);
    }

    // Log performance issues
    if (metrics.buildTime > 2000) {
      logger.warn(
        "[MESSAGING_ANALYTICS] Slow context building:",
        JSON.stringify({
          time: metrics.buildTime,
          memoriesRetrieved: metrics.memoriesRetrieved,
          cacheHit: metrics.cacheHit,
        }),
      );
    }

    this.recordEvent("context_built", metrics);
  }

  /**
   * Track model parameter adjustments
   */
  trackParameterAdjustment(
    originalParams: any,
    adjustedParams: any,
    reason: string,
  ): void {
    const adjustmentData = {
      original: originalParams,
      adjusted: adjustedParams,
      reason,
      temperatureDelta: adjustedParams.temperature - originalParams.temperature,
      modelClassChanged:
        originalParams.modelClass !== adjustedParams.modelClass,
    };

    logger.debug(
      "[MESSAGING_ANALYTICS] Parameter adjustment:",
      JSON.stringify(adjustmentData),
    );
    this.recordEvent("parameter_adjusted", adjustmentData);
  }

  /**
   * Track cache performance
   */
  trackCachePerformance(cacheType: string, hit: boolean, key?: string): void {
    const cacheData = {
      type: cacheType,
      hit,
      key: key?.substring(0, 50) + (key && key.length > 50 ? "..." : ""),
    };

    this.recordEvent("cache_access", cacheData);
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(
    queryType: string,
    duration: number,
    recordCount: number,
    error?: string,
  ): void {
    const queryData = {
      type: queryType,
      duration,
      recordCount,
      error,
      slow: duration > 1000,
    };

    if (error) {
      logger.error(
        `[MESSAGING_ANALYTICS] Database query failed [${queryType}]:`,
        error,
      );
    } else if (duration > 1000) {
      logger.warn(
        `[MESSAGING_ANALYTICS] Slow database query [${queryType}]: ${duration}ms`,
      );
    }

    this.recordEvent("database_query", queryData);
  }

  /**
   * Record generic analytics event
   */
  recordEvent(
    type: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
  ): void {
    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      data,
      metadata,
    };

    this.events.push(event);

    // Maintain rolling window
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents * 0.8);
    }
  }

  /**
   * Get response performance analytics
   */
  getResponseAnalytics(timeWindow: number = 3600000): any {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.responseMetrics.filter(
      (m: any) => m.timestamp > cutoff,
    );

    if (recentMetrics.length === 0) {
      return { message: "No recent response data" };
    }

    const successful = recentMetrics.filter((m) => m.success);
    const failed = recentMetrics.filter((m) => !m.success);

    return {
      total: recentMetrics.length,
      successful: successful.length,
      failed: failed.length,
      successRate:
        ((successful.length / recentMetrics.length) * 100).toFixed(2) + "%",
      avgGenerationTime: Math.round(
        successful.reduce((sum, m) => sum + m.generationTime, 0) /
          successful.length,
      ),
      avgResponseLength: Math.round(
        successful.reduce((sum, m) => sum + m.responseLength, 0) /
          successful.length,
      ),
      modelUsage: this.aggregateModelUsage(successful),
      avgTemperature: (
        successful.reduce((sum, m) => sum + m.temperature, 0) /
        successful.length
      ).toFixed(2),
      contextUsageRate:
        (
          (successful.filter((m) => m.contextUsed).length / successful.length) *
          100
        ).toFixed(2) + "%",
      commonErrors: this.aggregateErrors(failed),
      timeWindow: `${timeWindow / 1000}s`,
    };
  }

  /**
   * Get context building analytics
   */
  getContextAnalytics(timeWindow: number = 3600000): any {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.contextMetrics.filter(
      (m: any) => m.timestamp > cutoff,
    );

    if (recentMetrics.length === 0) {
      return { message: "No recent context data" };
    }

    return {
      total: recentMetrics.length,
      avgBuildTime: Math.round(
        recentMetrics.reduce((sum, m) => sum + m.buildTime, 0) /
          recentMetrics.length,
      ),
      cacheHitRate:
        (
          (recentMetrics.filter((m) => m.cacheHit).length /
            recentMetrics.length) *
          100
        ).toFixed(2) + "%",
      avgMemoriesRetrieved: Math.round(
        recentMetrics.reduce((sum, m) => sum + m.memoriesRetrieved, 0) /
          recentMetrics.length,
      ),
      avgUserRecords: Math.round(
        recentMetrics.reduce((sum, m) => sum + m.userRecordsFound, 0) /
          recentMetrics.length,
      ),
      avgPatterns: Math.round(
        recentMetrics.reduce((sum, m) => sum + m.patternsFound, 0) /
          recentMetrics.length,
      ),
      timeWindow: `${timeWindow / 1000}s`,
    };
  }

  /**
   * Generate periodic analytics report
   */
  private generatePeriodicReport(): void {
    const responseAnalytics = this.getResponseAnalytics(300000); // Last 5 minutes
    const contextAnalytics = this.getContextAnalytics(300000);

    logger.info(
      "[MESSAGING_ANALYTICS] Periodic Report:",
      JSON.stringify({
        responses: responseAnalytics,
        context: contextAnalytics,
        cacheSize: this.events.length,
      }),
    );
  }

  /**
   * Aggregate model usage statistics
   */
  private aggregateModelUsage(
    metrics: ResponseMetrics[],
  ): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const metric of metrics) {
      usage[metric.modelClass] = (usage[metric.modelClass] || 0) + 1;
    }

    return usage;
  }

  /**
   * Aggregate error statistics
   */
  private aggregateErrors(
    failedMetrics: ResponseMetrics[],
  ): Record<string, number> {
    const errors: Record<string, number> = {};

    for (const metric of failedMetrics) {
      if (metric.error) {
        const errorType = metric.error.split(":")[0] || "unknown";
        errors[errorType] = (errors[errorType] || 0) + 1;
      }
    }

    return errors;
  }

  /**
   * Get detailed analytics for debugging
   */
  getDetailedAnalytics(): any {
    return {
      responseAnalytics: this.getResponseAnalytics(),
      contextAnalytics: this.getContextAnalytics(),
      recentEvents: this.events.slice(-50),
      systemHealth: {
        eventQueueSize: this.events.length,
        responseMetricsCount: this.responseMetrics.length,
        contextMetricsCount: this.contextMetrics.length,
      },
    };
  }

  /**
   * Clear old analytics data
   */
  clearOldData(olderThanMs: number = 86400000): void {
    const cutoff = Date.now() - olderThanMs;

    this.events = this.events.filter((e) => e.timestamp > cutoff);
    this.responseMetrics = this.responseMetrics.filter(
      (m: any) => m.timestamp > cutoff,
    );
    this.contextMetrics = this.contextMetrics.filter(
      (m: any) => m.timestamp > cutoff,
    );

    logger.info(
      `[MESSAGING_ANALYTICS] Cleared analytics data older than ${olderThanMs}ms`,
    );
  }

  async stop(): Promise<void> {
    logger.info("[MESSAGING_ANALYTICS] Analytics service stopped");
  }
}

export default MessagingAnalyticsService;
