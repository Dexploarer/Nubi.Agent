import { IAgentRuntime, logger, UUID, Memory } from "@elizaos/core";
import {
  NUBISessionsService,
  Session,
  SessionConfig,
  RaidSession,
  RaidSessionConfig,
} from "../services/nubi-sessions-service";

/**
 * NUBI Sessions API
 *
 * RESTful API wrapper around NUBISessionsService providing:
 * - ElizaOS Sessions API compatibility
 * - NUBI-specific raid session endpoints
 * - Real-time session management
 * - Community engagement tracking
 */

export interface SessionsAPIConfig {
  basePath: string;
  enableCORS: boolean;
  authRequired: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SessionCreateRequest {
  agentId: UUID;
  userId?: UUID;
  roomId?: UUID;
  sessionType?: "conversation" | "raid" | "community";
  timeout?: number;
  autoRenewal?: boolean;
  metadata?: Record<string, any>;
}

export interface RaidSessionCreateRequest extends SessionCreateRequest {
  raidId: string;
  targetUrl: string;
  objectives: Array<{
    type: "like" | "retweet" | "reply" | "quote" | "follow";
    target: string;
    count: number;
    points: number;
  }>;
  maxParticipants?: number;
  duration: number;
}

export interface JoinRaidRequest {
  telegramId: string;
  telegramUsername: string;
  twitterUsername?: string;
}

export interface MessageRequest {
  content: string;
  type?: string;
  metadata?: Record<string, any>;
}

export class SessionsAPI {
  private runtime: IAgentRuntime;
  private sessionsService: NUBISessionsService;
  private config: SessionsAPIConfig;

  constructor(
    runtime: IAgentRuntime,
    sessionsService: NUBISessionsService,
    config: SessionsAPIConfig = {
      basePath: "/api/sessions",
      enableCORS: true,
      authRequired: false,
    },
  ) {
    this.runtime = runtime;
    this.sessionsService = sessionsService;
    this.config = config;
  }

  /**
   * Core Sessions API Methods
   */

