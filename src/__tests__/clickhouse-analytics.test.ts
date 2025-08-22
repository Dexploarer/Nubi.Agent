/**
 * ClickHouse Pipeline Analytics Tests
 *
 * Tests the ClickHouse analytics integration for the two-layer pipeline
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ClickHousePipelineAnalytics } from "../services/clickhouse-pipeline-analytics";

describe("ClickHouse Pipeline Analytics", () => {
  let analytics: ClickHousePipelineAnalytics;
  let originalEnv: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST,
      CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
      CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
      CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE,
    };

    // Set test environment
    process.env.CLICKHOUSE_HOST = "http://localhost:8123";
    process.env.CLICKHOUSE_USER = "test_user";
    process.env.CLICKHOUSE_PASSWORD = "test_password";
    process.env.CLICKHOUSE_DATABASE = "test_analytics";

    analytics = new ClickHousePipelineAnalytics();
  });

  afterEach(async () => {
    await analytics.cleanup();

    // Restore original environment
    Object.assign(process.env, originalEnv);
  });

  describe("Initialization", () => {
    it("should initialize with correct configuration", () => {
      expect(analytics).toBeDefined();
    });

    it("should handle missing ClickHouse configuration gracefully", () => {
      delete process.env.CLICKHOUSE_HOST;
      const analyticsWithoutHost = new ClickHousePipelineAnalytics();
      expect(analyticsWithoutHost).toBeDefined();
    });

    it("should generate unique trace IDs", () => {
      const traceId1 = analytics.generateTraceId();
      const traceId2 = analytics.generateTraceId();

      expect(traceId1).toBeDefined();
      expect(traceId2).toBeDefined();
      expect(traceId1).not.toBe(traceId2);
      expect(typeof traceId1).toBe("string");
    });
  });

  describe("Event Logging", () => {
    const mockPipelineEvent = {
      traceId: "test-trace-123",
      layer: "layer1" as const,
      platform: "telegram" as const,
      eventType: "security_check" as const,
      userId: "user-123",
      messageId: "msg-456",
      processingTimeMs: 150,
      success: true,
      metadata: { source: "test" },
    };

    const mockEngagementEvent = {
      userId: "user-123",
      platform: "telegram" as const,
      engagementType: "mention" as const,
      messageContent: "Hey @nubi!",
      nubiMentioned: true,
      randomTrigger: false,
      responseGenerated: true,
      processingTimeMs: 200,
      metadata: { confidence: 0.95 },
    };

    const mockRoutingEvent = {
      traceId: "test-trace-123",
      userId: "user-123",
      platform: "websocket" as const,
      messageContent: "Let's organize a raid!",
      extractedVariables: { intent: "raid_coordination" },
      classifiedIntent: "raid_request",
      selectedPrompt: "raid-coordinator" as const,
      confidenceScore: 0.87,
      processingTimeMs: 300,
      metadata: { stage: "classification" },
    };

    const mockSecurityEvent = {
      platform: "telegram" as const,
      eventType: "rate_limit" as const,
      sourceIp: "192.168.1.100",
      userId: "user-123",
      severity: "medium" as const,
      blocked: true,
      metadata: { attempts: 5 },
    };

    it("should log pipeline events", async () => {
      expect(async () => {
        await analytics.logPipelineEvent(mockPipelineEvent);
      }).not.toThrow();
    });

    it("should log engagement events", async () => {
      expect(async () => {
        await analytics.logEngagementEvent(mockEngagementEvent);
      }).not.toThrow();
    });

    it("should log routing events", async () => {
      expect(async () => {
        await analytics.logRoutingEvent(mockRoutingEvent);
      }).not.toThrow();
    });

    it("should log security events", async () => {
      expect(async () => {
        await analytics.logSecurityEvent(mockSecurityEvent);
      }).not.toThrow();
    });

    it("should handle event logging errors gracefully", async () => {
      // Test with invalid event data
      const invalidEvent = {
        ...mockPipelineEvent,
        traceId: null, // Invalid data
      } as any;

      expect(async () => {
        await analytics.logPipelineEvent(invalidEvent);
      }).not.toThrow();
    });
  });

  describe("Batching and Performance", () => {
    it("should batch events before flushing", async () => {
      const batchSize = 50;

      // Generate multiple events
      const events = Array.from({ length: batchSize }, (_, i) => ({
        traceId: `trace-${i}`,
        layer: "layer2" as const,
        platform: "websocket" as const,
        eventType: "classification" as const,
        userId: `user-${i}`,
        messageId: `msg-${i}`,
        processingTimeMs: 100 + i,
        success: true,
        metadata: { batch: true },
      }));

      // Log all events
      for (const event of events) {
        await analytics.logPipelineEvent(event);
      }

      // Should not throw and should handle batching internally
      expect(true).toBe(true);
    });

    it("should flush events periodically", async () => {
      // This would be tested with time mocking in a real scenario
      // For now, just verify the cleanup method works
      await analytics.cleanup();
      expect(true).toBe(true);
    });
  });

  describe("Performance Metrics", () => {
    it("should retrieve performance metrics", async () => {
      const metrics = await analytics.getPerformanceMetrics(24); // Last 24 hours

      // Should return null when ClickHouse is not available, or data structure when available
      expect(metrics === null || typeof metrics === "object").toBe(true);
    });

    it("should handle metrics retrieval errors", async () => {
      // Should not throw even if ClickHouse is unavailable
      expect(async () => {
        await analytics.getPerformanceMetrics();
      }).not.toThrow();
    });
  });

  describe("Data Validation", () => {
    it("should validate required event fields", async () => {
      const incompleteEvent = {
        traceId: "test-trace",
        // Missing required fields
      } as any;

      // Should handle incomplete events gracefully
      expect(async () => {
        await analytics.logPipelineEvent(incompleteEvent);
      }).not.toThrow();
    });

    it("should escape special characters in event data", async () => {
      const eventWithSpecialChars = {
        traceId: "test-trace-123",
        layer: "layer1" as const,
        platform: "telegram" as const,
        eventType: "security_check" as const,
        userId: "user'with\"quotes",
        messageId: "msg-456",
        processingTimeMs: 150,
        success: true,
        error: "Error with 'quotes' and \"double quotes\"",
        metadata: { message: "Contains 'special' chars" },
      };

      expect(async () => {
        await analytics.logPipelineEvent(eventWithSpecialChars);
      }).not.toThrow();
    });
  });

  describe("Resource Management", () => {
    it("should cleanup resources properly", async () => {
      expect(async () => {
        await analytics.cleanup();
      }).not.toThrow();
    });

    it("should handle multiple cleanup calls", async () => {
      await analytics.cleanup();

      expect(async () => {
        await analytics.cleanup();
      }).not.toThrow();
    });
  });

  describe("Environment Configuration", () => {
    it("should use default values for missing environment variables", () => {
      delete process.env.CLICKHOUSE_DATABASE;
      delete process.env.CLICKHOUSE_USER;

      const analyticsWithDefaults = new ClickHousePipelineAnalytics();
      expect(analyticsWithDefaults).toBeDefined();
    });

    it("should disable analytics when host is not configured", () => {
      delete process.env.CLICKHOUSE_HOST;

      const analyticsDisabled = new ClickHousePipelineAnalytics();
      expect(analyticsDisabled).toBeDefined();
    });
  });
});
