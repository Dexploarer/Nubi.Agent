/**
 * ClickHouse Pipeline Analytics Service
 * High-performance logging for two-layer pre-processing pipeline
 */

import { logger } from "@elizaos/core";
import crypto from "crypto";

export interface PipelineEvent {
  traceId: string;
  layer: "layer1" | "layer2";
  platform: "telegram" | "discord" | "websocket" | "api";
  eventType:
    | "security_check"
    | "rate_limit"
    | "normalization"
    | "classification"
    | "routing";
  userId: string;
  messageId: string;
  processingTimeMs: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export interface UserEngagementEvent {
  userId: string;
  platform: "telegram" | "discord" | "websocket";
  engagementType: "mention" | "random" | "response" | "ignored";
  messageContent: string;
  nubiMentioned: boolean;
  randomTrigger: boolean;
  responseGenerated: boolean;
  processingTimeMs: number;
  metadata?: any;
}

export interface PromptRoutingEvent {
  traceId: string;
  userId: string;
  platform: "telegram" | "discord" | "websocket";
  messageContent: string;
  extractedVariables: any;
  classifiedIntent: string;
  selectedPrompt:
    | "community-manager"
    | "raid-coordinator"
    | "crypto-analyst"
    | "meme-lord"
    | "support-agent"
    | "personality-core"
    | "emergency-handler";
  confidenceScore: number;
  processingTimeMs: number;
  metadata?: any;
}

export interface SecurityEvent {
  platform: "telegram" | "discord" | "websocket" | "api";
  eventType:
    | "rate_limit"
    | "invalid_signature"
    | "blocked_ip"
    | "spam_detected";
  sourceIp: string;
  userId?: string;
  severity: "low" | "medium" | "high" | "critical";
  blocked: boolean;
  metadata?: any;
}

export class ClickHousePipelineAnalytics {
  private clickhouseHost: string;
  private clickhouseUser: string;
  private clickhousePassword: string;
  private database: string;
  private batchSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds
  private batches: {
    pipeline: PipelineEvent[];
    engagement: UserEngagementEvent[];
    routing: PromptRoutingEvent[];
    security: SecurityEvent[];
  };
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.clickhouseHost = process.env.CLICKHOUSE_HOST || "";
    this.clickhouseUser = process.env.CLICKHOUSE_USER || "default";
    this.clickhousePassword = process.env.CLICKHOUSE_PASSWORD || "";
    this.database = process.env.CLICKHOUSE_DATABASE || "elizaos_analytics";

    this.batches = {
      pipeline: [],
      engagement: [],
      routing: [],
      security: [],
    };

    if (this.clickhouseHost) {
      this.startFlushTimer();
      logger.info("[CLICKHOUSE] Pipeline analytics initialized");
    } else {
      logger.warn("[CLICKHOUSE] No host configured, analytics disabled");
    }
  }

  /**
   * Generate a trace ID for request tracing
   */
  generateTraceId(): string {
    return crypto.randomUUID();
  }

  /**
   * Log pipeline processing event
   */
  async logPipelineEvent(event: PipelineEvent): Promise<void> {
    if (!this.clickhouseHost) return;

    this.batches.pipeline.push(event);

    if (this.batches.pipeline.length >= this.batchSize) {
      await this.flushPipelineEvents();
    }
  }

  /**
   * Log user engagement event
   */
  async logEngagementEvent(event: UserEngagementEvent): Promise<void> {
    if (!this.clickhouseHost) return;

    this.batches.engagement.push(event);

    if (this.batches.engagement.length >= this.batchSize) {
      await this.flushEngagementEvents();
    }
  }

  /**
   * Log prompt routing event
   */
  async logRoutingEvent(event: PromptRoutingEvent): Promise<void> {
    if (!this.clickhouseHost) return;

    this.batches.routing.push(event);

    if (this.batches.routing.length >= this.batchSize) {
      await this.flushRoutingEvents();
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    if (!this.clickhouseHost) return;

    this.batches.security.push(event);

    if (this.batches.security.length >= this.batchSize) {
      await this.flushSecurityEvents();
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushAllBatches();
    }, this.flushInterval);
  }

  /**
   * Flush all batches
   */
  private async flushAllBatches(): Promise<void> {
    await Promise.all([
      this.flushPipelineEvents(),
      this.flushEngagementEvents(),
      this.flushRoutingEvents(),
      this.flushSecurityEvents(),
    ]);
  }

