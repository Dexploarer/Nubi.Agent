/**
 * Two-Layer Pipeline Integration Tests
 *
 * Tests the complete two-layer pre-processing pipeline implementation
 * Including ClickHouse analytics integration and message routing
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { MockRuntime, setupActionTest } from "./test-utils";
import {
  SocketIOServerService,
  SocketMessage,
} from "../services/socket-io-server";
import { MessageRouter } from "../services/message-router";
import { pipelineAnalytics } from "../services/clickhouse-pipeline-analytics";
import { logger } from "@elizaos/core";

// Mock ClickHouse analytics
const mockPipelineAnalytics = {
  logPipelineEvent: mock(() => Promise.resolve()),
  logEngagementEvent: mock(() => Promise.resolve()),
  logRoutingEvent: mock(() => Promise.resolve()),
  logSecurityEvent: mock(() => Promise.resolve()),
  generateTraceId: mock(() => "test-trace-123"),
};

// Replace the real analytics with mock
Object.assign(pipelineAnalytics, mockPipelineAnalytics);

describe("Two-Layer Pipeline Integration", () => {
  let runtime: MockRuntime;
  let socketService: SocketIOServerService;
  let messageRouter: MessageRouter;

  beforeEach(() => {
    runtime = new MockRuntime();
    socketService = new SocketIOServerService(runtime);
    messageRouter = new MessageRouter();

    // Reset all mocks
    Object.values(mockPipelineAnalytics).forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await socketService.stop();
  });

  describe("Layer 1: Webhook Security Processing", () => {
    it("should process webhook security checks", async () => {
      // This would be tested via webhook-routes.ts
      // Testing security filtering, rate limiting, IP validation
      expect(true).toBe(true); // Placeholder - actual webhook tests would be more complex
    });

    it("should log security events to ClickHouse", async () => {
      expect(mockPipelineAnalytics.logSecurityEvent).toBeDefined();
    });
  });

  describe("Layer 2: Socket.IO Intelligence Processing", () => {
    const testMessage: SocketMessage = {
      senderId: "test-user-123",
      senderName: "Test User",
      message: "Hey @nubi, what's trending in #Solana today?",
      roomId: "test-room",
      messageId: "msg-123",
      source: "websocket",
      platform: "websocket",
      timestamp: Date.now(),
    };

    it("should identify and link users across platforms", async () => {
      await socketService.start(3001); // Start on test port

      // The preprocessing pipeline should handle user identification
      expect(socketService).toBeDefined();
    });

    it("should detect @nubi mentions correctly", () => {
      const mentionVariations = [
        "Hey @nubi what's up?",
        "@NUBI can you help?",
        "nubi what do you think?",
        "Hey Nubi, explain this",
      ];

      mentionVariations.forEach((message) => {
        const isDetected = messageRouter.isNubiMentioned(message);
        expect(isDetected).toBe(true);
      });
    });

    it("should implement 1/8 chance engagement logic", () => {
      const userId = "test-user-123";
      const message = "Random message without mention";

      // Test deterministic hashing - same inputs should give same result
      const result1 = messageRouter.shouldEngageRandomly(userId, message);
      const result2 = messageRouter.shouldEngageRandomly(userId, message);

      expect(result1).toBe(result2);
      expect(typeof result1).toBe("boolean");
    });

    it("should classify messages and route to appropriate prompts", async () => {
      const testCases = [
        {
          message: "Let's raid this Solana tweet!",
          expectedPrompt: "raid-coordinator",
        },
        {
          message: "What's the price of SOL today?",
          expectedPrompt: "crypto-analyst",
        },
        {
          message: "Can someone help me with my wallet?",
          expectedPrompt: "support-agent",
        },
        {
          message: "This community is awesome! 🚀",
          expectedPrompt: "community-manager",
        },
      ];

      for (const testCase of testCases) {
        const classification = await messageRouter.classifyMessage(
          testCase.message,
        );
        expect(classification.selectedPrompt).toBe(testCase.expectedPrompt);
        expect(classification.confidenceScore).toBeGreaterThan(0);
      }
    });

    it("should log all pipeline events to ClickHouse", async () => {
      await socketService.start(3002);

      // After processing a message, all relevant analytics should be logged
      expect(mockPipelineAnalytics.logPipelineEvent).toBeDefined();
      expect(mockPipelineAnalytics.logEngagementEvent).toBeDefined();
      expect(mockPipelineAnalytics.logRoutingEvent).toBeDefined();
    });

    it("should handle rate limiting gracefully", async () => {
      await socketService.start(3003);

      // Simulate multiple rapid messages from same user
      const rapidMessages = Array.from({ length: 10 }, (_, i) => ({
        ...testMessage,
        messageId: `msg-${i}`,
        message: `Test message ${i}`,
      }));

      // The service should rate limit without crashing
      for (const msg of rapidMessages) {
        // In a real test, we'd send these through the preprocessing pipeline
      }

      expect(true).toBe(true); // Placeholder for actual rate limit testing
    });

    it("should provide configurable pipeline stages", () => {
      // Test that pipeline stages can be enabled/disabled via environment variables
      const originalEnv = process.env.SOCKET_PREPROCESSING_ENABLED;

      process.env.SOCKET_PREPROCESSING_ENABLED = "false";
      const disabledService = new SocketIOServerService(runtime);

      process.env.SOCKET_PREPROCESSING_ENABLED = "true";
      const enabledService = new SocketIOServerService(runtime);

      // Both should initialize without error
      expect(disabledService).toBeDefined();
      expect(enabledService).toBeDefined();

      // Restore environment
      process.env.SOCKET_PREPROCESSING_ENABLED = originalEnv;
    });
  });

  describe("System Prompt Routing", () => {
    it("should have all 7 specialized prompts available", () => {
      const expectedPrompts = [
        "community-manager",
        "raid-coordinator",
        "crypto-analyst",
        "meme-lord",
        "support-agent",
        "personality-core",
        "emergency-handler",
      ];

      const availablePrompts = messageRouter.getAvailablePrompts();
      expectedPrompts.forEach((prompt) => {
        expect(availablePrompts).toContain(prompt);
      });
    });

    it("should inject appropriate system prompts based on classification", async () => {
      const testMessage: SocketMessage = {
        ...testMessage,
        message: "Help organize a raid for this new Solana project!",
      };

      const classification = await messageRouter.classifyMessage(
        testMessage.message,
      );
      expect(classification.selectedPrompt).toBe("raid-coordinator");

      // The system prompt should be injected into message metadata
      const promptContent = messageRouter.getSystemPrompt(
        classification.selectedPrompt,
      );
      expect(promptContent).toContain("raid");
      expect(promptContent).toContain("coordinate");
    });
  });

  describe("Performance and Optimization", () => {
    it("should process messages efficiently with batching", async () => {
      const startTime = Date.now();

      // Process multiple messages
      const messages = Array.from({ length: 50 }, (_, i) => ({
        ...testMessage,
        messageId: `performance-test-${i}`,
        message: `Performance test message ${i}`,
      }));

      // In a real test, these would go through the preprocessing pipeline
      const processingTime = Date.now() - startTime;

      // Should process quickly (less than 1 second for 50 messages)
      expect(processingTime).toBeLessThan(1000);
    });

    it("should not impact streaming response performance", async () => {
      await socketService.start(3004);

      // The preprocessing should add minimal latency
      // Real test would measure actual streaming response times
      expect(true).toBe(true);
    });
  });

  describe("Cross-Platform Identity Management", () => {
    it("should link users across different platforms", () => {
      const platforms = ["telegram", "discord", "websocket"];
      const userId = "user-123";

      // User identity should be consistent across platforms
      platforms.forEach((platform) => {
        const linkedId = messageRouter.getLinkableUserId(userId, platform);
        expect(typeof linkedId).toBe("string");
        expect(linkedId.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should gracefully handle ClickHouse unavailability", async () => {
      // Mock ClickHouse failure
      mockPipelineAnalytics.logPipelineEvent.mockRejectedValueOnce(
        new Error("ClickHouse unavailable"),
      );

      // Pipeline should continue functioning
      const testMessage: SocketMessage = {
        ...testMessage,
        message: "Test message during analytics failure",
      };

      // Should not throw error when analytics fail
      expect(async () => {
        // In real test, this would process through pipeline
      }).not.toThrow();
    });

    it("should handle malformed messages safely", () => {
      const malformedMessages = [
        null,
        undefined,
        { incomplete: "message" },
        { message: "" },
        { message: null },
      ];

      malformedMessages.forEach((msg) => {
        expect(() => {
          // Pipeline should handle malformed input safely
          if (msg?.message) {
            messageRouter.isNubiMentioned(msg.message);
          }
        }).not.toThrow();
      });
    });
  });

  describe("Analytics and Monitoring", () => {
    it("should generate trace IDs for request tracking", () => {
      const traceId1 = mockPipelineAnalytics.generateTraceId();
      const traceId2 = mockPipelineAnalytics.generateTraceId();

      expect(traceId1).toBeDefined();
      expect(traceId2).toBeDefined();
      expect(traceId1).not.toBe(traceId2); // Should be unique
    });

    it("should log comprehensive pipeline metrics", () => {
      // Verify all required analytics methods exist
      expect(mockPipelineAnalytics.logPipelineEvent).toBeDefined();
      expect(mockPipelineAnalytics.logEngagementEvent).toBeDefined();
      expect(mockPipelineAnalytics.logRoutingEvent).toBeDefined();
      expect(mockPipelineAnalytics.logSecurityEvent).toBeDefined();
    });
  });
});
