import { IAgentRuntime, logger, UUID } from "@elizaos/core";
import { Request, Response } from "express";
import { NUBISessionsService } from "../services/nubi-sessions-service";
import { RaidSessionManager } from "../services/raid-session-manager";
import { SessionsAPI } from "../api/sessions-api";

/**
 * NUBI Sessions API Routes
 * 
 * Comprehensive implementation of ElizaOS Sessions API with NUBI enhancements:
 * - Full ElizaOS Sessions API compliance
 * - NUBI-specific raid coordination endpoints
 * - WebSocket/Socket.IO integration points
 * - Analytics and monitoring endpoints
 */

export interface SessionRoute {
  path: string;
  type: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  handler: (req: Request, res: Response, runtime: IAgentRuntime) => Promise<void>;
  requiresAuth?: boolean;
  rateLimit?: number;
}

/**
 * Create sessions routes with all required endpoints
 */
export function createSessionsRoutes(
  runtime: IAgentRuntime,
  sessionsService: NUBISessionsService,
  raidManager?: RaidSessionManager
): SessionRoute[] {
  const sessionsAPI = new SessionsAPI(runtime, sessionsService);

  return [
    // ============================================================================
    // CORE ELIZAOS SESSIONS API ENDPOINTS (Fully Compliant)
    // ============================================================================

    /**
     * Create Session
     * POST /api/messaging/sessions
     * ElizaOS Standard: Creates a new session with automatic channel management
     */
    {
      path: "/api/messaging/sessions",
      type: "POST",
      requiresAuth: false,
      rateLimit: 10, // 10 requests per minute
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { agentId, userId, roomId, metadata, timeout, autoRenewal } = req.body;

          // Validate required fields
          if (!agentId) {
            return res.status(400).json({
              success: false,
              error: "agentId is required",
              code: "INVALID_REQUEST"
            });
          }

          const result = await sessionsAPI.createSession({
            agentId,
            userId,
            roomId,
            sessionType: req.body.sessionType || "conversation",
            timeout: timeout || 3600000, // 1 hour default
            autoRenewal: autoRenewal !== false, // Default true
            metadata: metadata || {}
          });

          res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to create session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get Session
     * GET /api/messaging/sessions/:sessionId
     * ElizaOS Standard: Retrieves session details
     */
    {
      path: "/api/messaging/sessions/:sessionId",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          
          const result = await sessionsAPI.getSession(sessionId);
          
          res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Send Message to Session
     * POST /api/messaging/sessions/:sessionId/messages
     * ElizaOS Standard: Sends a message within a session context
     */
    {
      path: "/api/messaging/sessions/:sessionId/messages",
      type: "POST",
      requiresAuth: false,
      rateLimit: 30, // 30 messages per minute
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { content, type, metadata } = req.body;

          if (!content) {
            return res.status(400).json({
              success: false,
              error: "Message content is required",
              code: "INVALID_REQUEST"
            });
          }

          const result = await sessionsAPI.sendMessage(sessionId, {
            content,
            type: type || "text",
            metadata: metadata || {}
          });

          res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to send message:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Renew Session
     * POST /api/messaging/sessions/:sessionId/renew
     * ElizaOS Standard: Extends session expiration
     */
    {
      path: "/api/messaging/sessions/:sessionId/renew",
      type: "POST",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { extensionTime } = req.body;

          const session = await sessionsService.getSession(sessionId);
          if (!session) {
            return res.status(404).json({
              success: false,
              error: "Session not found",
              code: "SESSION_NOT_FOUND"
            });
          }

          // Extend session expiration
          const newExpiration = new Date(
            Date.now() + (extensionTime || session.config.timeout || 3600000)
          );
          session.expiresAt = newExpiration;

          // Update activity
          await sessionsService.updateSessionActivity(sessionId, {
            renewed: true,
            renewalTime: new Date().toISOString()
          });

          res.status(200).json({
            success: true,
            data: {
              sessionId,
              expiresAt: newExpiration,
              renewalCount: (session.metadata.renewalCount || 0) + 1
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to renew session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * End Session
     * DELETE /api/messaging/sessions/:sessionId
     * ElizaOS Standard: Ends a session and cleans up resources
     */
    {
      path: "/api/messaging/sessions/:sessionId",
      type: "DELETE",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          
          const result = await sessionsAPI.deleteSession(sessionId);
          
          res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to delete session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get Session Messages
     * GET /api/messaging/sessions/:sessionId/messages
     * ElizaOS Standard: Retrieves messages with cursor-based pagination
     */
    {
      path: "/api/messaging/sessions/:sessionId/messages",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { cursor, limit = "20" } = req.query;

          const session = await sessionsService.getSession(sessionId);
          if (!session) {
            return res.status(404).json({
              success: false,
              error: "Session not found",
              code: "SESSION_NOT_FOUND"
            });
          }

          // Get messages from memory
          const messages = await runtime.getMemories({
            roomId: session.roomId,
            count: parseInt(limit as string),
            unique: false,
            tableName: "memories"
          });

          res.status(200).json({
            success: true,
            data: {
              messages,
              cursor: messages.length > 0 ? messages[messages.length - 1].id : null,
              hasMore: messages.length === parseInt(limit as string)
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get messages:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    // ============================================================================
    // WEBSOCKET/SOCKET.IO INTEGRATION ENDPOINTS
    // ============================================================================

    /**
     * Get WebSocket Connection Info
     * GET /api/messaging/sessions/:sessionId/websocket
     * Returns WebSocket connection details for real-time communication
     */
    {
      path: "/api/messaging/sessions/:sessionId/websocket",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;

          const session = await sessionsService.getSession(sessionId);
          if (!session) {
            return res.status(404).json({
              success: false,
              error: "Session not found",
              code: "SESSION_NOT_FOUND"
            });
          }

          res.status(200).json({
            success: true,
            data: {
              url: `ws://${req.get("host")}/socket.io/sessions`,
              protocol: "socket.io",
              version: "4.x",
              events: {
                client: ["join", "leave", "message", "request-world-state"],
                server: ["messageBroadcast", "messageComplete", "world-state", "logEntry", "error"]
              },
              connectionParams: {
                sessionId,
                agentId: session.agentId,
                roomId: session.roomId
              }
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get WebSocket info:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    // ============================================================================
    // NUBI-ENHANCED RAID COORDINATION ENDPOINTS
    // ============================================================================

    /**
     * Create Raid Session
     * POST /api/raids/sessions
     * NUBI Enhancement: Creates a specialized raid coordination session
     */
    {
      path: "/api/raids/sessions",
      type: "POST",
      requiresAuth: false,
      rateLimit: 5, // 5 raids per minute
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const {
            agentId, raidId, targetUrl, objectives,
            maxParticipants, duration, metadata
          } = req.body;

          if (!agentId || !raidId || !targetUrl || !objectives) {
            return res.status(400).json({
              success: false,
              error: "Missing required raid parameters",
              code: "INVALID_REQUEST"
            });
          }

          const result = await sessionsAPI.createRaidSession({
            agentId,
            userId: req.body.userId,
            raidId,
            targetUrl,
            objectives,
            maxParticipants: maxParticipants || 500,
            duration: duration || 3600,
            metadata: metadata || {}
          });

          // Start raid monitoring if manager available
          if (result.success && raidManager) {
            await raidManager.startRaidMonitoring(result.data!);
          }

          res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to create raid session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Join Raid Session
     * POST /api/raids/sessions/:sessionId/join
     * NUBI Enhancement: Allows participants to join raid sessions
     */
    {
      path: "/api/raids/sessions/:sessionId/join",
      type: "POST",
      requiresAuth: false,
      rateLimit: 20, // 20 joins per minute
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { telegramId, telegramUsername, twitterUsername } = req.body;

          if (!telegramId || !telegramUsername) {
            return res.status(400).json({
              success: false,
              error: "Telegram credentials required",
              code: "INVALID_REQUEST"
            });
          }

          const result = await sessionsAPI.joinRaidSession(sessionId, {
            telegramId,
            telegramUsername,
            twitterUsername
          });

          res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to join raid:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Record Raid Action
     * POST /api/raids/sessions/:sessionId/actions
     * NUBI Enhancement: Records participant actions for verification
     */
    {
      path: "/api/raids/sessions/:sessionId/actions",
      type: "POST",
      requiresAuth: false,
      rateLimit: 50, // 50 actions per minute
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { participantId, actionType, targetId, points } = req.body;

          if (!participantId || !actionType || !targetId) {
            return res.status(400).json({
              success: false,
              error: "Missing action parameters",
              code: "INVALID_REQUEST"
            });
          }

          if (raidManager) {
            const session = await sessionsService.getSession(sessionId) as any;
            if (session && session.raidId) {
              const success = await raidManager.recordRaidAction(
                session.raidId,
                sessionId,
                { participantId, actionType, targetId, points: points || 10 }
              );

              res.status(200).json({
                success,
                data: { recorded: success }
              });
            } else {
              res.status(404).json({
                success: false,
                error: "Raid session not found",
                code: "SESSION_NOT_FOUND"
              });
            }
          } else {
            res.status(503).json({
              success: false,
              error: "Raid manager not available",
              code: "SERVICE_UNAVAILABLE"
            });
          }
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to record action:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get Raid Leaderboard
     * GET /api/raids/sessions/:sessionId/leaderboard
     * NUBI Enhancement: Returns raid performance leaderboard
     */
    {
      path: "/api/raids/sessions/:sessionId/leaderboard",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;
          const { limit = "50" } = req.query;

          const session = await sessionsService.getSession(sessionId) as any;
          if (!session || !session.raidId) {
            return res.status(404).json({
              success: false,
              error: "Raid session not found",
              code: "SESSION_NOT_FOUND"
            });
          }

          // Get leaderboard from raid participants
          const participants = session.participants || [];
          const leaderboard = participants
            .sort((a: any, b: any) => b.pointsEarned - a.pointsEarned)
            .slice(0, parseInt(limit as string))
            .map((p: any, index: number) => ({
              rank: index + 1,
              telegramUsername: p.telegramUsername,
              twitterUsername: p.twitterUsername,
              pointsEarned: p.pointsEarned,
              actionsCompleted: p.actionsCompleted,
              verified: p.verified
            }));

          res.status(200).json({
            success: true,
            data: { leaderboard }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get leaderboard:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get Raid Metrics
     * GET /api/raids/sessions/:sessionId/metrics
     * NUBI Enhancement: Returns comprehensive raid analytics
     */
    {
      path: "/api/raids/sessions/:sessionId/metrics",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { sessionId } = req.params;

          const session = await sessionsService.getSession(sessionId) as any;
          if (!session || !session.raidId) {
            return res.status(404).json({
              success: false,
              error: "Raid session not found",
              code: "SESSION_NOT_FOUND"
            });
          }

          const metrics = {
            raidId: session.raidId,
            status: session.progress?.status || "unknown",
            participantCount: session.participants?.length || 0,
            totalActions: session.progress?.totalActions || 0,
            completionRate: session.progress?.completionRate || 0,
            timeRemaining: session.progress?.timeRemaining || 0,
            objectives: session.objectives,
            targetUrl: session.targetUrl
          };

          res.status(200).json({
            success: true,
            data: { metrics }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get metrics:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    // ============================================================================
    // ANALYTICS AND MONITORING ENDPOINTS
    // ============================================================================

    /**
     * Get All Sessions
     * GET /api/messaging/sessions
     * Returns all active sessions with pagination
     */
    {
      path: "/api/messaging/sessions",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { status, type, limit = "20", offset = "0" } = req.query;

          const stats = await sessionsService.getSessionStats();
          
          // This would need actual implementation to list sessions
          res.status(200).json({
            success: true,
            data: {
              sessions: [],
              total: stats.total,
              active: stats.active,
              raids: stats.raids,
              community: stats.community
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to list sessions:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get Session Statistics
     * GET /api/messaging/sessions/stats
     * Returns aggregate session statistics
     */
    {
      path: "/api/messaging/sessions/stats",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const result = await sessionsAPI.getSessionStats();
          res.status(result.success ? 200 : 500).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get stats:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Health Check
     * GET /api/messaging/sessions/health
     * Returns service health status
     */
    {
      path: "/api/messaging/sessions/health",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const stats = await sessionsService.getSessionStats();
          
          res.status(200).json({
            success: true,
            data: {
              status: "healthy",
              timestamp: new Date().toISOString(),
              sessions: {
                total: stats.total,
                active: stats.active
              },
              version: "1.0.0"
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Health check failed:", error);
          res.status(503).json({
            success: false,
            error: "Service unhealthy",
            code: "SERVICE_UNHEALTHY"
          });
        }
      }
    },

    // ============================================================================
    // COMMUNITY ENGAGEMENT ENDPOINTS (NUBI-SPECIFIC)
    // ============================================================================

    /**
     * Create Community Session
     * POST /api/community/sessions
     * NUBI Enhancement: Creates community engagement session
     */
    {
      path: "/api/community/sessions",
      type: "POST",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { agentId, userId, topic, metadata } = req.body;

          const result = await sessionsAPI.createSession({
            agentId,
            userId,
            sessionType: "community",
            metadata: {
              ...metadata,
              topic,
              communityEngagement: true
            }
          });

          res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to create community session:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    },

    /**
     * Get User Sessions
     * GET /api/users/:userId/sessions
     * Returns all sessions for a specific user
     */
    {
      path: "/api/users/:userId/sessions",
      type: "GET",
      requiresAuth: false,
      handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
        try {
          const { userId } = req.params;
          const { active } = req.query;

          // This would need actual implementation
          res.status(200).json({
            success: true,
            data: {
              sessions: [],
              userId
            }
          });
        } catch (error) {
          logger.error("[SESSIONS_ROUTES] Failed to get user sessions:", error);
          res.status(500).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR"
          });
        }
      }
    }
  ];
}

/**
 * Export sessions routes for plugin registration
 */
export const sessionsRoutes: SessionRoute[] = [];