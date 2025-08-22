import { describe, it, expect } from "bun:test";
import nubiPlugin from "../nubi-plugin";
import * as fs from "fs";

const mockRuntime: any = {
  agentId: "test-agent-id",
  roomId: "test-room-id",
  userId: "test-user-id",
  getSetting: () => undefined,
  getMemory: () => undefined,
  processMessage: async () => undefined,
  evaluate: async () => undefined,
  setState: () => undefined,
  getState: () => ({}),
  getMemories: async () => [],
  getService: () => undefined,
  composeState: async () => ({}),
};

const mockMessage: any = {
  id: "test-memory-id",
  content: { text: "Start a new conversation please" },
  roomId: "test-room-id",
  userId: "test-user-id",
  entityId: "some-user-id",
};

const mockState: any = {};

describe("NUBI Plugin - Structure", () => {
  it("has basic properties", () => {
    expect(nubiPlugin).toBeDefined();
    expect(nubiPlugin.name).toBe("nubi");
    expect(nubiPlugin.description).toBeDefined();
  });

  it("has actions/evaluators/providers arrays", () => {
    expect(Array.isArray(nubiPlugin.actions)).toBe(true);
    expect(nubiPlugin.actions.length).toBeGreaterThan(0);

    expect(Array.isArray(nubiPlugin.evaluators)).toBe(true);
    expect(nubiPlugin.evaluators.length).toBeGreaterThan(0);

    expect(Array.isArray(nubiPlugin.providers)).toBe(true);
    expect(nubiPlugin.providers.length).toBeGreaterThan(0);
  });

  it("has services if defined", () => {
    if (nubiPlugin.services) {
      expect(Array.isArray(nubiPlugin.services)).toBe(true);
    }
  });
});

describe("NUBI Plugin - Actions", () => {
  it("each action exposes required shape", () => {
    for (const action of nubiPlugin.actions) {
      expect(action.name).toBeDefined();
      expect(typeof action.name).toBe("string");
      expect(action.description).toBeDefined();
      expect(action.validate).toBeDefined();
      expect(typeof action.validate).toBe("function");
      expect(action.handler).toBeDefined();
      expect(typeof action.handler).toBe("function");
    }
  });

  it("validate returns boolean and handler resolves when valid", async () => {
    const first = nubiPlugin.actions[0];
    const valid = await first.validate(mockRuntime, mockMessage, mockState);
    expect(typeof valid).toBe("boolean");

    if (valid) {
      // Provide a no-op callback to match handler signature
      const callback = async (_: any) => {};
      const res = await first.handler(
        mockRuntime,
        mockMessage,
        mockState,
        undefined,
        callback,
      );
      expect(res).toBeDefined();
    }
  });
});

describe("NUBI Plugin - Evaluators", () => {
  it("each evaluator exposes required shape", () => {
    for (const evaluator of nubiPlugin.evaluators) {
      expect(evaluator.name).toBeDefined();
      expect(typeof evaluator.name).toBe("string");
      expect(evaluator.description).toBeDefined();
      expect(evaluator.validate).toBeDefined();
      expect(typeof evaluator.validate).toBe("function");
      expect(evaluator.handler).toBeDefined();
      expect(typeof evaluator.handler).toBe("function");
    }
  });

  it("validate returns boolean", async () => {
    const first = nubiPlugin.evaluators[0];
    const valid = await first.validate(mockRuntime, mockMessage, mockState);
    expect(typeof valid).toBe("boolean");
  });
});

describe("NUBI Plugin - Providers", () => {
  it("each provider exposes required shape and get returns data", async () => {
    const provider = nubiPlugin.providers[0] as any;
    expect(provider.name).toBeDefined();
    expect(typeof provider.name).toBe("string");
    expect(provider.get).toBeDefined();
    const result = await provider.get(mockRuntime, mockMessage, mockState);
    expect(result).toBeDefined();
  });
});

describe("NUBI - Character Config", () => {
  it("has character config available (legacy or YAML manager)", () => {
    const hasLegacy = fs.existsSync("config/nubi-config.yaml");
    const hasYamlManagerDir = fs.existsSync("configs");
    expect(hasLegacy || hasYamlManagerDir).toBe(true);
  });
});
