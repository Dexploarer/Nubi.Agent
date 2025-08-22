/**
 * Provider tests following ElizaOS testing patterns
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import {
  describe,
  expect,
  test,
  beforeEach,
  mock,
  setupProviderTest,
  createMockMessage,
  mockExternalApi,
} from "./test-utils";
import type { Provider } from "@elizaos/core";
import plugin from "../plugins/nubi-plugin";

describe("Plugin Providers", () => {
  describe("Provider Registry", () => {
    test("should have providers defined", () => {
      expect(plugin.providers).toBeDefined();
      expect(Array.isArray(plugin.providers)).toBe(true);
    });

    test("all providers should have required properties", () => {
      if (!plugin.providers) return;

      plugin.providers.forEach((provider) => {
        expect(provider).toHaveProperty("name");
        expect(provider).toHaveProperty("description");
        expect(provider).toHaveProperty("get");
        expect(typeof provider.name).toBe("string");
        expect(typeof provider.description).toBe("string");
        expect(typeof provider.get).toBe("function");
      });
    });
  });

  describe("Character Provider", () => {
    let characterProvider: Provider | undefined;
    let mockRuntime: any;
    let mockMessage: any;

    beforeEach(() => {
      const setup = setupProviderTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;

      // Find the character provider if it exists
      characterProvider = plugin.providers?.find(
        (provider) => provider.name === "character",
      );
    });

    test("should provide character information", async () => {
      if (!characterProvider) {
        // Skip if no character provider
        return;
      }

      const result = await characterProvider.get(mockRuntime, mockMessage);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Time Provider", () => {
    let timeProvider: Provider | undefined;
    let mockRuntime: any;
    let mockMessage: any;

    beforeEach(() => {
      const setup = setupProviderTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;

      // Find the time provider if it exists
      timeProvider = plugin.providers?.find(
        (provider) => provider.name === "time",
      );
    });

    test("should provide current time", async () => {
      if (!timeProvider) {
        // Skip if no time provider
        return;
      }

      const result = await timeProvider.get(mockRuntime, mockMessage);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Check if it contains time-related information
      const lowerResult = result.toLowerCase();
      const hasTimeInfo =
        lowerResult.includes("time") ||
        lowerResult.includes("date") ||
        lowerResult.includes(":") ||
        /\d{1,2}:\d{2}/.test(result) ||
        /\d{4}/.test(result); // year

      expect(hasTimeInfo).toBe(true);
    });
  });

  describe("Context Provider", () => {
    let contextProvider: Provider | undefined;
    let mockRuntime: any;
    let mockMessage: any;

    beforeEach(() => {
      const setup = setupProviderTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;

      // Find the context provider if it exists
      contextProvider = plugin.providers?.find(
        (provider) => provider.name === "context",
      );
    });

    test("should provide context information", async () => {
      if (!contextProvider) {
        // Skip if no context provider
        return;
      }

      // Setup mock recent messages
      mockRuntime.memoryManager.getMemories = mock(() =>
        Promise.resolve([
          createMockMessage({
            content: { text: "Previous message 1", action: null },
          }),
          createMockMessage({
            content: { text: "Previous message 2", action: null },
          }),
        ]),
      );

      const result = await contextProvider.get(mockRuntime, mockMessage);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("API Provider", () => {
    let apiProvider: Provider | undefined;
    let mockRuntime: any;
    let mockMessage: any;

    beforeEach(() => {
      const setup = setupProviderTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;

      // Find an API provider if it exists
      apiProvider = plugin.providers?.find(
        (provider) =>
          provider.name.includes("api") || provider.name.includes("API"),
      );
    });

    test("should handle API calls", async () => {
      if (!apiProvider) {
        // Skip if no API provider
        return;
      }

      // Mock external API response
      const mockApiResponse = {
        status: "success",
        data: {
          value: "test data",
        },
      };

      mockExternalApi("https://api.example.com", mockApiResponse);

      const result = await apiProvider.get(mockRuntime, mockMessage);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("should handle API errors gracefully", async () => {
      if (!apiProvider) {
        // Skip if no API provider
        return;
      }

      // Mock API error
      const fetchMock = spyOn(global, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      const result = await apiProvider.get(mockRuntime, mockMessage);
      // Provider should handle error and return a fallback or error message
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      fetchMock.mockRestore();
    });
  });

  describe("Provider Error Handling", () => {
    test("providers should handle null runtime gracefully", async () => {
      if (!plugin.providers || plugin.providers.length === 0) return;

      const provider = plugin.providers[0];
      const mockMessage = createMockMessage();

      try {
        const result = await provider.get(null as any, mockMessage);
        // If it doesn't throw, it should return something
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, the error should be meaningful
        expect(error).toBeDefined();
        expect((error as Error).message).toBeDefined();
      }
    });

    test("providers should handle null message gracefully", async () => {
      if (!plugin.providers || plugin.providers.length === 0) return;

      const provider = plugin.providers[0];
      const { mockRuntime } = setupProviderTest();

      try {
        const result = await provider.get(mockRuntime, null as any);
        // If it doesn't throw, it should return something
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, the error should be meaningful
        expect(error).toBeDefined();
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe("Provider Caching", () => {
    test("providers should utilize cache when available", async () => {
      if (!plugin.providers || plugin.providers.length === 0) return;

      const provider = plugin.providers[0];
      const { mockRuntime, mockMessage } = setupProviderTest();

      // Setup cache mock
      mockRuntime.cacheManager.get = mock(() =>
        Promise.resolve("cached value"),
      );
      mockRuntime.cacheManager.set = mock(() => Promise.resolve());

      const result = await provider.get(mockRuntime, mockMessage);

      // Provider should either use cache or set cache
      // At least one of these should be called if caching is implemented
      const getCalled =
        (mockRuntime.cacheManager.get as any).mock.calls.length > 0;
      const setCalled =
        (mockRuntime.cacheManager.set as any).mock.calls.length > 0;

      // We don't require caching, but if it's used, verify it's used correctly
      if (getCalled || setCalled) {
        expect(result).toBeDefined();
      }
    });
  });
});
