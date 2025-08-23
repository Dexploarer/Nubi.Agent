import {
  Service,
  IAgentRuntime,
  logger,
  UUID,
} from "@elizaos/core";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer } from "http";
import { NUBISessionsService, Session, RaidSession } from "./nubi-sessions-service";
import { RaidSessionManager } from "./raid-session-manager";
import { SessionsAPI } from "../api/sessions-api";

/**
 * Socket.IO Sessions Service
 * 
 * Real-time WebSocket integration for NUBI Sessions API:
 * - Live session management via Socket.IO
 * - Real-time raid coordination and updates
 * - Multi-room session broadcasting
 * - Integration with ElizaOS Sessions architecture
 * - Session-aware message routing
 */

export interface SocketSessionData {
  sessionId?: string;
  userId?: UUID;
  agentId?: UUID;
  roomId?: UUID;
  raidId?: string;
  isAuthenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

export interface SessionMessage {
  type: 'message' | 'system' | 'raid_update' | 'session_event';
  content: string;
  sessionId: string;
  userId?: UUID;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RaidUpdate {
  raidId: string;
  sessionId: string;
  type: 'participant_joined' | 'action_completed' | 'progress_update' | 'raid_completed';
  data: any;
  timestamp: Date;
}

export class SocketIOSessionsService extends Service {
  static serviceType = "socketio_sessions" as const;
  capabilityDescription = "Real-time Socket.IO integration for ElizaOS Sessions";

  protected runtime: IAgentRuntime | undefined;
  private io: SocketIOServer;
  private server: any;
  private sessionsService: NUBISessionsService;
  private raidManager: RaidSessionManager;
  private sessionsAPI: SessionsAPI;
  private activeSockets: Map<string, SocketSessionData> = new Map();
  private sessionRooms: Map<string, Set<string>> = new Map(); // sessionId -> socketIds
  private raidRooms: Map<string, Set<string>> = new Map(); // raidId -> socketIds

  constructor(
    runtime?: IAgentRuntime,
    sessionsService?: NUBISessionsService,
    raidManager?: RaidSessionManager,
    port: number = 3001
  ) {
    super(runtime);
    if (runtime) {
      this.runtime = runtime;
    }
    if (sessionsService) {
      this.sessionsService = sessionsService;
    }
    if (raidManager) {
      this.raidManager = raidManager;
    }
    
    // Create HTTP server and Socket.IO instance
    this.server = createServer();
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*", // Configure appropriately for production
        methods: ["GET", "POST"]
      },
      path: "/socket.io/",
      transports: ["websocket", "polling"]
    });

    // Initialize Sessions API
    this.sessionsAPI = new SessionsAPI(runtime, sessionsService);

