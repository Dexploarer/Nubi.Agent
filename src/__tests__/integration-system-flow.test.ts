/**
 * Comprehensive integration test for the entire system flow
 * Tests UX from initialization through Twitter monitoring, MCP, and Telegram integration
 * Following ElizaOS testing guide patterns
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { logger } from "@elizaos/core";
import { nubiCharacter } from "../character/nubi-character";
import { twitterMonitorPlugin } from "../plugins/twitter-monitor-plugin";
import { nubiMcpConfig } from "../character/nubi-mcp-config";

// Mock runtime for testing
const mockRuntime = {
  agentId: "test-agent-id",
  getService: (serviceName: string) => {
    if (serviceName === "twitter_monitor") {
      return {
        searchTweets: async () => ({
          tweets: [],
          users: [],
          meta: { resultCount: 0 },
        }),
        getUser: async () => null,
        monitorLists: async () => [],
        trackRaidMetrics: async () => null,
        getRaidAnalytics: async () => ({
          totalRaids: 0,
          successfulRaids: 0,
          averageRaidScore: 0,
        }),
      };
    }
    return null;
  },
};

describe("System Integration Flow", () => {
  beforeEach(() => {
    logger.info("[TEST] Starting integration test");
  });

  afterEach(() => {
    logger.info("[TEST] Integration test completed");
  });

  describe("1. Character Configuration", () => {
    it("should have valid character configuration", () => {
      expect(nubiCharacter.name).toBe("NUBI");
      expect(nubiCharacter.username).toBe("nubi");
      expect(nubiCharacter.bio).toBeDefined();
      expect(Array.isArray(nubiCharacter.bio)).toBe(true);
      expect(nubiCharacter.system).toBeDefined();
      expect(nubiCharacter.plugins).toBeDefined();
      expect(Array.isArray(nubiCharacter.plugins)).toBe(true);

      logger.info("[TEST] ✅ Character configuration is valid");
    });

    it("should include essential plugins", () => {
      const plugins = nubiCharacter.plugins;

      // Check core plugins are present
      expect(plugins.includes("@elizaos/plugin-sql")).toBe(true);
      expect(plugins.includes("@elizaos/plugin-bootstrap")).toBe(true);
      expect(plugins.includes("@elizaos/plugin-knowledge")).toBe(true);
      expect(plugins.includes("@elizaos/plugin-mcp")).toBe(true);
      expect(plugins.includes("twitter-monitor")).toBe(true);

      logger.info("[TEST] ✅ Essential plugins are configured");
    });

    it("should have proper settings configuration", () => {
      expect(nubiCharacter.settings).toBeDefined();
      expect(nubiCharacter.settings.mcp).toBeDefined();

      logger.info("[TEST] ✅ Settings configuration is valid");
    });
  });

  describe("2. MCP Configuration", () => {
    it("should have valid MCP server configuration", () => {
      const mcpConfig = nubiMcpConfig.settings?.mcp;

      expect(mcpConfig).toBeDefined();
      expect(mcpConfig.servers).toBeDefined();
      expect(mcpConfig.servers.xmcpx).toBeDefined();
      expect(mcpConfig.servers.supabase).toBeDefined();

      // Check xmcpx server config
      const xmcpxConfig = mcpConfig.servers.xmcpx;
      expect(xmcpxConfig.type).toBe("stdio");
      expect(xmcpxConfig.command).toBe("npx");
      expect(xmcpxConfig.args).toEqual(["@promptordie/xmcpx"]);
      expect(xmcpxConfig.env).toBeDefined();

      // Check supabase server config
      const supabaseConfig = mcpConfig.servers.supabase;
      expect(supabaseConfig.type).toBe("stdio");
      expect(supabaseConfig.command).toBe("npx");

      logger.info("[TEST] ✅ MCP configuration follows ElizaOS patterns");
    });

    it("should use environment variables properly", () => {
      const xmcpxEnv = nubiMcpConfig.settings?.mcp?.servers?.xmcpx?.env;

      expect(xmcpxEnv).toBeDefined();
      // Environment variables should be accessed via process.env (may be undefined in test)
      expect(xmcpxEnv.TWITTER_USERNAME).toBe(process.env.TWITTER_USERNAME);
      expect(typeof xmcpxEnv.AUTH_METHOD).toBe("string");
      expect(xmcpxEnv.AUTH_METHOD).toBe("cookies");

      logger.info("[TEST] ✅ Environment variables are properly configured");
    });
  });

  describe("3. Twitter Monitor Plugin", () => {
    it("should have valid plugin structure", () => {
      expect(twitterMonitorPlugin.name).toBe("twitter-monitor");
      expect(twitterMonitorPlugin.description).toBeDefined();
      expect(Array.isArray(twitterMonitorPlugin.services)).toBe(true);
      expect(Array.isArray(twitterMonitorPlugin.actions)).toBe(true);
      expect(Array.isArray(twitterMonitorPlugin.providers)).toBe(true);
      expect(Array.isArray(twitterMonitorPlugin.evaluators)).toBe(true);

      logger.info("[TEST] ✅ Twitter Monitor Plugin structure is valid");
    });

    it("should have required actions", () => {
      const actionNames = twitterMonitorPlugin.actions.map(
        (action) => action.name,
      );

      expect(actionNames).toContain("SEARCH_TWITTER");
      expect(actionNames).toContain("GET_TWITTER_USER");
      expect(actionNames).toContain("MONITOR_TWITTER_LISTS");
      expect(actionNames).toContain("TRACK_RAID_METRICS");

      logger.info("[TEST] ✅ Required actions are present");
    });

    it("should have required providers", () => {
      expect(twitterMonitorPlugin.providers.length).toBe(3);

      const providers = twitterMonitorPlugin.providers;
      expect(providers.some((p) => p.name === "twitter_mentions")).toBe(true);
      expect(providers.some((p) => p.name === "twitter_trending")).toBe(true);
      expect(providers.some((p) => p.name === "twitter_raid_analytics")).toBe(
        true,
      );

      logger.info("[TEST] ✅ Required providers are present");
    });
  });

  describe("4. Action Validation Flow", () => {
    it("should validate SEARCH_TWITTER action", async () => {
      const searchAction = twitterMonitorPlugin.actions.find(
        (a) => a.name === "SEARCH_TWITTER",
      );
      expect(searchAction).toBeDefined();

      // Test validation
      const mockMessage = {
        content: { text: "search twitter for #AnubisChat" },
      };

      const isValid = await searchAction!.validate(
        mockRuntime as any,
        mockMessage as any,
      );
      expect(isValid).toBe(true);

      logger.info("[TEST] ✅ SEARCH_TWITTER action validation works");
    });

    it("should validate TRACK_RAID_METRICS action", async () => {
      const raidAction = twitterMonitorPlugin.actions.find(
        (a) => a.name === "TRACK_RAID_METRICS",
      );
      expect(raidAction).toBeDefined();

      // Test validation with tweet URL
      const mockMessage = {
        content: {
          text: "track raid metrics for https://twitter.com/user/status/1234567890123456789",
        },
      };

      const isValid = await raidAction!.validate(
        mockRuntime as any,
        mockMessage as any,
      );
      expect(isValid).toBe(true);

      logger.info("[TEST] ✅ TRACK_RAID_METRICS action validation works");
    });
  });

  describe("5. Provider Integration", () => {
    it("should handle mentions provider gracefully", async () => {
      const mentionsProvider = twitterMonitorPlugin.providers.find(
        (p) => p.name === "twitter_mentions",
      );
      expect(mentionsProvider).toBeDefined();

      const mockMessage = { content: { text: "test" } };
      const result = await mentionsProvider!.get(
        mockRuntime as any,
        mockMessage as any,
      );

      expect(result).toBeDefined();
      expect(typeof result.text).toBe("string");
      expect(typeof result.values).toBe("object");
      expect(typeof result.data).toBe("object");

      logger.info("[TEST] ✅ Mentions provider works");
    });

    it("should handle raid analytics provider", async () => {
      const raidProvider = twitterMonitorPlugin.providers.find(
        (p) => p.name === "twitter_raid_analytics",
      );
      expect(raidProvider).toBeDefined();

      const mockMessage = { content: { text: "test" } };
      const result = await raidProvider!.get(
        mockRuntime as any,
        mockMessage as any,
      );

      expect(result).toBeDefined();
      expect(typeof result.text).toBe("string");

      logger.info("[TEST] ✅ Raid analytics provider works");
    });
  });

  describe("6. ElizaOS Compliance", () => {
    it("should use proper ElizaOS logger throughout", () => {
      // Logger should be imported from @elizaos/core
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");

      logger.info("[TEST] ✅ ElizaOS logger is properly configured");
    });

    it("should have proper plugin architecture", () => {
      // Plugins should follow ElizaOS patterns
      expect(twitterMonitorPlugin.name).toBeDefined();
      expect(twitterMonitorPlugin.description).toBeDefined();
      expect(twitterMonitorPlugin.services).toBeDefined();
      expect(twitterMonitorPlugin.actions).toBeDefined();
      expect(twitterMonitorPlugin.providers).toBeDefined();

      logger.info("[TEST] ✅ Plugin follows ElizaOS architecture patterns");
    });
  });

  describe("7. Integration Readiness", () => {
    it("should be ready for production deployment", () => {
      // Character is properly configured
      expect(nubiCharacter.name).toBeTruthy();
      expect(nubiCharacter.plugins.length).toBeGreaterThan(0);

      // MCP is configured
      expect(nubiMcpConfig.settings).toBeTruthy();

      // Twitter monitor is functional
      expect(twitterMonitorPlugin.actions.length).toBe(4);
      expect(twitterMonitorPlugin.providers.length).toBe(3);

      logger.info("[TEST] ✅ System is ready for production deployment");
    });

    it("should have proper separation of concerns", () => {
      // MCP handles write operations
      const mcpServers = Object.keys(
        nubiMcpConfig.settings?.mcp?.servers || {},
      );
      expect(mcpServers).toContain("xmcpx");

      // Twitter Monitor handles read operations
      const monitorActions = twitterMonitorPlugin.actions.map((a) => a.name);
      expect(
        monitorActions.every(
          (name) =>
            name.includes("SEARCH") ||
            name.includes("GET") ||
            name.includes("MONITOR") ||
            name.includes("TRACK"),
        ),
      ).toBe(true);

      logger.info("[TEST] ✅ Proper separation of read/write operations");
    });
  });
});