  /**
   * POST /api/sessions
   * Create a new session
   */
  async createSession(
    request: SessionCreateRequest,
  ): Promise<APIResponse<Session>> {
    try {
      // Validate required parameters
      if (!request.agentId) {
        return {
          success: false,
          error: "agentId is required",
          timestamp: new Date().toISOString(),
        };
      }

      logger.info(
        `[SESSIONS_API] Creating session for agent: ${request.agentId}`,
      );

      const config: SessionConfig = {
        agentId: request.agentId,
        userId: request.userId,
        roomId: request.roomId,
        sessionType: request.sessionType || "conversation",
        timeout: request.timeout || 3600000, // 1 hour default
        autoRenewal: request.autoRenewal || false,
        metadata: request.metadata || {},
      };

      const session = await this.sessionsService.createSession(config);

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to create session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/sessions/:sessionId
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<APIResponse<Session>> {
    try {
      const session = await this.sessionsService.getSession(sessionId);

      if (!session) {
        return {
          success: false,
          error: "Session not found",
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to get session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /api/sessions/:sessionId/messages
   * Send message to session
   */
  async sendMessage(
    sessionId: string,
    request: MessageRequest,
  ): Promise<APIResponse<any>> {
    try {
      // Process message with ElizaOS runtime
      const session = await this.sessionsService.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: "Session not found",
          timestamp: new Date().toISOString(),
        };
      }

      // Update session activity
      const activityUpdated = await this.sessionsService.updateSessionActivity(
        sessionId,
        {
          lastMessage: request.content,
          messageType: request.type || "text",
          metadata: request.metadata || {},
        },
      );

      if (!activityUpdated) {
        logger.warn(
          "[SESSIONS_API] Failed to update session activity, but continuing",
        );
      }

      // Create message memory (handle gracefully if not available)
      try {
        await this.runtime.createMemory(
          {
            id: crypto.randomUUID() as UUID,
            agentId: session.agentId,
            entityId: session.userId || session.agentId,
            roomId: session.roomId || (crypto.randomUUID() as UUID),
            content: {
              text: request.content,
              type: "user_message",
              sessionId: sessionId,
              metadata: request.metadata,
            },
            embedding: undefined,
            createdAt: Date.now(),
          },
          "memories",
          false,
        );
      } catch (memoryError) {
        logger.warn(
          "[SESSIONS_API] Failed to create memory, continuing:",
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
        );
      }

      // Generate response using ElizaOS (handle gracefully if not available)
      const responses: Memory[] = [];
      try {
        await this.runtime.processActions(
          {
            id: crypto.randomUUID() as UUID,
            agentId: session.agentId,
            entityId: session.userId || session.agentId,
            roomId: session.roomId || (crypto.randomUUID() as UUID),
            content: {
              text: request.content,
              type: request.type || "text",
            },
            embedding: undefined,
            createdAt: Date.now(),
          },
          responses,
          undefined,
        );
      } catch (processError) {
        logger.warn(
          "[SESSIONS_API] Failed to process actions, continuing:",
          processError instanceof Error
            ? processError.message
            : String(processError),
        );
      }

      const response = responses[0];

      return {
        success: true,
        data: {
          response: (response as any)?.text || "Message processed",
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to send message:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to send message",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * DELETE /api/sessions/:sessionId
   * Delete/expire session
   */
  async deleteSession(sessionId: string): Promise<APIResponse<boolean>> {
    try {
      // Set session to expired status (handled by service cleanup)
      const session = await this.sessionsService.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: "Session not found",
          timestamp: new Date().toISOString(),
        };
      }

      session.state.status = "expired";
      session.expiresAt = new Date(); // Immediate expiration

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to delete session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to delete session",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Raid Sessions API Methods
   */

  /**
   * POST /api/sessions/raids
   * Create a new raid session
   */
  async createRaidSession(
    request: RaidSessionCreateRequest,
  ): Promise<APIResponse<RaidSession>> {
    try {
      logger.info(`[SESSIONS_API] Creating raid session: ${request.raidId}`);

      // Validate required fields
      if (!request.agentId) {
        return {
          success: false,
          error: "agentId is required",
          timestamp: new Date().toISOString(),
        };
      }

      if (!request.raidId) {
        return {
          success: false,
          error: "raidId is required",
          timestamp: new Date().toISOString(),
        };
      }

      if (!request.targetUrl) {
        return {
          success: false,
          error: "targetUrl is required",
          timestamp: new Date().toISOString(),
        };
      }

      if (!request.duration || request.duration <= 0) {
        return {
          success: false,
          error: "duration is required and must be greater than 0",
          timestamp: new Date().toISOString(),
        };
      }

      if (!request.objectives || !Array.isArray(request.objectives)) {
        return {
          success: false,
          error: "objectives is required and must be an array",
          timestamp: new Date().toISOString(),
        };
      }

      // Validate objectives structure
      for (const objective of request.objectives) {
        if (
          !objective.type ||
          !objective.target ||
          typeof objective.count !== "number" ||
          typeof objective.points !== "number"
        ) {
          return {
            success: false,
            error:
              "Each objective must have type, target, count, and points fields",
            timestamp: new Date().toISOString(),
          };
        }
      }

      const config: RaidSessionConfig = {
        agentId: request.agentId,
        userId: request.userId,
        roomId: request.roomId,
        sessionType: "raid",
        timeout: request.duration * 1000, // Convert to milliseconds
        autoRenewal: false,
        metadata: request.metadata || {},
        raidId: request.raidId,
        targetUrl: request.targetUrl,
        objectives: request.objectives,
        maxParticipants: request.maxParticipants || 500,
        duration: request.duration,
      };

      const raidSession = await this.sessionsService.createRaidSession(config);

      return {
        success: true,
        data: raidSession,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to create raid session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to create raid session",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /api/sessions/:sessionId/join
   * Join a raid session
   */
  async joinRaidSession(
    sessionId: string,
    request: JoinRaidRequest,
  ): Promise<APIResponse<boolean>> {
    try {
      logger.info(
        `[SESSIONS_API] User ${request.telegramUsername} joining raid session: ${sessionId}`,
      );

      const success = await this.sessionsService.joinRaidSession(sessionId, {
        telegramId: request.telegramId,
        telegramUsername: request.telegramUsername,
        twitterUsername: request.twitterUsername,
      });

      if (!success) {
        return {
          success: false,
          error: "Failed to join raid session",
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to join raid session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to join raid session",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/sessions/raids/:raidId
   * Get raid session by raid ID
   */
  async getRaidSessionByRaidId(
    raidId: string,
  ): Promise<APIResponse<RaidSession | null>> {
    try {
      // This would require an index lookup - simplified for now
      const stats = await this.sessionsService.getSessionStats();

      // In a real implementation, you'd query by raid_id
      // For now, return a placeholder response
      return {
        success: true,
        data: null, // Would return the actual raid session
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to get raid session:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to get raid session",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/sessions/stats
   * Get session statistics
   */
  async getSessionStats(): Promise<APIResponse<any>> {
    try {
      const stats = await this.sessionsService.getSessionStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        "[SESSIONS_API] Failed to get session stats:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to get session stats",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Utility Methods
   */

  /**
   * Generate Express.js route handlers
   */
  generateExpressRoutes() {
    return {
      // Core sessions routes
      createSession: async (req: any, res: any) => {
        const result = await this.createSession(req.body);
        res.status(result.success ? 200 : 400).json(result);
      },

      getSession: async (req: any, res: any) => {
        const result = await this.getSession(req.params.sessionId);
        res.status(result.success ? 200 : 404).json(result);
      },

      sendMessage: async (req: any, res: any) => {
        const result = await this.sendMessage(req.params.sessionId, req.body);
        res.status(result.success ? 200 : 400).json(result);
      },

      deleteSession: async (req: any, res: any) => {
        const result = await this.deleteSession(req.params.sessionId);
        res.status(result.success ? 200 : 404).json(result);
      },

      // Raid sessions routes
      createRaidSession: async (req: any, res: any) => {
        const result = await this.createRaidSession(req.body);
        res.status(result.success ? 200 : 400).json(result);
      },

      joinRaidSession: async (req: any, res: any) => {
        const result = await this.joinRaidSession(
          req.params.sessionId,
          req.body,
        );
        res.status(result.success ? 200 : 400).json(result);
      },

      getRaidSession: async (req: any, res: any) => {
        const result = await this.getRaidSessionByRaidId(req.params.raidId);
        res.status(result.success ? 200 : 404).json(result);
      },

      // Stats route
      getStats: async (req: any, res: any) => {
        const result = await this.getSessionStats();
        res.status(result.success ? 200 : 500).json(result);
      },
    };
  }

  /**
   * Generate Socket.IO event handlers
   */
  generateSocketIOHandlers() {
    return {
      // Session management
      "session:create": async (
        data: SessionCreateRequest,
        callback: Function,
      ) => {
        const result = await this.createSession(data);
        callback(result);
      },

      "session:join": async (
        data: { sessionId: string },
        callback: Function,
      ) => {
        const result = await this.getSession(data.sessionId);
        callback(result);
      },

      "session:message": async (
        data: { sessionId: string } & MessageRequest,
        callback: Function,
      ) => {
        const result = await this.sendMessage(data.sessionId, data);
        callback(result);
      },

      // Raid sessions
      "raid:create": async (
        data: RaidSessionCreateRequest,
        callback: Function,
      ) => {
        const result = await this.createRaidSession(data);
        callback(result);
      },

      "raid:join": async (
        data: { sessionId: string } & JoinRaidRequest,
        callback: Function,
      ) => {
        const result = await this.joinRaidSession(data.sessionId, data);
        callback(result);
      },

      // Statistics
      "session:stats": async (callback: Function) => {
        const result = await this.getSessionStats();
        callback(result);
      },
    };
  }
}

export default SessionsAPI;
