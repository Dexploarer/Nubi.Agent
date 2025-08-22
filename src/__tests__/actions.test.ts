/**
 * Actions tests following ElizaOS testing patterns
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
  MockRuntime,
  testErrorHandling,
  testAsyncOperation,
} from "./test-utils";
import type { Action, ActionResult } from "@elizaos/core";
import plugin from "../plugins/nubi-plugin";

describe("Plugin Actions", () => {
  describe("Action Registry", () => {
    test("should have actions defined", () => {
      expect(plugin.actions).toBeDefined();
      expect(Array.isArray(plugin.actions)).toBe(true);
    });

    test("all actions should have required properties", () => {
      if (!plugin.actions) return;

      plugin.actions.forEach((action) => {
        expect(action).toHaveProperty("name");
        expect(action).toHaveProperty("similes");
        expect(action).toHaveProperty("description");
        expect(action).toHaveProperty("validate");
        expect(action).toHaveProperty("handler");
        expect(action).toHaveProperty("examples");
      });
    });

    test("all actions should have unique names", () => {
      if (!plugin.actions) return;

      const actionNames = plugin.actions.map((action) => action.name);
      const uniqueNames = new Set(actionNames);
      expect(actionNames.length).toBe(uniqueNames.size);
    });
  });

  describe("ANUBIS_SESSION_MANAGEMENT Action", () => {
    let sessionAction: Action | undefined;
    let mockRuntime: MockRuntime;
    let mockMessage: any;
    let mockState: any;
    let callbackFn: any;

    beforeEach(() => {
      const setup = setupActionTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;
      mockState = setup.mockState;
      callbackFn = setup.callbackFn;

      // Find the session management action
      sessionAction = plugin.actions?.find(
        (action) => action.name === "ANUBIS_SESSION_MANAGEMENT",
      );
    });

    test("should exist in the plugin", () => {
      expect(sessionAction).toBeDefined();
    });

    test("should have the correct structure", () => {
      expect(sessionAction).toHaveProperty("name", "ANUBIS_SESSION_MANAGEMENT");
      expect(sessionAction).toHaveProperty("description");
      expect(sessionAction).toHaveProperty("similes");
      expect(sessionAction).toHaveProperty("validate");
      expect(sessionAction).toHaveProperty("handler");
      expect(sessionAction).toHaveProperty("examples");
    });

    test("should validate session management messages", async () => {
      if (!sessionAction?.validate) {
        throw new Error("Action validate is not defined");
      }

      // Test new conversation message
      const newConversationMessage = createMockMessage({
        content: { text: "new conversation", action: null },
      });
      const isValid = await sessionAction.validate(
        mockRuntime,
        newConversationMessage,
      );
      expect(isValid).toBe(true);

      // Test switch context message
      const switchContextMessage = createMockMessage({
        content: { text: "switch context", action: null },
      });
      const isSwitchValid = await sessionAction.validate(
        mockRuntime,
        switchContextMessage,
      );
      expect(isSwitchValid).toBe(true);

      // Test non-session message
      const regularMessage = createMockMessage({
        content: { text: "just a regular message", action: null },
      });
      const isRegularValid = await sessionAction.validate(
        mockRuntime,
        regularMessage,
      );
      expect(isRegularValid).toBe(false);
    });

    test("should handle new conversation request", async () => {
      if (!sessionAction?.handler) {
        throw new Error("Action handler is not defined");
      }

      const newConversationMessage = createMockMessage({
        content: { text: "new conversation", action: null },
      });

      const mockCallback = mock((response: any) => {
        expect(response).toBeDefined();
        expect(response.text).toContain("fresh conversation");
      });

      const result = await sessionAction.handler(
        mockRuntime,
        newConversationMessage,
        mockState,
        {},
        mockCallback,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe("NUBI_RITUAL Action", () => {
    let ritualAction: Action | undefined;
    let mockRuntime: MockRuntime;
    let mockMessage: any;
    let mockState: any;
    let callbackFn: any;

    beforeEach(() => {
      const setup = setupActionTest();
      mockRuntime = setup.mockRuntime;
      mockMessage = setup.mockMessage;
      mockState = setup.mockState;
      callbackFn = setup.callbackFn;

      // Add generateText to mockRuntime for ritual action
      mockRuntime.generateText = mock(async () => "Mocked ritual response");

      // Find the ritual action (it's added via identityActions)
      ritualAction = plugin.actions?.find(
        (action) => action.name === "NUBI_RITUAL",
      );
    });

    test("should exist in the plugin", () => {
      expect(ritualAction).toBeDefined();
    });

    test("should have the correct structure", () => {
      if (!ritualAction) return;

      expect(ritualAction).toHaveProperty("name", "NUBI_RITUAL");
      expect(ritualAction).toHaveProperty("description");
      expect(ritualAction).toHaveProperty("similes");
      expect(ritualAction).toHaveProperty("validate");
      expect(ritualAction).toHaveProperty("handler");
      expect(ritualAction).toHaveProperty("examples");
    });

    test("should validate ritual invocation messages", async () => {
      if (!ritualAction?.validate) {
        throw new Error("Action validate is not defined");
      }

      // Test ritual invocation message
      const ritualMessage = createMockMessage({
        content: { text: "invoke ritual", action: null },
      });
      const isValid = await ritualAction.validate(mockRuntime, ritualMessage);
      expect(isValid).toBe(true);

      // Test perform blessing message
      const blessingMessage = createMockMessage({
        content: { text: "perform blessing", action: null },
      });
      const isBlessingValid = await ritualAction.validate(
        mockRuntime,
        blessingMessage,
      );
      expect(isBlessingValid).toBe(true);

      // Test non-ritual message
      const regularMessage = createMockMessage({
        content: { text: "just chatting", action: null },
      });
      const isRegularValid = await ritualAction.validate(
        mockRuntime,
        regularMessage,
      );
      expect(isRegularValid).toBe(false);
    });

    test("should handle ritual invocation", async () => {
      if (!ritualAction?.handler) {
        throw new Error("Action handler is not defined");
      }

      const ritualMessage = createMockMessage({
        content: { text: "invoke ritual", action: null },
      });

      const mockCallback = mock((response: any) => {
        expect(response).toBeDefined();
      });

      const result = await ritualAction.handler(
        mockRuntime,
        ritualMessage,
        mockState,
        {},
        mockCallback,
      );

      expect(result).toBeDefined();
      if (result.success) {
        expect(result.text).toBeDefined();
      }
    });
  });

  describe("Action Validation", () => {
    test("actions should prevent self-evaluation", async () => {
      if (!plugin.actions || plugin.actions.length === 0) return;

      const firstAction = plugin.actions[0];
      if (!firstAction.validate) return;

      // Create message from agent itself
      const selfMessage = createMockMessage({
        content: { text: "test message", action: null },
      });

      const { mockRuntime } = setupActionTest();
      // Set message entityId to match runtime agentId
      mockRuntime.agentId = "agent-123" as any;
      selfMessage.entityId = "agent-123" as any;

      const isValid = await firstAction.validate(
        mockRuntime,
        selfMessage,
        createMockState(),
      );

      // Most actions should reject self-messages
      expect(isValid).toBe(false);
    });

    test("actions should handle missing content gracefully", async () => {
      if (!plugin.actions || plugin.actions.length === 0) return;

      const firstAction = plugin.actions[0];
      if (!firstAction.validate) return;

      // Create message with missing content
      const emptyMessage = createMockMessage({
        content: { text: "", action: null },
      });

      const { mockRuntime } = setupActionTest();

      // Should not throw
      const isValid = await firstAction.validate(
        mockRuntime,
        emptyMessage,
        createMockState(),
      );

      expect(typeof isValid).toBe("boolean");
    });
  });

  describe("Action Error Handling", () => {
    test("actions should handle handler errors gracefully", async () => {
      if (!plugin.actions || plugin.actions.length === 0) return;

      const sessionAction = plugin.actions.find(
        (a) => a.name === "ANUBIS_SESSION_MANAGEMENT",
      );
      if (!sessionAction || !sessionAction.handler) return;

      const { mockRuntime, mockMessage, mockState } = setupActionTest();

      // Force an error by mocking getMemories to throw
      mockRuntime.getMemories = mock(() =>
        Promise.reject(new Error("Database error")),
      );

      const switchContextMessage = createMockMessage({
        content: { text: "switch context", action: null },
      });

      const result = await sessionAction.handler(
        mockRuntime,
        switchContextMessage,
        mockState,
        {},
        undefined,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
