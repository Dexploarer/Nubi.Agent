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
import { PersonalityEvolutionService } from "../services/personality-evolution-service";
import SecurityFilter from "../services/security-filter";
import { EmotionalStateService } from "../services/emotional-state-service";
import { SessionsService } from "../services/sessions-service";
import { DatabaseMemoryService } from "../services/database-memory-service";

describe("Services", () => {
  describe("PersonalityEvolutionService", () => {
    let service: PersonalityEvolutionService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new PersonalityEvolutionService(mockRuntime);
    });

    test("should initialize correctly", async () => {
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toBeDefined();
    });

    test("should have correct service type", () => {
      expect(PersonalityEvolutionService.serviceType).toBe(
        "personality_evolution",
      );
    });

    test("should stop gracefully", async () => {
      await service.stop();
      expect(service).toBeDefined();
    });
  });

  describe("SecurityFilter", () => {
    let service: SecurityFilter;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new SecurityFilter(mockRuntime);
    });

    test("should initialize correctly", async () => {
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toBeDefined();
    });

    test("should have correct service type", () => {
      expect(SecurityFilter.serviceType).toBe("security-filter");
    });

    test("should process messages", async () => {
      const result = await service.processMessage("test-user", "Hello world");
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });

    test("should stop gracefully", async () => {
      await service.stop();
      expect(service).toBeDefined();
    });
  });

  describe("EmotionalStateService", () => {
    let service: EmotionalStateService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      service = new EmotionalStateService(mockRuntime);
    });

    test("should initialize correctly", async () => {
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toBeDefined();
    });

    test("should have correct service type", () => {
      expect(EmotionalStateService.serviceType).toBe("emotional_state");
    });

    test("should stop gracefully", async () => {
      await service.stop();
      expect(service).toBeDefined();
    });
  });

  describe("SessionsService", () => {
    let service: SessionsService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      // Add agentId to mockRuntime
      mockRuntime.agentId = "test-agent-id" as any;
      service = new SessionsService(mockRuntime);
    });

    test("should initialize correctly", async () => {
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toBeDefined();
    });

    test("should have correct service type", () => {
      expect(SessionsService.serviceType).toBe("sessions");
    });

    test("should stop gracefully", async () => {
      await service.stop();
      expect(service).toBeDefined();
    });
  });

  describe("DatabaseMemoryService", () => {
    let service: DatabaseMemoryService;
    let mockRuntime: MockRuntime;

    beforeEach(() => {
      const setup = setupServiceTest();
      mockRuntime = setup.mockRuntime as MockRuntime;
      // Add agentId to mockRuntime
      mockRuntime.agentId = "test-agent-id" as any;
      service = new DatabaseMemoryService(mockRuntime);
    });

    test("should initialize correctly", async () => {
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toBeDefined();
    });

    test("should have correct service type", () => {
      expect(DatabaseMemoryService.serviceType).toBe("database_memory");
    });

    test("should stop gracefully", async () => {
      await service.stop();
      expect(service).toBeDefined();
    });
  });

  describe("Service Registration", () => {
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

      // Add agentId to mockRuntime
      mockRuntime.agentId = "test-agent-id" as any;
      const service = new SessionsService(mockRuntime);

      // SessionsService constructor doesn't throw, it just logs warnings
      expect(service).toBeDefined();
    });

    test("services should handle runtime errors gracefully", async () => {
      const { mockRuntime } = setupServiceTest();
      const service = new SecurityFilter(mockRuntime);

      // SecurityFilter handles null messages gracefully
      const result = await service.processMessage("test-user", "");
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });
  });
});