  /**
   * Flush pipeline events batch
   */
  private async flushPipelineEvents(): Promise<void> {
    if (this.batches.pipeline.length === 0) return;

    const events = this.batches.pipeline.splice(0);

    try {
      const values = events
        .map(
          (event) =>
            `('${event.traceId}', '${event.layer}', '${event.platform}', '${event.eventType}', '${event.userId}', '${event.messageId}', ${event.processingTimeMs}, ${event.success}, ${event.error ? `'${event.error.replace(/'/g, "''")}'` : "NULL"}, '${JSON.stringify(event.metadata || {}).replace(/'/g, "''")}')`,
        )
        .join(",");

      const query = `INSERT INTO ${this.database}.pipeline_events (trace_id, layer, platform, event_type, user_id, message_id, processing_time_ms, success, error, metadata) VALUES ${values}`;

      await this.executeQuery(query);

      logger.debug(`[CLICKHOUSE] Flushed ${events.length} pipeline events`);
    } catch (error) {
      logger.error(
        "[CLICKHOUSE] Failed to flush pipeline events:",
        error instanceof Error ? error.message : String(error),
      );
      // Re-add events to batch for retry
      this.batches.pipeline.unshift(...events);
    }
  }

  /**
   * Flush engagement events batch
   */
  private async flushEngagementEvents(): Promise<void> {
    if (this.batches.engagement.length === 0) return;

    const events = this.batches.engagement.splice(0);

    try {
      const values = events
        .map(
          (event) =>
            `('${event.userId}', '${event.platform}', '${event.engagementType}', '${event.messageContent.replace(/'/g, "''")}', ${event.nubiMentioned}, ${event.randomTrigger}, ${event.responseGenerated}, ${event.processingTimeMs}, '${JSON.stringify(event.metadata || {}).replace(/'/g, "''")}')`,
        )
        .join(",");

      const query = `INSERT INTO ${this.database}.user_engagement (user_id, platform, engagement_type, message_content, nubi_mentioned, random_trigger, response_generated, processing_time_ms, metadata) VALUES ${values}`;

      await this.executeQuery(query);

      logger.debug(`[CLICKHOUSE] Flushed ${events.length} engagement events`);
    } catch (error) {
      logger.error(
        "[CLICKHOUSE] Failed to flush engagement events:",
        error instanceof Error ? error.message : String(error),
      );
      // Re-add events to batch for retry
      this.batches.engagement.unshift(...events);
    }
  }

  /**
   * Flush routing events batch
   */
  private async flushRoutingEvents(): Promise<void> {
    if (this.batches.routing.length === 0) return;

    const events = this.batches.routing.splice(0);

    try {
      const values = events
        .map(
          (event) =>
            `('${event.traceId}', '${event.userId}', '${event.platform}', '${event.messageContent.replace(/'/g, "''")}', '${JSON.stringify(event.extractedVariables).replace(/'/g, "''")}', '${event.classifiedIntent}', '${event.selectedPrompt}', ${event.confidenceScore}, ${event.processingTimeMs}, '${JSON.stringify(event.metadata || {}).replace(/'/g, "''")}')`,
        )
        .join(",");

      const query = `INSERT INTO ${this.database}.prompt_routing (trace_id, user_id, platform, message_content, extracted_variables, classified_intent, selected_prompt, confidence_score, processing_time_ms, metadata) VALUES ${values}`;

      await this.executeQuery(query);

      logger.debug(`[CLICKHOUSE] Flushed ${events.length} routing events`);
    } catch (error) {
      logger.error(
        "[CLICKHOUSE] Failed to flush routing events:",
        error instanceof Error ? error.message : String(error),
      );
      // Re-add events to batch for retry
      this.batches.routing.unshift(...events);
    }
  }

  /**
   * Flush security events batch
   */
  private async flushSecurityEvents(): Promise<void> {
    if (this.batches.security.length === 0) return;

    const events = this.batches.security.splice(0);

    try {
      const values = events
        .map(
          (event) =>
            `('${event.platform}', '${event.eventType}', '${event.sourceIp}', ${event.userId ? `'${event.userId}'` : "NULL"}, '${event.severity}', ${event.blocked}, '${JSON.stringify(event.metadata || {}).replace(/'/g, "''")}')`,
        )
        .join(",");

      const query = `INSERT INTO ${this.database}.security_events (platform, event_type, source_ip, user_id, severity, blocked, metadata) VALUES ${values}`;

      await this.executeQuery(query);

      logger.debug(`[CLICKHOUSE] Flushed ${events.length} security events`);
    } catch (error) {
      logger.error(
        "[CLICKHOUSE] Failed to flush security events:",
        error instanceof Error ? error.message : String(error),
      );
      // Re-add events to batch for retry
      this.batches.security.unshift(...events);
    }
  }

  /**
   * Execute ClickHouse query
   */
  private async executeQuery(query: string): Promise<void> {
    const url = new URL(this.clickhouseHost);
    url.searchParams.set("database", this.database);
    url.searchParams.set("query", query);

    const auth = Buffer.from(
      `${this.clickhouseUser}:${this.clickhousePassword}`,
    ).toString("base64");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error(
        `ClickHouse query failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Get pipeline performance metrics
   */
  async getPerformanceMetrics(hours: number = 24): Promise<any> {
    if (!this.clickhouseHost) return null;

    const query = `
      SELECT 
        layer,
        platform,
        event_type,
        sum(events) as total_events,
        sum(successful_events) as successful_events,
        sum(failed_events) as failed_events,
        avg(avg_processing_time) as avg_processing_time,
        max(p95_processing_time) as p95_processing_time
      FROM ${this.database}.pipeline_performance 
      WHERE minute >= now() - INTERVAL ${hours} HOUR
      GROUP BY layer, platform, event_type
      ORDER BY total_events DESC
      FORMAT JSON
    `;

    try {
      const url = new URL(this.clickhouseHost);
      url.searchParams.set("database", this.database);
      url.searchParams.set("query", query);

      const auth = Buffer.from(
        `${this.clickhouseUser}:${this.clickhousePassword}`,
      ).toString("base64");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      logger.error(
        "[CLICKHOUSE] Failed to get performance metrics:",
        error instanceof Error ? error.message : String(error),
      );
    }

    return null;
  }

  /**
   * Cleanup - flush remaining events and stop timer
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flushAllBatches();
    logger.info("[CLICKHOUSE] Pipeline analytics cleanup completed");
  }
}

// Global instance
export const pipelineAnalytics = new ClickHousePipelineAnalytics();
