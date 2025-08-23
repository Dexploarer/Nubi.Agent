import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { IAgentRuntime, Memory, UUID } from "@elizaos/core";
import {
  NUBISessionsService,
  SessionConfig,
  RaidSessionConfig,
} from "../../services/nubi-sessions-service";
import { SessionsAPI } from "../../api/sessions-api";
import { MockRuntime } from "../test-utils";

/**
 * Sessions API Integration Tests
 *
 * Tests the full Sessions API functionality including:
 * - Session creation and management
 * - Raid session coordination
 * - Real-time message processing
 * - Database integration patterns
 */

describe("SessionsAPI Integration Tests", () => {
  let runtime: MockRuntime;
  let sessionsService: NUBISessionsService;
  let sessionsAPI: SessionsAPI;

  beforeEach(async () => {
    runtime = new MockRuntime();
    sessionsService = new NUBISessionsService(runtime as IAgentRuntime);
    await sessionsService.start();

    sessionsAPI = new SessionsAPI(runtime as IAgentRuntime, sessionsService, {
      basePath: "/api/sessions",
      enableCORS: true,
      authRequired: false,
    });
  });

  afterEach(async () => {
    await sessionsService.stop();
  });

  describe("Session Management", () => {
    it("should create a new session successfully", async () => {
      const sessionRequest = {
        agentId: runtime.agentId,
        userId: crypto.randomUUID() as UUID,
        sessionType: "conversation" as const,
        timeout: 3600000,
        metadata: { test: "data" },
      };

      const response = await sessionsAPI.createSession(sessionRequest);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.id).toBeDefined();
      expect(response.data?.agentId).toBe(sessionRequest.agentId);
      expect(response.data?.state.status).toBe("active");
    });

    it("should retrieve an existing session", async () => {
      // Create session first
      const sessionRequest = {
        agentId: runtime.agentId,
        userId: crypto.randomUUID() as UUID,
        sessionType: "conversation" as const,
      };

      const createResponse = await sessionsAPI.createSession(sessionRequest);
      expect(createResponse.success).toBe(true);

      // Retrieve session
      const sessionId = createResponse.data!.id;
      const getResponse = await sessionsAPI.getSession(sessionId);

      expect(getResponse.success).toBe(true);
      expect(getResponse.data?.id).toBe(sessionId);
      expect(getResponse.data?.agentId).toBe(sessionRequest.agentId);
    });

    it("should return error for non-existent session", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await sessionsAPI.getSession(nonExistentId);

      expect(response.success).toBe(false);
      expect(response.error).toBe("Session not found");
    });

    it("should delete a session successfully", async () => {
      // Create session first
      const sessionRequest = {
        agentId: runtime.agentId,
        userId: crypto.randomUUID() as UUID,
        sessionType: "conversation" as const,
      };

      const createResponse = await sessionsAPI.createSession(sessionRequest);
      const sessionId = createResponse.data!.id;

      // Delete session
      const deleteResponse = await sessionsAPI.deleteSession(sessionId);

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data).toBe(true);

      // Verify session is expired
      const session = await sessionsService.getSession(sessionId);
      expect(session?.state.status).toBe("expired");
    });
  });

  describe("Message Processing", () => {
    it("should process messages in a session", async () => {
      // Create session
      const sessionRequest = {
        agentId: runtime.agentId,
        userId: crypto.randomUUID() as UUID,
        sessionType: "conversation" as const,
      };

      const createResponse = await sessionsAPI.createSession(sessionRequest);
      const sessionId = createResponse.data!.id;

      // Send message
      const messageRequest = {
        content: "Hello, NUBI!",
        type: "text",
        metadata: { test: true },
      };

      const messageResponse = await sessionsAPI.sendMessage(
        sessionId,
        messageRequest,
      );

      expect(messageResponse.success).toBe(true);
      expect(messageResponse.data?.response).toBeDefined();
      expect(messageResponse.data?.sessionId).toBe(sessionId);

      // Verify session activity was updated
      const session = await sessionsService.getSession(sessionId);
      expect(session?.state.messages).toBe(1);
    });

    it("should handle invalid session for messages", async () => {
      const nonExistentId = crypto.randomUUID();
      const messageRequest = {
        content: "Hello",
        type: "text",
      };

      const response = await sessionsAPI.sendMessage(
        nonExistentId,
        messageRequest,
      );

      expect(response.success).toBe(false);
      expect(response.error).toBe("Session not found");
    });
  });

  describe("Raid Session Management", () => {
    it("should create a raid session successfully", async () => {
      const raidRequest = {
        agentId: runtime.agentId,
        userId: crypto.randomUUID() as UUID,
        raidId: "test_raid_001",
        targetUrl: "https://twitter.com/test/status/123456789",
        objectives: [
          {
            type: "like" as const,
            target: "123456789",
            count: 100,
            points: 10,
          },
          {
            type: "retweet" as const,
            target: "123456789",
            count: 50,
            points: 20,
          },
        ],
        duration: 3600,
        maxParticipants: 500,
      };

      const response = await sessionsAPI.createRaidSession(raidRequest);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.raidId).toBe(raidRequest.raidId);
      expect(response.data?.targetUrl).toBe(raidRequest.targetUrl);
      expect(response.data?.objectives).toHaveLength(2);
      expect(response.data?.progress.status).toBe("active");
    });

    it("should allow users to join raid sessions", async () => {
      // Create raid session
      const raidRequest = {
        agentId: runtime.agentId,
        raidId: "test_raid_002",
        targetUrl: "https://twitter.com/test/status/123456789",
        objectives: [
          {
            type: "like" as const,
            target: "123456789",
            count: 100,
            points: 10,
          },
        ],
        duration: 3600,
      };

      const createResponse = await sessionsAPI.createRaidSession(raidRequest);
      const sessionId = createResponse.data!.id;

      // Join raid
      const joinRequest = {
        telegramId: "123456789",
        telegramUsername: "testuser",
        twitterUsername: "testuser_twitter",
      };

      const joinResponse = await sessionsAPI.joinRaidSession(
        sessionId,
        joinRequest,
      );

      expect(joinResponse.success).toBe(true);
      expect(joinResponse.data).toBe(true);

      // Verify participant was added
      const session = await sessionsService.getSession(sessionId);
      const raidSession = session as any; // RaidSession type
      expect(raidSession.participants).toHaveLength(1);
      expect(raidSession.participants[0].telegramUsername).toBe("testuser");
    });

    it("should handle invalid session for raid join", async () => {
      const nonExistentId = crypto.randomUUID();
      const joinRequest = {
        telegramId: "123456789",
        telegramUsername: "testuser",
      };

      const response = await sessionsAPI.joinRaidSession(
        nonExistentId,
        joinRequest,
      );

      expect(response.success).toBe(false);
    });
  });

  describe("Session Statistics", () => {
    it("should provide session statistics", async () => {
      // Create multiple sessions of different types
      await sessionsAPI.createSession({
        agentId: runtime.agentId,
        sessionType: "conversation",
      });

      await sessionsAPI.createSession({
        agentId: runtime.agentId,
        sessionType: "community",
      });

      await sessionsAPI.createRaidSession({
        agentId: runtime.agentId,
        raidId: "stats_test_raid",
        targetUrl: "https://twitter.com/test/status/123456789",
        objectives: [],
        duration: 3600,
      });

      const response = await sessionsAPI.getSessionStats();

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.total).toBe(3);
      expect(response.data.active).toBe(3);
      expect(response.data.raids).toBe(1);
      expect(response.data.community).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle service failures gracefully", async () => {
      // Stop the sessions service to simulate failure
      await sessionsService.stop();

      const sessionRequest = {
        agentId: runtime.agentId,
        sessionType: "conversation" as const,
      };

      const response = await sessionsAPI.createSession(sessionRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it("should validate required parameters", async () => {
      const invalidRequest = {
        // Missing agentId
        sessionType: "conversation" as const,
      } as any;

      const response = await sessionsAPI.createSession(invalidRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it("should handle malformed raid requests", async () => {
      const invalidRaidRequest = {
        agentId: runtime.agentId,
        raidId: "invalid_raid",
        // Missing required fields
        objectives: [],
      } as any;

      const response = await sessionsAPI.createRaidSession(invalidRaidRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe("Socket.IO Integration", () => {
    it("should generate Socket.IO event handlers", () => {
      const handlers = sessionsAPI.generateSocketIOHandlers();

      expect(handlers).toBeDefined();
      expect(typeof handlers["session:create"]).toBe("function");
      expect(typeof handlers["session:join"]).toBe("function");
      expect(typeof handlers["session:message"]).toBe("function");
      expect(typeof handlers["raid:create"]).toBe("function");
      expect(typeof handlers["raid:join"]).toBe("function");
      expect(typeof handlers["session:stats"]).toBe("function");
    });

    it("should handle Socket.IO session creation", async () => {
      const handlers = sessionsAPI.generateSocketIOHandlers();
      const createHandler = handlers["session:create"];

      const mockCallback = jest.fn();
      const sessionData = {
        agentId: runtime.agentId,
        sessionType: "conversation" as const,
      };

      await createHandler(sessionData, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            agentId: runtime.agentId,
          }),
        }),
      );
    });
  });

  describe("Express.js Integration", () => {
    it("should generate Express.js route handlers", () => {
      const routes = sessionsAPI.generateExpressRoutes();

      expect(routes).toBeDefined();
      expect(typeof routes.createSession).toBe("function");
      expect(typeof routes.getSession).toBe("function");
      expect(typeof routes.sendMessage).toBe("function");
      expect(typeof routes.deleteSession).toBe("function");
      expect(typeof routes.createRaidSession).toBe("function");
      expect(typeof routes.joinRaidSession).toBe("function");
      expect(typeof routes.getStats).toBe("function");
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle concurrent session creation", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        sessionsAPI.createSession({
          agentId: runtime.agentId,
          sessionType: "conversation",
          metadata: { index: i },
        }),
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach((response, i) => {
        expect(response.success).toBe(true);
        expect(response.data?.metadata.index).toBe(i);
      });
    });

    it("should handle concurrent raid joins", async () => {
      // Create raid session
      const raidResponse = await sessionsAPI.createRaidSession({
        agentId: runtime.agentId,
        raidId: "concurrent_test_raid",
        targetUrl: "https://twitter.com/test/status/123456789",
        objectives: [],
        duration: 3600,
      });

      const sessionId = raidResponse.data!.id;

      // Simulate concurrent joins
      const promises = Array.from({ length: 5 }, (_, i) =>
        sessionsAPI.joinRaidSession(sessionId, {
          telegramId: `user_${i}`,
          telegramUsername: `testuser_${i}`,
          twitterUsername: `twitter_${i}`,
        }),
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach((response) => {
        expect(response.success).toBe(true);
      });

      // Verify all participants were added
      const session = await sessionsService.getSession(sessionId);
      const raidSession = session as any;
      expect(raidSession.participants).toHaveLength(5);
    });
  });
});
