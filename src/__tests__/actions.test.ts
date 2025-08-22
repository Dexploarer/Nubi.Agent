/**
 * Action tests following ElizaOS testing patterns
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import {
  describe,
  expect,
  test,
  beforeEach,
  mock,
  setupActionTest,
  createMockMessage,
  createMockState,
  testAsyncOperation,
  testErrorHandling,
} from "./test-utils";
import type { Action, HandlerCallback } from "@elizaos/core";
import plugin from "../plugins/nubi-plugin";

describe("Plugin Actions", () => {
  describe("NUBI_RITUAL Action", () => {
    let nubiAction: Action | undefined;
    let mockRuntime: any;
    let mockMessage: any;
    let mockState: any;
    let callbackFn: HandlerCallback;

    beforeEach(() => {
      const setup = setupActionTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;
      mockState = setup.mockState;
      callbackFn = setup.callbackFn;

      // Find the NUBI_RITUAL action
      nubiAction = plugin.actions?.find(
        (action) => action.name === "NUBI_RITUAL",
      );
    });

    test("should exist in the plugin", () => {
      expect(nubiAction).toBeDefined();
    });

    test("should have the correct structure", () => {
      expect(nubiAction).toHaveProperty("name", "NUBI_RITUAL");
      expect(nubiAction).toHaveProperty("description");
      expect(nubiAction).toHaveProperty("similes");
      expect(nubiAction).toHaveProperty("validate");
      expect(nubiAction).toHaveProperty("handler");
      expect(nubiAction).toHaveProperty("examples");
      expect(Array.isArray(nubiAction?.similes)).toBe(true);
      expect(Array.isArray(nubiAction?.examples)).toBe(true);
    });

    test("should have ritual-related similes", () => {
      expect(nubiAction?.similes).toContain("start ritual");
      expect(nubiAction?.similes).toContain("nubi ritual");
    });

    test("should validate correctly", async () => {
      if (!nubiAction?.validate) {
        throw new Error("Action validate is not defined");
      }

      // Test valid message
      const validMessage = createMockMessage({
        content: { text: "start ritual", action: null },
      });
      const isValid = await nubiAction.validate(mockRuntime, validMessage);
      expect(isValid).toBe(true);

      // Test invalid message
      const invalidMessage = createMockMessage({
        content: { text: "random text", action: null },
      });
      const isInvalid = await nubiAction.validate(mockRuntime, invalidMessage);
      expect(isInvalid).toBe(false);
    });

    test("should handle action execution", async () => {
      if (!nubiAction?.handler) {
        throw new Error("Action handler is not defined");
      }

      // Mock callback to capture response
      const mockCallback = mock((response: any) => {
        expect(response).toBeDefined();
        expect(response.text).toContain("ritual");
      });

      // Execute the handler
      await nubiAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
      );

      // Verify callback was called
      expect(mockCallback).toHaveBeenCalled();
    });

    test("should handle errors gracefully", async () => {
      if (!nubiAction?.handler) {
        throw new Error("Action handler is not defined");
      }

      // Create a runtime that will throw an error
      const errorRuntime = {
        ...mockRuntime,
        completion: mock(() => Promise.reject(new Error("API error"))),
      };

      // Test error handling
      await testErrorHandling(async () => {
        await nubiAction!.handler(
          errorRuntime,
          mockMessage,
          mockState,
          {},
          callbackFn,
        );
      }, "API error");
    });
  });

  describe("HELLO_WORLD Action", () => {
    let helloAction: Action | undefined;
    let mockRuntime: any;
    let mockMessage: any;
    let mockState: any;
    let callbackFn: HandlerCallback;

    beforeEach(() => {
      const setup = setupActionTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;
      mockState = setup.mockState;
      callbackFn = setup.callbackFn;

      // Find the HELLO_WORLD action
      helloAction = plugin.actions?.find(
        (action) => action.name === "HELLO_WORLD",
      );
    });

    test("should exist in the plugin", () => {
      expect(helloAction).toBeDefined();
    });

    test("should have the correct structure", () => {
      expect(helloAction).toHaveProperty("name", "HELLO_WORLD");
      expect(helloAction).toHaveProperty("description");
      expect(helloAction).toHaveProperty("similes");
      expect(helloAction).toHaveProperty("validate");
      expect(helloAction).toHaveProperty("handler");
      expect(helloAction).toHaveProperty("examples");
    });

    test("should validate hello messages", async () => {
      if (!helloAction?.validate) {
        throw new Error("Action validate is not defined");
      }

      // Test hello message
      const helloMessage = createMockMessage({
        content: { text: "hello", action: null },
      });
      const isValid = await helloAction.validate(mockRuntime, helloMessage);
      expect(isValid).toBe(true);

      // Test greetings message
      const greetingMessage = createMockMessage({
        content: { text: "hey there", action: null },
      });
      const isGreetingValid = await helloAction.validate(
        mockRuntime,
        greetingMessage,
      );
      expect(isGreetingValid).toBe(true);
    });

    test("should respond with hello world", async () => {
      if (!helloAction?.handler) {
        throw new Error("Action handler is not defined");
      }

      // Mock callback to capture response
      const mockCallback = mock((response: any) => {
        expect(response).toBeDefined();
        expect(response.text.toLowerCase()).toContain("hello");
      });

      // Execute the handler
      await helloAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
      );

      // Verify callback was called
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe("Action Registry", () => {
    test("all actions should have unique names", () => {
      if (!plugin.actions) return;

      const actionNames = plugin.actions.map((action) => action.name);
      const uniqueNames = new Set(actionNames);
      expect(actionNames.length).toBe(uniqueNames.size);
    });

    test("all actions should have required properties", () => {
      if (!plugin.actions) return;

      plugin.actions.forEach((action) => {
        expect(action).toHaveProperty("name");
        expect(action).toHaveProperty("description");
        expect(action).toHaveProperty("validate");
        expect(action).toHaveProperty("handler");
        expect(typeof action.name).toBe("string");
        expect(typeof action.description).toBe("string");
        expect(typeof action.validate).toBe("function");
        expect(typeof action.handler).toBe("function");
      });
    });

    test("all actions should have examples", () => {
      if (!plugin.actions) return;

      plugin.actions.forEach((action) => {
        expect(action.examples).toBeDefined();
        expect(Array.isArray(action.examples)).toBe(true);
        if (action.examples && action.examples.length > 0) {
          // Validate example structure
          action.examples.forEach((example) => {
            expect(Array.isArray(example)).toBe(true);
            expect(example.length).toBeGreaterThanOrEqual(2);
            example.forEach((message) => {
              expect(message).toHaveProperty("name");
              expect(message).toHaveProperty("content");
              expect(message.content).toHaveProperty("text");
            });
          });
        }
      });
    });
  });
});
