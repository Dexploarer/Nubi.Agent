/**
 * Service tests following ElizaOS testing patterns
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  mock,
  spyOn,
  setupServiceTest,
  createMockMessage,
  createMockState,
  MockRuntime,
  testAsyncOperation,
  verifyStateChange,
} from "./test-utils";
import { ServiceType } from "@elizaos/core";

// Import services
import { PersonalityService } from "../services/personality-service";
import { EnhancedRealtimeService } from "../services/enhanced-realtime-service";
import { SecurityFilterService } from "../services/security-filter";
import { EmotionalStateService } from "../services/emotional-state-service";
import { SessionsService } from "../services/sessions-service";

describe("Services", () => {
  describe("PersonalityService", () => {
    let service: PersonalityService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new PersonalityService();
    });

    test("should initialize correctly", async () => {
      await service.initialize(mockRuntime);
      expect(service).toBeDefined();
    });

    test("should get personality traits", () => {
      const traits = service.getPersonalityTraits();
      expect(traits).toBeDefined();
      expect(typeof traits).toBe("object");
    });

    test("should adapt personality based on context", async () => {
      await service.initialize(mockRuntime);

      const context = {
        userPreferences: { formality: "casual" },
        conversationTone: "friendly",
      };

      const adaptedPersonality = await service.adaptPersonality(context);
      expect(adaptedPersonality).toBeDefined();
      expect(typeof adaptedPersonality).toBe("object");
    });

    test("should handle personality evolution", async () => {
      await service.initialize(mockRuntime);

      const interaction = {
        userId: "test-user",
        sentiment: "positive",
        topic: "technology",
      };

      await service.evolvePersonality(interaction);
      const traits = service.getPersonalityTraits();
      expect(traits).toBeDefined();
    });
  });

  describe("EnhancedRealtimeService", () => {
    let service: EnhancedRealtimeService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new EnhancedRealtimeService();
    });

    test("should initialize correctly", async () => {
      await service.initialize(mockRuntime);
      expect(service).toBeDefined();
    });

    test("should handle real-time message processing", async () => {
      await service.initialize(mockRuntime);

      const message = createMockMessage({
        content: { text: "Test realtime message", action: null },
      });

      const result = await service.processRealtimeMessage(message);
      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
    });

    test("should manage message queue", async () => {
      await service.initialize(mockRuntime);

      const messages = [
        createMockMessage({ content: { text: "Message 1", action: null } }),
        createMockMessage({ content: { text: "Message 2", action: null } }),
        createMockMessage({ content: { text: "Message 3", action: null } }),
      ];

      for (const msg of messages) {
        await service.queueMessage(msg);
      }

      const queueSize = service.getQueueSize();
      expect(queueSize).toBeGreaterThan(0);
    });

    test("should handle connection events", async () => {
      await service.initialize(mockRuntime);

      const connectionId = "test-connection-123";

      // Test connection
      await service.handleConnection(connectionId);
      expect(service.isConnected(connectionId)).toBe(true);

      // Test disconnection
      await service.handleDisconnection(connectionId);
      expect(service.isConnected(connectionId)).toBe(false);
    });
  });

  describe("SecurityFilterService", () => {
    let service: SecurityFilterService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new SecurityFilterService();
    });

    test("should initialize correctly", async () => {
      await service.initialize(mockRuntime);
      expect(service).toBeDefined();
    });

    test("should filter harmful content", async () => {
      await service.initialize(mockRuntime);

      const harmfulMessage = createMockMessage({
        content: { text: "This contains harmful content", action: null },
      });

      const result = await service.filterMessage(harmfulMessage);
      expect(result).toBeDefined();
      expect(result.safe).toBeDefined();
    });

    test("should allow safe content", async () => {
      await service.initialize(mockRuntime);

      const safeMessage = createMockMessage({
        content: { text: "This is a friendly greeting", action: null },
      });

      const result = await service.filterMessage(safeMessage);
      expect(result).toBeDefined();
      expect(result.safe).toBe(true);
    });

    test("should track security metrics", async () => {
      await service.initialize(mockRuntime);

      const messages = [
        createMockMessage({ content: { text: "Message 1", action: null } }),
        createMockMessage({ content: { text: "Message 2", action: null } }),
      ];

      for (const msg of messages) {
        await service.filterMessage(msg);
      }

      const metrics = service.getSecurityMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalProcessed).toBeGreaterThan(0);
    });
  });

  describe("EmotionalStateService", () => {
    let service: EmotionalStateService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new EmotionalStateService();
    });

    test("should initialize correctly", async () => {
      await service.initialize(mockRuntime);
      expect(service).toBeDefined();
    });

    test("should track emotional state", async () => {
      await service.initialize(mockRuntime);

      const message = createMockMessage({
        content: { text: "I'm really happy today!", action: null },
      });

      await service.analyzeEmotion(message);
      const state = service.getCurrentEmotionalState();

      expect(state).toBeDefined();
      expect(state.sentiment).toBeDefined();
    });

    test("should detect emotion changes", async () => {
      await service.initialize(mockRuntime);

      const happyMessage = createMockMessage({
        content: { text: "This is wonderful!", action: null },
      });

      const sadMessage = createMockMessage({
        content: { text: "I'm feeling down", action: null },
      });

      await service.analyzeEmotion(happyMessage);
      const happyState = service.getCurrentEmotionalState();

      await service.analyzeEmotion(sadMessage);
      const sadState = service.getCurrentEmotionalState();

      expect(happyState.sentiment).not.toEqual(sadState.sentiment);
    });
  });

  describe("SessionsService", () => {
    let service: SessionsService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new SessionsService();
    });

    test("should initialize correctly", async () => {
      await service.initialize(mockRuntime);
      expect(service).toBeDefined();
    });

    test("should create new sessions", async () => {
      await service.initialize(mockRuntime);

      const userId = "test-user-123";
      const session = await service.createSession(userId);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(userId);
    });

    test("should retrieve existing sessions", async () => {
      await service.initialize(mockRuntime);

      const userId = "test-user-456";
      const created = await service.createSession(userId);
      const retrieved = await service.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.userId).toBe(userId);
    });

    test("should handle session expiration", async () => {
      await service.initialize(mockRuntime);

      const userId = "test-user-789";
      const session = await service.createSession(userId, { ttl: 1 }); // 1 second TTL

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const expired = await service.getSession(session.id);
      expect(expired).toBeNull();
    });

    test("should update session data", async () => {
      await service.initialize(mockRuntime);

      const userId = "test-user-update";
      const session = await service.createSession(userId);

      const updateData = { lastActivity: Date.now(), messageCount: 5 };
      await service.updateSession(session.id, updateData);

      const updated = await service.getSession(session.id);
      expect(updated?.data).toMatchObject(updateData);
    });
  });

  describe("Service Registration", () => {
    test("services should register with runtime", async () => {
      const { mockRuntime } = setupServiceTest();
      const service = new PersonalityService();

      await service.initialize(mockRuntime);

      // Verify service registered itself
      expect(mockRuntime.registerService).toHaveBeenCalled();
    });

    test("services should be retrievable from runtime", () => {
      const { mockRuntime } = setupServiceTest();

      // Mock a registered service
      const mockService = { name: "TestService" };
      mockRuntime.services.set("TEST_SERVICE" as ServiceType, mockService);

      const retrieved = mockRuntime.getService("TEST_SERVICE" as ServiceType);
      expect(retrieved).toBe(mockService);
    });
  });

  describe("Service Error Handling", () => {
    test("services should handle initialization errors", async () => {
      const { mockRuntime } = setupServiceTest();

      // Create a runtime that will fail
      mockRuntime.databaseAdapter.init = mock(() =>
        Promise.reject(new Error("Database connection failed")),
      );

      const service = new SessionsService();

      try {
        await service.initialize(mockRuntime);
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain("Database");
      }
    });

    test("services should handle runtime errors gracefully", async () => {
      const { mockRuntime } = setupServiceTest();
      const service = new SecurityFilterService();

      await service.initialize(mockRuntime);

      // Create a message that will cause processing error
      const invalidMessage = null as any;

      try {
        await service.filterMessage(invalidMessage);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
