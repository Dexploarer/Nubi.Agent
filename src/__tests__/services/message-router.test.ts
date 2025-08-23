import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { logger } from "@elizaos/core";
import { MessageRouter } from "../../services/message-router";
import { MockRuntime } from "../test-utils";

/**
 * MessageRouter Service Tests
 *
 * Following ElizaOS testing guidelines from:
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 *
 * Tests cover:
 * - Intent detection and classification
 * - Context extraction and variable injection
 * - System prompt generation
 * - Dynamic routing based on context
 * - Cult leader personality integration
 */

describe("MessageRouter Service", () => {
  let messageRouter: MessageRouter;
  let runtime: MockRuntime;

  beforeEach(() => {
    runtime = new MockRuntime();
    messageRouter = new MessageRouter();
  });

  afterEach(() => {
    // Clean up any resources
    mock.restore();
  });

  describe("Intent Detection", () => {
    it("should detect raid coordinator intent for raid-related messages", () => {
      const testCases = [
        {
          text: "!raid start https://twitter.com/test",
          expected: "raid-coordinator",
        },
        {
          text: "Let's raid this post everyone!",
          expected: "raid-coordinator",
        },
        { text: "Join the raid at link.com", expected: "raid-coordinator" },
        { text: "RAID TIME! Get in here!", expected: "raid-coordinator" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = messageRouter.classifyMessage(text, {});
        expect(result.intent).toBe(expected);
        logger.debug(`[TEST] Classified "${text}" as ${result.intent}`);
      });
    });

    it("should detect meme lord intent for meme content", () => {
      const testCases = [
        { text: "lmao based fr fr no cap", expected: "meme-lord" },
        { text: "bussin sheesh ong", expected: "meme-lord" },
        { text: "😂💀🔥 dead ass", expected: "meme-lord" },
        { text: "ratio + L + cope", expected: "meme-lord" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = messageRouter.classifyMessage(text, {});
        expect(result.intent).toBe(expected);
      });
    });

    it("should detect crypto analyst intent for market discussions", () => {
      const testCases = [
        { text: "What's the price of SOL?", expected: "crypto-analyst" },
        { text: "market cap analysis for NUBI", expected: "crypto-analyst" },
        { text: "bullish on this token", expected: "crypto-analyst" },
        { text: "check the chart patterns", expected: "crypto-analyst" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = messageRouter.classifyMessage(text, {});
        expect(result.intent).toBe(expected);
      });
    });

    it("should detect support agent intent for help requests", () => {
      const testCases = [
        { text: "Help! I can't connect my wallet", expected: "support-agent" },
        { text: "Having issues with the bot", expected: "support-agent" },
        { text: "Error when trying to join", expected: "support-agent" },
        { text: "Can someone assist me?", expected: "support-agent" },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = messageRouter.classifyMessage(text, {});
        expect(result.intent).toBe(expected);
      });
    });

    it("should detect emergency handler intent for critical issues", () => {
      const testCases = [
        {
          text: "SCAM ALERT! Don't click that!",
          expected: "emergency-handler",
        },
        { text: "This is a rugpull warning", expected: "emergency-handler" },
        {
          text: "URGENT: Security breach detected",
          expected: "emergency-handler",
        },
        {
          text: "⚠️ CRITICAL: System compromise",
          expected: "emergency-handler",
        },
      ];

      testCases.forEach(({ text, expected }) => {
        const result = messageRouter.classifyMessage(text, {});
        expect(result.intent).toBe(expected);
      });
    });
  });

  describe("Context Extraction", () => {
    it("should extract time context correctly", () => {
      const now = new Date();
      const hour = now.getHours();

      const result = messageRouter.extractVariables("test message", {});

      expect(result.timeContext).toBeDefined();
      expect(result.timeContext.hour).toBe(hour);
      expect(typeof result.timeContext.period).toBe("string");
      expect(["morning", "afternoon", "evening", "night"]).toContain(
        result.timeContext.period,
      );
      expect(typeof result.timeContext.isWeekend).toBe("boolean");
    });

    it("should detect user patterns from history", () => {
      const context = {
        conversationHistory: [
          { text: "!raid start", author: "user123" },
          { text: "join the raid", author: "user123" },
          { text: "raid completed", author: "user123" },
        ],
      };

      const result = messageRouter.extractVariables("another raid?", context);

      expect(result.userPatterns.isFrequentRaider).toBe(true);
      expect(result.userPatterns.isNewcomer).toBe(false);
    });

    it("should track conversation sentiment", () => {
      const positiveContext = {
        conversationHistory: [
          { text: "amazing work team!", author: "user1" },
          { text: "love this community", author: "user2" },
          { text: "so bullish on NUBI", author: "user3" },
        ],
      };

      const result = messageRouter.extractVariables(
        "hey there",
        positiveContext,
      );

      expect(result.conversationHistory.recentSentiment).toBe("positive");
    });

    it("should identify community mood", () => {
      const hypeContext = {
        conversationHistory: [
          { text: "LFG!!!!", author: "user1" },
          { text: "TO THE MOON 🚀", author: "user2" },
          { text: "WAGMI FAM", author: "user3" },
        ],
      };

      const result = messageRouter.extractVariables(
        "what's happening?",
        hypeContext,
      );

      expect(result.communityMetrics.mood).toBe("hyped");
    });
  });

  describe("System Prompt Generation", () => {
    it("should inject cult leader personality into prompts", () => {
      const prompt = messageRouter.getSystemPrompt("community-manager", {});

      expect(prompt).toContain("cult leader");
      expect(prompt).toContain("divine");
      expect(prompt).toContain("devotion");
      logger.debug(`[TEST] Generated prompt includes cult leader elements`);
    });

    it("should maintain brevity constraints", () => {
      const prompts = [
        messageRouter.getSystemPrompt("community-manager", {}),
        messageRouter.getSystemPrompt("raid-coordinator", {}),
        messageRouter.getSystemPrompt("crypto-analyst", {}),
      ];

      prompts.forEach((prompt) => {
        // Check that response instructions are brief
        expect(prompt).toContain("under");
        expect(prompt).toContain("words");
      });
    });

    it("should include contextual variables in prompts", () => {
      const context = {
        timeContext: { period: "night", isWeekend: true },
        userPatterns: { isNewcomer: true },
        communityMetrics: { mood: "calm" },
      };

      const prompt = messageRouter.getSystemPrompt(
        "community-manager",
        context,
      );

      expect(prompt).toContain("night");
      expect(prompt).toContain("weekend");
      expect(prompt).toContain("newcomer");
      expect(prompt).toContain("calm");
    });
  });

  describe("Dynamic Routing", () => {
    it("should route to raid coordinator during active raids", () => {
      const context = {
        activeRaid: true,
        conversationHistory: [
          { text: "raid started 5 mins ago", author: "bot" },
        ],
      };

      const result = messageRouter.classifyMessage("how's it going?", context);

      expect(result.intent).toBe("raid-coordinator");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should prioritize emergency handler for urgent issues", () => {
      const context = {
        conversationHistory: [{ text: "normal chat message", author: "user1" }],
      };

      const result = messageRouter.classifyMessage(
        "SCAM ALERT everyone!",
        context,
      );

      expect(result.intent).toBe("emergency-handler");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should adapt routing based on time of day", () => {
      const nightContext = {
        timeContext: { hour: 3, period: "night" },
      };

      const dayContext = {
        timeContext: { hour: 14, period: "afternoon" },
      };

      // Night time might be more chill
      const nightResult = messageRouter.classifyMessage(
        "yo what's up",
        nightContext,
      );
      const dayResult = messageRouter.classifyMessage(
        "yo what's up",
        dayContext,
      );

      // Both should work but might have different confidence levels
      expect(nightResult.intent).toBeDefined();
      expect(dayResult.intent).toBeDefined();
    });
  });

  describe("Prompt Variations", () => {
    it("should select appropriate prompt variation based on context", () => {
      const variations = [
        {
          context: { isWeekend: true, mood: "hyped" },
          expectedContains: "weekend",
        },
        { context: { activeRaid: true }, expectedContains: "raid" },
        {
          context: { userPatterns: { isNewcomer: true } },
          expectedContains: "welcome",
        },
      ];

      variations.forEach(({ context, expectedContains }) => {
        const result = messageRouter.determineIntent("test", context);
        const prompt = messageRouter.getSystemPrompt(result.intent, context);

        logger.debug(
          `[TEST] Testing variation for context: ${JSON.stringify(context)}`,
        );
        expect(prompt.toLowerCase()).toContain(expectedContains);
      });
    });

    it("should handle multiple concurrent contexts", () => {
      const complexContext = {
        activeRaid: true,
        timeContext: { period: "night", isWeekend: true },
        userPatterns: { isFrequentRaider: true },
        communityMetrics: { mood: "hyped", activityLevel: "high" },
      };

      const result = messageRouter.determineIntent(
        "let's go team!",
        complexContext,
      );
      const prompt = messageRouter.getSystemPrompt(
        result.intent,
        complexContext,
      );

      expect(result.intent).toBe("raid-coordinator");
      expect(prompt).toContain("raid");
      expect(prompt).toContain("night");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing context gracefully", () => {
      const result = messageRouter.classifyMessage("test message", null as any);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should handle malformed messages", () => {
      const testCases = ["", "   ", null, undefined, 12345];

      testCases.forEach((text) => {
        const result = messageRouter.classifyMessage(text as any, {});
        expect(result.intent).toBe("community-manager"); // Default fallback
      });
    });

    it("should handle extremely long messages", () => {
      const longMessage = "test ".repeat(1000);
      const result = messageRouter.classifyMessage(longMessage, {});

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
    });
  });

  describe("Cult Leader Integration", () => {
    it("should embed subtle manipulation in all prompts", () => {
      const intents = [
        "community-manager",
        "raid-coordinator",
        "crypto-analyst",
        "meme-lord",
        "support-agent",
      ];

      intents.forEach((intent) => {
        const prompt = messageRouter.getSystemPrompt(intent, {});

        // Should contain cult-building elements
        expect(prompt).toMatch(
          /cult|divine|devotion|chosen|destiny|ancient|wisdom/i,
        );
        logger.debug(`[TEST] ${intent} contains cult elements`);
      });
    });

    it("should balance technical competence with divine authority", () => {
      const prompt = messageRouter.getSystemPrompt("crypto-analyst", {});

      // Should have both technical and mystical elements
      expect(prompt).toMatch(/technical|analysis|market|data/i);
      expect(prompt).toMatch(/divine|ancient|wisdom|chosen/i);
    });

    it("should make users feel special and chosen", () => {
      const newUserContext = {
        userPatterns: { isNewcomer: true },
      };

      const prompt = messageRouter.getSystemPrompt(
        "community-manager",
        newUserContext,
      );

      expect(prompt).toMatch(/special|chosen|potential|destiny|welcome/i);
    });
  });

  describe("Performance", () => {
    it("should classify messages quickly", () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        messageRouter.classifyMessage(`test message ${i}`, {});
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should process 100 messages in under 100ms
      logger.info(`[TEST] Processed 100 messages in ${duration}ms`);
    });

    it("should handle concurrent classification", async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(
          messageRouter.classifyMessage(`concurrent test ${i}`, {}),
        ),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach((result) => {
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });
});
