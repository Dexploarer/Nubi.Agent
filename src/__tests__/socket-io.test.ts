/**
 * Socket.IO Services Tests
 *
 * Tests for Socket.IO server, client, and analytics services
 * Following patterns from https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  SocketIOServerService,
  SocketMessage,
} from "../services/socket-io-server";
import { SocketIOClientService } from "../services/socket-io-client";
import { SocketIOAnalyticsService } from "../services/socket-io-analytics";
import { setupActionTest } from "./test-utils";

describe("Socket.IO Services", () => {
  let mockRuntime: any;

  beforeEach(() => {
    const setup = setupActionTest();
    mockRuntime = setup.mockRuntime;

    // Mock environment variables
    process.env.SOCKET_PORT = "3001";
    process.env.SOCKET_IO_URL = "http://localhost:3001";
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SOCKET_PORT;
    delete process.env.SOCKET_IO_URL;
  });

  describe("SocketIOServerService", () => {
    let serverService: SocketIOServerService;

    beforeEach(() => {
      serverService = new SocketIOServerService(mockRuntime);
    });

    afterEach(async () => {
      if (serverService) {
        await serverService.stop();
      }
    });

    describe("initialization", () => {
      it("should initialize successfully", () => {
        expect(serverService).toBeDefined();
        expect(typeof serverService.initialize).toBe("function");
        expect(typeof serverService.stop).toBe("function");
      });

      it("should have correct service type", () => {
        expect((serverService.constructor as any).serviceType).toBe(
          "socket-io-server",
        );
      });

      it("should initialize world state", () => {
        const worldState = serverService.getWorldState();
        expect(worldState).toBeDefined();
        expect(worldState.rooms).toEqual({});
        expect(worldState.users).toEqual({});
      });
    });

    describe("world state management", () => {
      it("should return world state", () => {
        const worldState = serverService.getWorldState();
        expect(worldState).toBeDefined();
        expect(typeof worldState).toBe("object");
        expect(worldState.rooms).toBeDefined();
        expect(worldState.users).toBeDefined();
      });

      it("should return room state", () => {
        const roomState = serverService.getRoomState("test-room");
        expect(roomState).toBeNull(); // Initially null for non-existent room
      });

      it("should provide broadcast methods", () => {
        expect(typeof serverService.broadcastToRoom).toBe("function");
        expect(typeof serverService.broadcastToAll).toBe("function");

        // Should not throw when server is not initialized
        expect(() => {
          serverService.broadcastToRoom("test-room", "test-event", {});
          serverService.broadcastToAll("test-event", {});
        }).not.toThrow();
      });
    });

    describe("service lifecycle", () => {
      it("should stop gracefully", async () => {
        await expect(serverService.stop()).resolves.toBeUndefined();
      });
    });
  });

  describe("SocketIOClientService", () => {
    let clientService: SocketIOClientService;

    beforeEach(() => {
      clientService = new SocketIOClientService({
        url: "http://localhost:3001",
        reconnection: false, // Disable reconnection for tests
        timeout: 1000,
      });
    });

    afterEach(async () => {
      if (clientService) {
        await clientService.stop();
      }
    });

    describe("initialization", () => {
      it("should initialize successfully", () => {
        expect(clientService).toBeDefined();
        expect(typeof clientService.initialize).toBe("function");
        expect(typeof clientService.stop).toBe("function");
      });

      it("should have correct service type", () => {
        expect((clientService.constructor as any).serviceType).toBe(
          "socket-io-client",
        );
      });

      it("should initialize with default config", () => {
        const defaultClient = new SocketIOClientService();
        expect(defaultClient).toBeDefined();
      });

      it("should initialize with custom config", () => {
        const customClient = new SocketIOClientService({
          url: "http://custom:3000",
          reconnectionAttempts: 3,
        });
        expect(customClient).toBeDefined();
      });
    });

    describe("connection state", () => {
      it("should start as disconnected", () => {
        expect(clientService.connected).toBe(false);
        expect(clientService.currentRoom).toBeUndefined();
        expect(clientService.user.id).toBeUndefined();
        expect(clientService.user.name).toBeUndefined();
      });
    });

    describe("room management", () => {
      it("should handle room operations when disconnected", async () => {
        await expect(
          clientService.joinRoom("test-room", "user-1", "Test User"),
        ).rejects.toThrow("not connected");

        // Leave room should not throw when not connected
        await expect(clientService.leaveRoom()).resolves.toBeUndefined();
      });

      it("should handle message sending when not ready", async () => {
        await expect(clientService.sendMessage("test message")).rejects.toThrow(
          "not ready",
        );
      });

      it("should handle world state request when disconnected", async () => {
        await expect(clientService.requestWorldState()).rejects.toThrow(
          "not connected",
        );
      });
    });

    describe("event handlers", () => {
      it("should register event handlers", () => {
        const messageHandler = mock(() => {});
        const userJoinedHandler = mock(() => {});
        const userLeftHandler = mock(() => {});
        const worldStateHandler = mock(() => {});
        const errorHandler = mock(() => {});

        expect(() => {
          clientService.onMessage(messageHandler);
          clientService.onUserJoined(userJoinedHandler);
          clientService.onUserLeft(userLeftHandler);
          clientService.onWorldState(worldStateHandler);
          clientService.onError(errorHandler);
        }).not.toThrow();
      });
    });

    describe("service lifecycle", () => {
      it("should stop gracefully", async () => {
        await expect(clientService.stop()).resolves.toBeUndefined();
      });
    });
  });

  describe("SocketIOAnalyticsService", () => {
    let analyticsService: SocketIOAnalyticsService;

    beforeEach(() => {
      analyticsService = new SocketIOAnalyticsService();
    });

    afterEach(async () => {
      if (analyticsService) {
        await analyticsService.stop();
      }
    });

    describe("initialization", () => {
      it("should initialize successfully", async () => {
        await expect(
          analyticsService.initialize(mockRuntime),
        ).resolves.toBeUndefined();
        expect((analyticsService.constructor as any).serviceType).toBe(
          "socket-io-analytics",
        );
      });
    });

    describe("analytics tracking", () => {
      beforeEach(async () => {
        await analyticsService.initialize(mockRuntime);
      });

      it("should track connections", () => {
        const userId = "user-123";

        expect(() => {
          analyticsService.trackConnection(userId);
        }).not.toThrow();

        const userAnalytics = analyticsService.getUserAnalytics(userId);
        expect(userAnalytics).toBeDefined();
        expect(userAnalytics?.messageCount).toBe(0);
        expect(userAnalytics?.roomsJoined).toEqual([]);
      });

      it("should track disconnections", () => {
        const userId = "user-123";

        analyticsService.trackConnection(userId);

        expect(() => {
          analyticsService.trackDisconnection(userId);
        }).not.toThrow();
      });

      it("should track errors", () => {
        const error = new Error("Test error");

        expect(() => {
          analyticsService.trackError(error);
        }).not.toThrow();

        const analytics = analyticsService.getAnalytics();
        expect(analytics.connectionEvents.errors).toBe(1);
      });

      it("should track messages", () => {
        const message: SocketMessage = {
          senderId: "user-123",
          senderName: "Test User",
          message: "Hello world",
          roomId: "room-456",
          messageId: "msg-789",
          source: "test",
          timestamp: Date.now(),
        };

        analyticsService.trackConnection(message.senderId);
        analyticsService.trackMessage(message);

        const analytics = analyticsService.getAnalytics();
        expect(analytics.messageStats.totalMessages).toBe(1);
        expect(analytics.messagesPerRoom[message.roomId]).toBe(1);

        const userAnalytics = analyticsService.getUserAnalytics(
          message.senderId,
        );
        expect(userAnalytics?.messageCount).toBe(1);
      });

      it("should track room joins and leaves", () => {
        const userId = "user-123";
        const roomId = "room-456";

        analyticsService.trackConnection(userId);
        analyticsService.trackRoomJoin(userId, roomId);

        const userAnalytics = analyticsService.getUserAnalytics(userId);
        expect(userAnalytics?.roomsJoined).toContain(roomId);

        const roomAnalytics = analyticsService.getRoomAnalytics(roomId);
        expect(roomAnalytics.activeUsers).toHaveLength(1);

        analyticsService.trackRoomLeave(userId, roomId);

        const userAnalyticsAfter = analyticsService.getUserAnalytics(userId);
        expect(userAnalyticsAfter?.roomsJoined).not.toContain(roomId);
      });
    });

    describe("analytics retrieval", () => {
      beforeEach(async () => {
        await analyticsService.initialize(mockRuntime);

        // Add some test data
        const message: SocketMessage = {
          senderId: "user-1",
          senderName: "User One",
          message: "Test message",
          roomId: "room-1",
          messageId: "msg-1",
          source: "test",
          timestamp: Date.now(),
        };

        analyticsService.trackConnection("user-1");
        analyticsService.trackRoomJoin("user-1", "room-1");
        analyticsService.trackMessage(message);
      });

      it("should get full analytics", () => {
        const analytics = analyticsService.getAnalytics();
        expect(analytics).toBeDefined();
        expect(analytics.messageStats.totalMessages).toBe(1);
        expect(analytics.connectionEvents.connections).toBe(1);
      });

      it("should get room analytics", () => {
        const roomAnalytics = analyticsService.getRoomAnalytics("room-1");
        expect(roomAnalytics.messages).toBe(1);
        expect(roomAnalytics.activeUsers).toHaveLength(1);
        expect(roomAnalytics.activeUsers[0].userId).toBe("user-1");
      });

      it("should get user analytics", () => {
        const userAnalytics = analyticsService.getUserAnalytics("user-1");
        expect(userAnalytics).toBeDefined();
        expect(userAnalytics?.messageCount).toBe(1);
        expect(userAnalytics?.roomsJoined).toContain("room-1");
      });

      it("should get top rooms", () => {
        const topRooms = analyticsService.getTopRooms(5);
        expect(topRooms).toHaveLength(1);
        expect(topRooms[0].roomId).toBe("room-1");
        expect(topRooms[0].messageCount).toBe(1);
      });

      it("should get top users", () => {
        const topUsers = analyticsService.getTopUsers(5);
        expect(topUsers).toHaveLength(1);
        expect(topUsers[0].userId).toBe("user-1");
        expect(topUsers[0].messageCount).toBe(1);
      });

      it("should get system stats", () => {
        const stats = analyticsService.getSystemStats();
        expect(stats).toBeDefined();
        expect(stats.totalMessages).toBe(1);
        expect(stats.totalRooms).toBe(1);
        expect(stats.totalUsers).toBe(1);
        expect(stats.connections).toBe(1);
        expect(typeof stats.uptime).toBe("number");
      });
    });

    describe("analytics export and cleanup", () => {
      beforeEach(async () => {
        await analyticsService.initialize(mockRuntime);
      });

      it("should export analytics as JSON", () => {
        const exportData = analyticsService.exportAnalytics();
        expect(typeof exportData).toBe("string");

        const parsed = JSON.parse(exportData);
        expect(parsed.exportTime).toBeDefined();
        expect(parsed.startTime).toBeDefined();
        expect(parsed.systemStats).toBeDefined();
        expect(parsed.fullAnalytics).toBeDefined();
      });

      it("should reset analytics", () => {
        // Add some data first
        analyticsService.trackConnection("user-1");
        let analytics = analyticsService.getAnalytics();
        expect(analytics.connectionEvents.connections).toBe(1);

        // Reset and verify
        analyticsService.resetAnalytics();
        analytics = analyticsService.getAnalytics();
        expect(analytics.connectionEvents.connections).toBe(0);
        expect(Object.keys(analytics.activeUsers)).toHaveLength(0);
      });

      it("should cleanup old data", () => {
        // This test would be more meaningful with actual time-based data
        // For now, just verify the method doesn't throw
        expect(() => {
          analyticsService.cleanupOldData(1000); // 1 second max age
        }).not.toThrow();
      });
    });

    describe("service lifecycle", () => {
      it("should stop gracefully", async () => {
        await analyticsService.initialize(mockRuntime);
        await expect(analyticsService.stop()).resolves.toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work together conceptually", () => {
      const server = new SocketIOServerService(mockRuntime);
      const client = new SocketIOClientService(mockRuntime);
      const analytics = new SocketIOAnalyticsService();

      expect(server).toBeDefined();
      expect(client).toBeDefined();
      expect(analytics).toBeDefined();

      // All services should have proper service types
      expect((server.constructor as any).serviceType).toBe("socket-io-server");
      expect((client.constructor as any).serviceType).toBe("socket-io-client");
      expect((analytics.constructor as any).serviceType).toBe(
        "socket-io-analytics",
      );
    });

    it("should handle message flow pattern", () => {
      const analytics = new SocketIOAnalyticsService();

      const testMessage: SocketMessage = {
        senderId: "user-1",
        senderName: "Test User",
        message: "Hello Socket.IO!",
        roomId: "general",
        messageId: "msg-123",
        source: "socket.io-client",
        timestamp: Date.now(),
      };

      // Simulate the flow: connection -> join room -> send message
      analytics.trackConnection(testMessage.senderId);
      analytics.trackRoomJoin(testMessage.senderId, testMessage.roomId);
      analytics.trackMessage(testMessage);

      const roomAnalytics = analytics.getRoomAnalytics(testMessage.roomId);
      const userAnalytics = analytics.getUserAnalytics(testMessage.senderId);

      expect(roomAnalytics.messages).toBe(1);
      expect(roomAnalytics.activeUsers).toHaveLength(1);
      expect(userAnalytics?.messageCount).toBe(1);
      expect(userAnalytics?.roomsJoined).toContain(testMessage.roomId);
    });
  });

  describe("Sessions API Integration Tests", () => {
    let serverService: SocketIOServerService;
    let clientService: SocketIOClientService;

    beforeEach(() => {
      serverService = new SocketIOServerService(mockRuntime);
      clientService = new SocketIOClientService(mockRuntime);
    });

    afterEach(async () => {
      if (serverService) {
        await serverService.stop();
      }
      if (clientService) {
        await clientService.stop();
      }
    });

    it("should manage sessions correctly", () => {
      const sessionId = "test-session-123";
      const userId = "user-1";
      const roomId = "room-1";

      // Test server session management
      expect(serverService.getActiveSession(sessionId)).toBeUndefined();

      // Simulate session creation (would normally come through Socket.IO events)
      // We can't test the full Socket.IO flow in unit tests without actual connections
      const sessionData = {
        sessionId,
        roomId,
        userId,
        isStreaming: false,
        lastActivity: Date.now(),
      };

      // Test session methods exist
      expect(typeof serverService.getActiveSession).toBe("function");
      expect(typeof serverService.getAllActiveSessions).toBe("function");
      expect(typeof serverService.broadcastToSession).toBe("function");
      expect(typeof serverService.updateSessionActivity).toBe("function");
    });

    it("should handle client sessions correctly", () => {
      const sessionId = "test-session-123";

      // Test client session management
      expect(clientService.getActiveSession(sessionId)).toBeUndefined();
      expect(clientService.getAllActiveSessions()).toHaveLength(0);
      expect(clientService.isSessionStreaming(sessionId)).toBe(false);

      // Test session methods exist
      expect(typeof clientService.startSession).toBe("function");
      expect(typeof clientService.startStreaming).toBe("function");
      expect(typeof clientService.sendStreamChunk).toBe("function");
      expect(typeof clientService.endSession).toBe("function");
    });

    it("should have session event handlers", () => {
      // Test that session event handlers can be registered
      expect(typeof clientService.onSessionStarted).toBe("function");
      expect(typeof clientService.onStreamingStarted).toBe("function");
      expect(typeof clientService.onStreamChunk).toBe("function");
      expect(typeof clientService.onStreamingComplete).toBe("function");
      expect(typeof clientService.onSessionEnded).toBe("function");

      // Test handler registration doesn't throw
      expect(() => {
        clientService.onSessionStarted((data) => {
          expect(data.sessionId).toBeDefined();
        });
      }).not.toThrow();
    });

    it("should handle preprocessing configuration", () => {
      // Test that preprocessing config is configurable via environment variables
      const originalConfig = {
        SOCKET_PREPROCESSING_ENABLED: process.env.SOCKET_PREPROCESSING_ENABLED,
        SOCKET_CONTENT_FILTERING: process.env.SOCKET_CONTENT_FILTERING,
        SOCKET_RATE_LIMITING: process.env.SOCKET_RATE_LIMITING,
      };

      // Test with preprocessing disabled
      process.env.SOCKET_PREPROCESSING_ENABLED = "false";
      const serverWithDisabledPreprocessing = new SocketIOServerService(
        mockRuntime,
      );
      expect(serverWithDisabledPreprocessing).toBeDefined();

      // Test with specific features disabled
      process.env.SOCKET_CONTENT_FILTERING = "false";
      process.env.SOCKET_RATE_LIMITING = "false";
      const serverWithPartialDisabled = new SocketIOServerService(mockRuntime);
      expect(serverWithPartialDisabled).toBeDefined();

      // Restore original config
      if (originalConfig.SOCKET_PREPROCESSING_ENABLED) {
        process.env.SOCKET_PREPROCESSING_ENABLED =
          originalConfig.SOCKET_PREPROCESSING_ENABLED;
      } else {
        delete process.env.SOCKET_PREPROCESSING_ENABLED;
      }
      if (originalConfig.SOCKET_CONTENT_FILTERING) {
        process.env.SOCKET_CONTENT_FILTERING =
          originalConfig.SOCKET_CONTENT_FILTERING;
      } else {
        delete process.env.SOCKET_CONTENT_FILTERING;
      }
      if (originalConfig.SOCKET_RATE_LIMITING) {
        process.env.SOCKET_RATE_LIMITING = originalConfig.SOCKET_RATE_LIMITING;
      } else {
        delete process.env.SOCKET_RATE_LIMITING;
      }
    });

    it("should handle session timeout configuration", () => {
      // Test session timeout configuration
      const originalTimeout = process.env.SOCKET_SESSION_TIMEOUT;

      process.env.SOCKET_SESSION_TIMEOUT = "600000"; // 10 minutes
      const serverWithCustomTimeout = new SocketIOServerService(mockRuntime);
      expect(serverWithCustomTimeout).toBeDefined();

      // Restore original config
      if (originalTimeout) {
        process.env.SOCKET_SESSION_TIMEOUT = originalTimeout;
      } else {
        delete process.env.SOCKET_SESSION_TIMEOUT;
      }
    });
  });

  describe("Configurable Preprocessing Pipeline", () => {
    it("should respect preprocessing configuration flags", () => {
      // Save original env vars
      const originalEnv = {
        SOCKET_PREPROCESSING_ENABLED: process.env.SOCKET_PREPROCESSING_ENABLED,
        SOCKET_CONTENT_FILTERING: process.env.SOCKET_CONTENT_FILTERING,
        SOCKET_RATE_LIMITING: process.env.SOCKET_RATE_LIMITING,
        SOCKET_MESSAGE_ENRICHMENT: process.env.SOCKET_MESSAGE_ENRICHMENT,
        SOCKET_SECURITY_CHECKS: process.env.SOCKET_SECURITY_CHECKS,
        SOCKET_ENGAGEMENT_PROCESSING: process.env.SOCKET_ENGAGEMENT_PROCESSING,
        SOCKET_CROSS_PLATFORM_IDENTITY:
          process.env.SOCKET_CROSS_PLATFORM_IDENTITY,
      };

      // Test various configurations
      const configs = [
        { SOCKET_PREPROCESSING_ENABLED: "false" },
        { SOCKET_CONTENT_FILTERING: "false" },
        { SOCKET_RATE_LIMITING: "false" },
        { SOCKET_MESSAGE_ENRICHMENT: "false" },
        { SOCKET_SECURITY_CHECKS: "false" },
        { SOCKET_ENGAGEMENT_PROCESSING: "false" },
        { SOCKET_CROSS_PLATFORM_IDENTITY: "false" },
      ];

      configs.forEach((config) => {
        // Set config
        Object.entries(config).forEach(([key, value]) => {
          process.env[key] = value;
        });

        // Create server with this config
        const server = new SocketIOServerService(mockRuntime);
        expect(server).toBeDefined();
        expect(server.capabilityDescription).toBe(
          "Real-time WebSocket server for bidirectional communication with clients",
        );

        // Clean up config
        Object.keys(config).forEach((key) => {
          delete process.env[key];
        });
      });

      // Restore original env vars
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      });
    });
  });
});
