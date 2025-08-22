/**
 * X-Integration Module Tests
 *
 * Tests for Twitter/X platform integration services including
 * content generation, posting, and community management features
 * Following patterns from https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  XPostingService,
  TweetResult,
  XContentGenerator,
  ContentTemplate,
  AnubisChatContentGenerator,
  ContentStrategy,
  createXIntegrationConfig,
  validateXConfig,
  formatTweetContent,
  extractTweetId,
  createTweetUrl,
  XIntegrationConfig,
  ContentGenerationOptions,
  PostingResult,
} from "../x-integration";
import { setupActionTest } from "./test-utils";

describe("X-Integration Module", () => {
  let mockRuntime: any;

  beforeEach(() => {
    const setup = setupActionTest();
    mockRuntime = setup.mockRuntime;
  });

  describe("XPostingService", () => {
    let postingService: XPostingService;

    beforeEach(() => {
      postingService = new XPostingService(mockRuntime);
    });

    describe("initialization", () => {
      it("should initialize successfully with valid runtime", async () => {
        // Mock Twitter service
        mockRuntime.getService.mockReturnValue({
          post: mock(() => Promise.resolve({ id: "123456789" })),
        });

        await expect(postingService.initialize()).resolves.toBeUndefined();
      });

      it("should throw error when Twitter service not available", async () => {
        mockRuntime.getService.mockReturnValue(null);

        await expect(postingService.initialize()).rejects.toThrow(
          "Twitter service not initialized",
        );
      });

      it("should handle initialization errors gracefully", async () => {
        mockRuntime.getService.mockImplementation(() => {
          throw new Error("Service not found");
        });

        await expect(postingService.initialize()).rejects.toThrow(
          "Service not found",
        );
      });
    });

    describe("content generation", () => {
      it("should generate content with random topics", async () => {
        const content = await postingService.generateContent();

        expect(content).toBeDefined();
        expect(content.length).toBeLessThanOrEqual(280);
        expect(content).toContain("Solana");
        expect(content).toContain("#AnubisChat");
      });

      it("should respect Twitter character limit", async () => {
        const content = await postingService.generateContent();
        expect(content.length).toBeLessThanOrEqual(280);
      });

      it("should include required hashtags", async () => {
        const content = await postingService.generateContent();
        expect(content).toContain("#AnubisChat");
        expect(content).toContain("#Anubis");
        expect(content).toContain("#anubisai");
        expect(content).toContain("#OpenSource");
      });
    });

    describe("posting to X", () => {
      beforeEach(async () => {
        // Setup Twitter service mock
        mockRuntime.getService.mockReturnValue({
          post: mock(() => Promise.resolve({ id: "123456789" })),
        });
        await postingService.initialize();
      });

      it("should post content successfully", async () => {
        const content = "Test tweet content #AnubisChat";
        const result = await postingService.postToX(content);

        expect(result).toBeDefined();
        expect(result.tweetId).toBe("123456789");
        expect(result.content).toBe(content);
        expect(result.url).toContain("x.com");
        expect(result.timestamp).toBeGreaterThan(0);
      });

      it("should handle posting errors", async () => {
        mockRuntime.getService.mockReturnValue({
          post: mock(() => Promise.reject(new Error("Posting failed"))),
        });

        await expect(postingService.postToX("Test content")).rejects.toThrow(
          "Posting failed",
        );
      });

      it("should handle missing tweet ID", async () => {
        mockRuntime.getService.mockReturnValue({
          post: mock(() => Promise.resolve({})),
        });

        await expect(postingService.postToX("Test content")).rejects.toThrow(
          "Failed to post tweet - no ID returned",
        );
      });

      it("should generate and post content", async () => {
        const result = await postingService.generateAndPost();

        expect(result).toBeDefined();
        expect(result.tweetId).toBe("123456789");
        expect(result.content).toContain("#AnubisChat");
        expect(result.url).toContain("x.com");
      });
    });
  });

  describe("XContentGenerator", () => {
    let contentGenerator: XContentGenerator;

    beforeEach(() => {
      contentGenerator = new XContentGenerator(mockRuntime);
    });

    describe("content generation", () => {
      it("should generate content for specified category", async () => {
        const content = await contentGenerator.generateContent("solana_alpha");

        expect(content).toBeDefined();
        expect(content.length).toBeLessThanOrEqual(280);
        expect(content).toContain("Solana");
        expect(content).toContain("#AnubisChat");
      });

      it("should generate content for random category when none specified", async () => {
        const content = await contentGenerator.generateContent();

        expect(content).toBeDefined();
        expect(content.length).toBeLessThanOrEqual(280);
        expect(content).toContain("#AnubisChat");
      });

      it("should include appropriate hashtags for category", async () => {
        const content = await contentGenerator.generateContent("defi_insights");

        expect(content).toContain("#DeFi");
        expect(content).toContain("#AnubisChat");
      });

      it("should handle template filling correctly", async () => {
        const content =
          await contentGenerator.generateContent("community_building");

        expect(content).toContain("community");
        expect(content).toContain("#Community");
      });
    });

    describe("raid call to action", () => {
      it("should generate raid call to action", async () => {
        const tweetUrl = "https://x.com/anubis/status/123456789";
        const callToAction =
          await contentGenerator.generateRaidCallToAction(tweetUrl);

        expect(callToAction).toBeDefined();
        expect(callToAction).toContain(tweetUrl);
        expect(callToAction).toContain("raid");
        expect(callToAction).toContain("warriors");
      });

      it("should include different raid themes", async () => {
        const tweetUrl = "https://x.com/anubis/status/123456789";
        const calls = [];

        // Generate multiple calls to test variety
        for (let i = 0; i < 5; i++) {
          calls.push(await contentGenerator.generateRaidCallToAction(tweetUrl));
        }

        // Should have some variety
        const uniqueCalls = new Set(calls);
        expect(uniqueCalls.size).toBeGreaterThan(1);
      });
    });
  });

  describe("AnubisChatContentGenerator", () => {
    let contentGenerator: AnubisChatContentGenerator;

    beforeEach(() => {
      contentGenerator = new AnubisChatContentGenerator(mockRuntime);
    });

    describe("magnetic content generation", () => {
      it("should generate educational content", async () => {
        const strategy: ContentStrategy = {
          type: "educational",
          tone: "confident",
          cultScore: 0.5,
        };

        const content =
          await contentGenerator.generateMagneticContent(strategy);

        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
      });

      it("should generate comparison content", async () => {
        const strategy: ContentStrategy = {
          type: "comparison",
          tone: "amused",
          cultScore: 0.7,
        };

        const content =
          await contentGenerator.generateMagneticContent(strategy);

        expect(content).toBeDefined();
        expect(content).toContain("$20");
      });

      it("should generate testimonial content", async () => {
        const strategy: ContentStrategy = {
          type: "testimonial",
          tone: "passionate",
          cultScore: 0.8,
        };

        const content =
          await contentGenerator.generateMagneticContent(strategy);

        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
      });

      it("should generate feature content", async () => {
        const strategy: ContentStrategy = {
          type: "feature",
          tone: "helpful",
          cultScore: 0.3,
        };

        const content =
          await contentGenerator.generateMagneticContent(strategy);

        expect(content).toBeDefined();
        expect(content).toContain("models");
      });
    });

    describe("subtle recruitment", () => {
      it("should generate subtle recruitment content", () => {
        const content = contentGenerator.generateSubtleRecruitment();

        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain("Anubis.Chat");
      });

      it("should not use explicit recruitment language", () => {
        const content = contentGenerator.generateSubtleRecruitment();

        expect(content).not.toContain("join us");
        expect(content).not.toContain("sign up");
        expect(content).not.toContain("register");
      });
    });

    describe("milestone celebration", () => {
      it("should generate milestone content", () => {
        const content = contentGenerator.generateMilestone(1000, "users");

        expect(content).toBeDefined();
        expect(content).toContain("1000");
        expect(content).toContain("users");
        expect(content).toContain("Anubis.Chat");
      });

      it("should handle different milestone types", () => {
        const content = contentGenerator.generateMilestone(500, "agents");

        expect(content).toBeDefined();
        expect(content).toContain("500");
        expect(content).toContain("agents");
      });
    });
  });

  describe("Utility Functions", () => {
    describe("createXIntegrationConfig", () => {
      it("should create default config", () => {
        const config = createXIntegrationConfig();

        expect(config.enabled).toBe(false);
        expect(config.rateLimit).toBeDefined();
        expect(config.rateLimit.requests).toBe(100);
        expect(config.rateLimit.window).toBe(900);
      });

      it("should create enabled config with options", () => {
        const options = {
          apiKey: "test-key",
          apiSecret: "test-secret",
          username: "testuser",
        };

        const config = createXIntegrationConfig(true, options);

        expect(config.enabled).toBe(true);
        expect(config.apiKey).toBe("test-key");
        expect(config.apiSecret).toBe("test-secret");
        expect(config.username).toBe("testuser");
      });
    });

    describe("validateXConfig", () => {
      it("should validate complete config", () => {
        const config: XIntegrationConfig = {
          enabled: true,
          apiKey: "test-key",
          apiSecret: "test-secret",
          accessToken: "test-token",
          accessTokenSecret: "test-token-secret",
        };

        expect(validateXConfig(config)).toBe(true);
      });

      it("should reject disabled config", () => {
        const config: XIntegrationConfig = {
          enabled: false,
          apiKey: "test-key",
          apiSecret: "test-secret",
        };

        expect(validateXConfig(config)).toBe(false);
      });

      it("should reject incomplete config", () => {
        const config: XIntegrationConfig = {
          enabled: true,
          apiKey: "test-key",
          // Missing required fields
        };

        expect(validateXConfig(config)).toBe(false);
      });
    });

    describe("formatTweetContent", () => {
      it("should format content with hashtags", () => {
        const content = formatTweetContent(
          "Test tweet content",
          ["#Test", "#AnubisChat"],
          280,
        );

        expect(content).toContain("Test tweet content");
        expect(content).toContain("#Test");
        expect(content).toContain("#AnubisChat");
      });

      it("should truncate content that exceeds limit", () => {
        const longContent = "A".repeat(300);
        const formatted = formatTweetContent(longContent, [], 280);

        expect(formatted.length).toBeLessThanOrEqual(280);
        expect(formatted).toContain("...");
      });

      it("should handle empty hashtags", () => {
        const content = formatTweetContent("Test content", [], 280);

        expect(content).toBe("Test content");
      });
    });

    describe("extractTweetId", () => {
      it("should extract tweet ID from URL", () => {
        const url = "https://x.com/anubis/status/123456789";
        const tweetId = extractTweetId(url);

        expect(tweetId).toBe("123456789");
      });

      it("should return null for invalid URL", () => {
        const url = "https://x.com/anubis/profile";
        const tweetId = extractTweetId(url);

        expect(tweetId).toBeNull();
      });

      it("should handle different URL formats", () => {
        const url = "https://twitter.com/anubis/status/987654321";
        const tweetId = extractTweetId(url);

        expect(tweetId).toBe("987654321");
      });
    });

    describe("createTweetUrl", () => {
      it("should create valid tweet URL", () => {
        const url = createTweetUrl("anubis", "123456789");

        expect(url).toBe("https://x.com/anubis/status/123456789");
      });

      it("should handle different usernames", () => {
        const url = createTweetUrl("testuser", "987654321");

        expect(url).toBe("https://x.com/testuser/status/987654321");
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle end-to-end content generation and posting", async () => {
      // Setup mocks
      mockRuntime.getService.mockReturnValue({
        post: mock(() => Promise.resolve({ id: "123456789" })),
      });

      const postingService = new XPostingService(mockRuntime);
      await postingService.initialize();

      // Generate and post content
      const result = await postingService.generateAndPost();

      expect(result).toBeDefined();
      expect(result.tweetId).toBe("123456789");
      expect(result.content).toContain("#AnubisChat");
      expect(result.url).toContain("x.com");
    });

    it("should handle concurrent content generation", async () => {
      const contentGenerator = new XContentGenerator(mockRuntime);

      const promises = [
        contentGenerator.generateContent("solana_alpha"),
        contentGenerator.generateContent("defi_insights"),
        contentGenerator.generateContent("community_building"),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((content) => {
        expect(content).toBeDefined();
        expect(content.length).toBeLessThanOrEqual(280);
        expect(content).toContain("#AnubisChat");
      });
    });
  });
});