    // Set server port
    this.server.listen(port, () => {
      logger.info(`[SOCKETIO_SESSIONS] Socket.IO server listening on port ${port}`);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info("[SOCKETIO_SESSIONS] Starting Socket.IO Sessions Service...");

      // Set up Socket.IO event handlers
      this.setupSocketHandlers();

      // Start cleanup timer for inactive connections
      this.startConnectionCleanup();

      logger.info("[SOCKETIO_SESSIONS] Socket.IO Sessions Service started successfully");
    } catch (error) {
      logger.error("[SOCKETIO_SESSIONS] Failed to start:", error);
      throw error;
    }
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      logger.info(`[SOCKETIO_SESSIONS] Client connected: ${socket.id}`);

      // Initialize socket session data
      const socketData: SocketSessionData = {
        isAuthenticated: false,
        connectedAt: new Date(),
        lastActivity: new Date(),
      };
      this.activeSockets.set(socket.id, socketData);

      // Authentication handler
      socket.on("session:authenticate", async (data: {
        sessionId?: string;
        userId?: UUID;
        agentId?: UUID;
      }, callback) => {
        try {
          await this.authenticateSocket(socket, data);
          callback({ success: true, socketId: socket.id });
        } catch (error) {
          logger.error("[SOCKETIO_SESSIONS] Authentication failed:", error);
          callback({ success: false, error: error instanceof Error ? error.message : 'Authentication failed' });
        }
      });

      // Session management handlers
      socket.on("session:create", async (data, callback) => {
        const socketHandlers = this.sessionsAPI.generateSocketIOHandlers();
        await socketHandlers["session:create"](data, callback);
        
        // Join session room after creation
        if (callback && typeof callback === 'function' && data.success) {
          await this.joinSessionRoom(socket, data.data.id);
        }
      });

      socket.on("session:join", async (data: { sessionId: string }, callback) => {
        try {
          const session = await this.sessionsService.getSession(data.sessionId);
          if (session) {
            await this.joinSessionRoom(socket, data.sessionId);
            callback({ success: true, session });
          } else {
            callback({ success: false, error: "Session not found" });
          }
        } catch (error) {
          callback({ success: false, error: error instanceof Error ? error.message : 'Failed to join session' });
        }
      });

      socket.on("session:message", async (data: {
        sessionId: string;
        content: string;
        type?: string;
        metadata?: Record<string, any>;
      }, callback) => {
        try {
          // Send message through Sessions API
          const result = await this.sessionsAPI.sendMessage(data.sessionId, {
            content: data.content,
            type: data.type,
            metadata: data.metadata,
          });

          // Broadcast to session room
          const message: SessionMessage = {
            type: 'message',
            content: data.content,
            sessionId: data.sessionId,
            userId: this.activeSockets.get(socket.id)?.userId,
            metadata: data.metadata,
            timestamp: new Date(),
          };

          this.broadcastToSession(data.sessionId, "session:message", message, socket.id);
          
          callback(result);
        } catch (error) {
          callback({ success: false, error: error instanceof Error ? error.message : 'Failed to send message' });
        }
      });

      // Raid-specific handlers
      socket.on("raid:create", async (data, callback) => {
        const socketHandlers = this.sessionsAPI.generateSocketIOHandlers();
        await socketHandlers["raid:create"](data, async (result: any) => {
          if (result.success) {
            // Join raid room
            await this.joinRaidRoom(socket, result.data.raidId);
            
            // Start raid monitoring
            await this.raidManager.startRaidMonitoring(result.data);
            
            // Broadcast raid creation
            this.broadcastToRaid(result.data.raidId, "raid:created", {
              raidId: result.data.raidId,
              sessionId: result.data.id,
              targetUrl: result.data.targetUrl,
              objectives: result.data.objectives,
              timestamp: new Date(),
            });
          }
          callback(result);
        });
      });

      socket.on("raid:join", async (data: {
        sessionId: string;
        telegramId: string;
        telegramUsername: string;
        twitterUsername?: string;
      }, callback) => {
        try {
          const success = await this.sessionsService.joinRaidSession(data.sessionId, {
            telegramId: data.telegramId,
            telegramUsername: data.telegramUsername,
            twitterUsername: data.twitterUsername,
          });

          if (success) {
            const session = await this.sessionsService.getSession(data.sessionId) as RaidSession;
            if (session && session.raidId) {
              await this.joinRaidRoom(socket, session.raidId);
              
              // Broadcast participant joined
              const update: RaidUpdate = {
                raidId: session.raidId,
                sessionId: data.sessionId,
                type: 'participant_joined',
                data: {
                  telegramUsername: data.telegramUsername,
                  twitterUsername: data.twitterUsername,
                },
                timestamp: new Date(),
              };

              this.broadcastToRaid(session.raidId, "raid:update", update);
            }
          }

          callback({ success, sessionId: data.sessionId });
        } catch (error) {
          callback({ success: false, error: error instanceof Error ? error.message : 'Failed to join raid' });
        }
      });

      socket.on("raid:action", async (data: {
        raidId: string;
        sessionId: string;
        actionType: string;
        targetId: string;
        points: number;
      }, callback) => {
        try {
          const socketData = this.activeSockets.get(socket.id);
          if (!socketData || !socketData.userId) {
            callback({ success: false, error: "Authentication required" });
            return;
          }

          // Record action through raid manager
          const success = await this.raidManager.recordRaidAction(data.raidId, data.sessionId, {
            participantId: socketData.userId,
            actionType: data.actionType as any,
            targetId: data.targetId,
            points: data.points,
          });

          if (success) {
            // Broadcast action update
            const update: RaidUpdate = {
              raidId: data.raidId,
              sessionId: data.sessionId,
              type: 'action_completed',
              data: {
                participantId: socketData.userId,
                actionType: data.actionType,
                points: data.points,
              },
              timestamp: new Date(),
            };

            this.broadcastToRaid(data.raidId, "raid:update", update);
          }

          callback({ success });
        } catch (error) {
          callback({ success: false, error: error instanceof Error ? error.message : 'Failed to record action' });
        }
      });

      // Activity tracking
      socket.on("session:activity", async (data: { sessionId: string, activity: any }) => {
        try {
          await this.sessionsService.updateSessionActivity(data.sessionId, data.activity);
          this.updateSocketActivity(socket.id);
        } catch (error) {
          logger.error("[SOCKETIO_SESSIONS] Failed to update activity:", error);
        }
      });

      // Disconnect handler
      socket.on("disconnect", (reason) => {
        logger.info(`[SOCKETIO_SESSIONS] Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleSocketDisconnect(socket.id);
      });

      // Error handler
      socket.on("error", (error) => {
        logger.error(`[SOCKETIO_SESSIONS] Socket error for ${socket.id}:`, error);
      });
    });
  }

  private async authenticateSocket(socket: Socket, data: {
    sessionId?: string;
    userId?: UUID;
    agentId?: UUID;
  }): Promise<void> {
    const socketData = this.activeSockets.get(socket.id);
    if (!socketData) throw new Error("Socket not found");

    // Validate session if provided
    if (data.sessionId) {
      const session = await this.sessionsService.getSession(data.sessionId);
      if (!session) {
        throw new Error("Invalid session ID");
      }
      socketData.sessionId = data.sessionId;
      socketData.roomId = session.roomId;
    }

    // Set user and agent IDs
    socketData.userId = data.userId || socketData.userId;
    socketData.agentId = data.agentId || socketData.agentId;
    socketData.isAuthenticated = true;
    socketData.lastActivity = new Date();

    this.activeSockets.set(socket.id, socketData);

    logger.info(`[SOCKETIO_SESSIONS] Socket authenticated: ${socket.id}`);
  }

  private async joinSessionRoom(socket: Socket, sessionId: string): Promise<void> {
    const roomName = `session:${sessionId}`;
    socket.join(roomName);

    // Track session room membership
    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }
    this.sessionRooms.get(sessionId)!.add(socket.id);

    // Update socket data
    const socketData = this.activeSockets.get(socket.id);
    if (socketData) {
      socketData.sessionId = sessionId;
      this.activeSockets.set(socket.id, socketData);
    }

    logger.debug(`[SOCKETIO_SESSIONS] Socket ${socket.id} joined session room: ${sessionId}`);
  }

  private async joinRaidRoom(socket: Socket, raidId: string): Promise<void> {
    const roomName = `raid:${raidId}`;
    socket.join(roomName);

    // Track raid room membership
    if (!this.raidRooms.has(raidId)) {
      this.raidRooms.set(raidId, new Set());
    }
    this.raidRooms.get(raidId)!.add(socket.id);

    // Update socket data
    const socketData = this.activeSockets.get(socket.id);
    if (socketData) {
      socketData.raidId = raidId;
      this.activeSockets.set(socket.id, socketData);
    }

    logger.debug(`[SOCKETIO_SESSIONS] Socket ${socket.id} joined raid room: ${raidId}`);
  }

  private broadcastToSession(sessionId: string, event: string, data: any, excludeSocketId?: string): void {
    const roomName = `session:${sessionId}`;
    if (excludeSocketId) {
      this.io.to(roomName).except(excludeSocketId).emit(event, data);
    } else {
      this.io.to(roomName).emit(event, data);
    }
  }

  private broadcastToRaid(raidId: string, event: string, data: any, excludeSocketId?: string): void {
    const roomName = `raid:${raidId}`;
    if (excludeSocketId) {
      this.io.to(roomName).except(excludeSocketId).emit(event, data);
    } else {
      this.io.to(roomName).emit(event, data);
    }
  }

  private updateSocketActivity(socketId: string): void {
    const socketData = this.activeSockets.get(socketId);
    if (socketData) {
      socketData.lastActivity = new Date();
      this.activeSockets.set(socketId, socketData);
    }
  }

  private handleSocketDisconnect(socketId: string): void {
    const socketData = this.activeSockets.get(socketId);
    
    // Remove from session room
    if (socketData?.sessionId) {
      const sessionSockets = this.sessionRooms.get(socketData.sessionId);
      if (sessionSockets) {
        sessionSockets.delete(socketId);
        if (sessionSockets.size === 0) {
          this.sessionRooms.delete(socketData.sessionId);
        }
      }
    }

    // Remove from raid room
    if (socketData?.raidId) {
      const raidSockets = this.raidRooms.get(socketData.raidId);
      if (raidSockets) {
        raidSockets.delete(socketId);
        if (raidSockets.size === 0) {
          this.raidRooms.delete(socketData.raidId);
        }
      }
    }

    // Remove from active sockets
    this.activeSockets.delete(socketId);
  }

  private startConnectionCleanup(): void {
    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      const now = new Date();
      const staleThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [socketId, socketData] of this.activeSockets) {
        if (now.getTime() - socketData.lastActivity.getTime() > staleThreshold) {
          logger.info(`[SOCKETIO_SESSIONS] Cleaning up stale connection: ${socketId}`);
          this.handleSocketDisconnect(socketId);
          
          // Disconnect the socket
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
    }, 300000); // 5 minutes
  }

  /**
   * Public methods for external integration
   */

  /**
   * Broadcast raid update to all participants
   */
  async broadcastRaidUpdate(raidId: string, update: RaidUpdate): Promise<void> {
    this.broadcastToRaid(raidId, "raid:update", update);
  }

  /**
   * Send session event to specific session
   */
  async sendSessionEvent(sessionId: string, event: string, data: any): Promise<void> {
    this.broadcastToSession(sessionId, event, data);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    sessionsActive: number;
    raidsActive: number;
  } {
    const authenticated = Array.from(this.activeSockets.values())
      .filter(s => s.isAuthenticated).length;

    return {
      totalConnections: this.activeSockets.size,
      authenticatedConnections: authenticated,
      sessionsActive: this.sessionRooms.size,
      raidsActive: this.raidRooms.size,
    };
  }

  async stop(): Promise<void> {
    // Close all socket connections
    this.io.close();
    
    // Close HTTP server
    this.server.close();

    // Clear data structures
    this.activeSockets.clear();
    this.sessionRooms.clear();
    this.raidRooms.clear();

    logger.info("[SOCKETIO_SESSIONS] Socket.IO Sessions Service stopped");
  }
}

export default SocketIOSessionsService;