import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { Server, Socket as SocketIOSocket } from "socket.io";
import { createServer } from "http";
import * as cors from "cors";
import { SocketIOAnalyticsService } from "./socket-io-analytics";
import {
  MessageRouter,
  MessageClassification,
  PromptType,
} from "./message-router";
import { pipelineAnalytics } from "./clickhouse-pipeline-analytics";
import * as crypto from "crypto";

export interface SocketMessage {
  senderId: string;
  senderName: string;
  message: string;
  roomId: string;
  messageId: string;
  source: "telegram" | "discord" | "websocket" | "api";
  platform?: "telegram" | "discord" | "websocket";
  attachments?: any[];
  metadata?: any;
  timestamp: number;
}

export interface WorldState {
  rooms: Record<
    string,
    {
      id: string;
      name: string;
      participants: string[];
      messages: SocketMessage[];
    }
  >;
  users: Record<
    string,
    {
      id: string;
      name: string;
      rooms: string[];
      status: "online" | "offline";
    }
  >;
}

export class SocketIOServerService extends Service {
  static serviceType = "socket-io-server";
  private server?: Server;
  private httpServer?: any;
  private port: number;
  private worldState: WorldState;
  private analyticsService?: SocketIOAnalyticsService;
  private messageRouter: MessageRouter;
  protected runtime: IAgentRuntime;

  // Configurable preprocessing pipeline settings
  private preprocessingConfig = {
    enabled: process.env.SOCKET_PREPROCESSING_ENABLED !== "false",
    contentFiltering: process.env.SOCKET_CONTENT_FILTERING !== "false",
    rateLimiting: process.env.SOCKET_RATE_LIMITING !== "false",
    messageEnrichment: process.env.SOCKET_MESSAGE_ENRICHMENT !== "false",
    securityChecks: process.env.SOCKET_SECURITY_CHECKS !== "false",
    engagementProcessing: process.env.SOCKET_ENGAGEMENT_PROCESSING !== "false",
    crossPlatformIdentity:
      process.env.SOCKET_CROSS_PLATFORM_IDENTITY !== "false",
  };

  // Sessions API integration for streaming responses
  private activeSessions = new Map<
    string,
    {
      sessionId: string;
      roomId: string;
      userId: string;
      isStreaming: boolean;
      lastActivity: number;
      composeState?: any;
    }
  >();

  // User session management for cross-platform identity
  private userSessions = new Map<
    string,
    {
      userId: string;
      platforms: Set<string>;
      lastSeen: number;
      metadata: any;
    }
  >();

  get capabilityDescription(): string {
    return "Real-time WebSocket server for bidirectional communication with clients";
  }

  constructor(runtime?: IAgentRuntime) {
    super();
    if (!runtime) {
      throw new Error("Runtime is required for SocketIOServerService");
    }
    this.runtime = runtime;
    this.port = parseInt(process.env.SOCKET_PORT || "3001", 10);
    this.worldState = {
      rooms: {},
      users: {},
    };
    this.messageRouter = new MessageRouter();
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;

    try {
      // Get analytics service if available
      this.analyticsService =
        runtime.getService<SocketIOAnalyticsService>("socket-io-analytics") ||
        undefined;
      if (this.analyticsService) {
        logger.info("🔌 Socket.IO server connected to analytics service");
      }

      // Initialize message router
      logger.info("🔌 Socket.IO server initialized message router");

      // Create HTTP server
      this.httpServer = createServer();

      // Initialize Socket.IO server
      this.server = new Server(this.httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
          credentials: true,
        },
        transports: ["polling", "websocket"],
      });

      this.setupEventHandlers();

      // Start session cleanup
      this.startSessionCleanup();

      // Start server
      this.httpServer.listen(this.port, () => {
        logger.info(`🔌 Socket.IO server started on port ${this.port}`);
        logger.info(
          `🔄 Session cleanup enabled (timeout: ${process.env.SOCKET_SESSION_TIMEOUT || "1800000"}ms)`,
        );
      });
    } catch (error) {
      logger.error(
        "Failed to initialize Socket.IO server:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.server) return;

    this.server.on("connection", (socket: SocketIOSocket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Track connection in analytics
      if (this.analyticsService) {
        this.analyticsService.trackConnection(socket.id);
      }

      // Handle room joining
      socket.on(
        "join",
        (data: { roomId: string; userId: string; userName: string }) => {
          try {
            const { roomId, userId, userName } = data;

            // Join socket room
            socket.join(roomId);

            // Update world state
            this.updateUserState(userId, userName, roomId, "online");
            this.updateRoomState(roomId, userId);

            // Track room join in analytics
            if (this.analyticsService) {
              this.analyticsService.trackRoomJoin(userId, roomId);
            }

            // Broadcast join event
            socket.to(roomId).emit("userJoined", {
              userId,
              userName,
              roomId,
              timestamp: Date.now(),
            });

            logger.info(`User ${userName} joined room ${roomId}`);
          } catch (error) {
            logger.error(
              "Error handling join:",
              error instanceof Error ? error.message : String(error),
            );
            socket.emit("error", { message: "Failed to join room" });
          }
        },
      );

      // Handle room leaving
      socket.on("leave", (data: { roomId: string; userId: string }) => {
        try {
          const { roomId, userId } = data;

          socket.leave(roomId);
          this.removeUserFromRoom(userId, roomId);

          // Track room leave in analytics
          if (this.analyticsService) {
            this.analyticsService.trackRoomLeave(userId, roomId);
          }

          socket.to(roomId).emit("userLeft", {
            userId,
            roomId,
            timestamp: Date.now(),
          });

          logger.info(`User ${userId} left room ${roomId}`);
        } catch (error) {
          logger.error(
            "Error handling leave:",
            error instanceof Error ? error.message : String(error),
          );
          socket.emit("error", { message: "Failed to leave room" });
        }
      });

      // Handle message sending
      socket.on("message", async (message: SocketMessage) => {
        try {
          // Validate message
          if (!message.roomId || !message.senderId || !message.message) {
            socket.emit("error", { message: "Invalid message format" });
            return;
          }

          // Add timestamp and generate ID if not present
          const processedMessage: SocketMessage = {
            ...message,
            messageId:
              message.messageId ||
              `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          };

          // Store message in world state
          this.storeMessage(processedMessage);

          // Track message in analytics
          if (this.analyticsService) {
            this.analyticsService.trackMessage(processedMessage);
          }

          // Pre-ElizaOS Processing Pipeline
          const shouldProcess = await this.preprocessMessage(processedMessage);

          // Broadcast to room (always broadcast for real-time chat)
          this.server!.to(message.roomId).emit(
            "messageBroadcast",
            processedMessage,
          );

          // Only forward to ElizaOS if pre-processing allows it
          if (shouldProcess) {
            // This is where ElizaOS would pick up the message
            logger.debug(
              `Message approved for ElizaOS processing: ${processedMessage.messageId}`,
            );
          } else {
            logger.debug(
              `Message filtered out before ElizaOS: ${processedMessage.messageId}`,
            );
          }

          // Send completion confirmation to sender
          socket.emit("messageComplete", {
            messageId: processedMessage.messageId,
            timestamp: processedMessage.timestamp,
          });

          logger.debug(
            `Message broadcast in room ${message.roomId}: ${message.message.substring(0, 50)}...`,
          );
        } catch (error) {
          logger.error(
            "Error handling message:",
            error instanceof Error ? error.message : String(error),
          );
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Handle world state requests
      socket.on("request-world-state", (data: { roomId?: string }) => {
        try {
          if (data.roomId) {
            // Send specific room state
            const roomState = this.worldState.rooms[data.roomId];
            socket.emit("world-state", { room: roomState });
          } else {
            // Send full world state
            socket.emit("world-state", this.worldState);
          }
        } catch (error) {
          logger.error(
            "Error sending world state:",
            error instanceof Error ? error.message : String(error),
          );
          socket.emit("error", { message: "Failed to get world state" });
        }
      });

      // Sessions API Integration for streaming responses
      socket.on(
        "start-session",
        async (data: { sessionId: string; userId: string; roomId: string }) => {
          try {
            const { sessionId, userId, roomId } = data;

            // Create or update session
            this.activeSessions.set(sessionId, {
              sessionId,
              roomId,
              userId,
              isStreaming: false,
              lastActivity: Date.now(),
            });

            // Join the session room
            socket.join(`session_${sessionId}`);

            logger.info(
              `Session ${sessionId} started for user ${userId} in room ${roomId}`,
            );

            // Notify session started
            socket.emit("session-started", {
              sessionId,
              timestamp: Date.now(),
            });
          } catch (error) {
            logger.error(
              "Error starting session:",
              error instanceof Error ? error.message : String(error),
            );
            socket.emit("error", { message: "Failed to start session" });
          }
        },
      );

      socket.on(
        "start-streaming",
        async (data: { sessionId: string; prompt?: string }) => {
          try {
            const { sessionId, prompt } = data;
            const session = this.activeSessions.get(sessionId);

            if (!session) {
              socket.emit("error", { message: "Session not found" });
              return;
            }

            // Mark session as streaming
            session.isStreaming = true;
            session.lastActivity = Date.now();

            // Compose state for streaming response
            if (this.runtime && prompt) {
              try {
                // Use ElizaOS composeState for context building
                const composeState = await this.runtime.composeState({
                  userId: session.userId,
                  roomId: session.roomId,
                  agentId: this.runtime.agentId,
                  content: { text: prompt },
                } as any);

                session.composeState = composeState;

                logger.debug(
                  `Compose state created for session ${sessionId}:`,
                  JSON.stringify(composeState),
                );
              } catch (error) {
                logger.warn(
                  "Failed to compose state:",
                  error instanceof Error ? error.message : String(error),
                );
              }
            }

            // Notify streaming started
            socket.emit("streaming-started", {
              sessionId,
              timestamp: Date.now(),
            });
            this.server!.to(`session_${sessionId}`).emit("streaming-started", {
              sessionId,
              timestamp: Date.now(),
            });

            logger.info(`Streaming started for session ${sessionId}`);
          } catch (error) {
            logger.error(
              "Error starting streaming:",
              error instanceof Error ? error.message : String(error),
            );
            socket.emit("error", { message: "Failed to start streaming" });
          }
        },
      );

      socket.on(
        "stream-chunk",
        (data: { sessionId: string; chunk: string; isComplete?: boolean }) => {
          try {
            const { sessionId, chunk, isComplete = false } = data;
            const session = this.activeSessions.get(sessionId);

            if (!session || !session.isStreaming) {
              socket.emit("error", { message: "Invalid streaming session" });
              return;
            }

            session.lastActivity = Date.now();

            // Broadcast stream chunk to session participants
            this.server!.to(`session_${sessionId}`).emit("stream-chunk", {
              sessionId,
              chunk,
              timestamp: Date.now(),
              isComplete,
            });

            if (isComplete) {
              session.isStreaming = false;
              this.server!.to(`session_${sessionId}`).emit(
                "streaming-complete",
                {
                  sessionId,
                  timestamp: Date.now(),
                },
              );
              logger.info(`Streaming completed for session ${sessionId}`);
            }
          } catch (error) {
            logger.error(
              "Error handling stream chunk:",
              error instanceof Error ? error.message : String(error),
            );
            socket.emit("error", { message: "Failed to handle stream chunk" });
          }
        },
      );

      socket.on("end-session", (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;
          const session = this.activeSessions.get(sessionId);

          if (session) {
            // Leave session room
            socket.leave(`session_${sessionId}`);

            // Remove session
            this.activeSessions.delete(sessionId);

            // Notify session ended
            this.server!.to(`session_${sessionId}`).emit("session-ended", {
              sessionId,
              timestamp: Date.now(),
            });

            logger.info(`Session ${sessionId} ended`);
          }
        } catch (error) {
          logger.error(
            "Error ending session:",
            error instanceof Error ? error.message : String(error),
          );
          socket.emit("error", { message: "Failed to end session" });
        }
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);

        // Track disconnection in analytics
        if (this.analyticsService) {
          this.analyticsService.trackDisconnection(socket.id);
        }

        // Clean up active sessions for this socket
        for (const [sessionId, session] of Array.from(
          this.activeSessions.entries(),
        )) {
          // Remove sessions that were associated with this socket
          // Note: In a real implementation, you'd track socket.id to session mapping
          if (session.lastActivity < Date.now() - 300000) {
            // 5 minutes timeout
            this.activeSessions.delete(sessionId);
            this.server!.to(`session_${sessionId}`).emit("session-ended", {
              sessionId,
              reason: "disconnect",
              timestamp: Date.now(),
            });
            logger.info(`Session ${sessionId} ended due to disconnect`);
          }
        }

        // Update user status to offline
        this.updateUserStatus(socket.id, "offline");
      });

      // Handle connection errors
      socket.on("error", (error) => {
        logger.error(
          `Socket error for ${socket.id}:`,
          error instanceof Error ? error.message : String(error),
        );

        // Track error in analytics
        if (this.analyticsService) {
          this.analyticsService.trackError(error);
        }
      });
    });

    this.server.on("error", (error) => {
      logger.error(
        "Socket.IO server error:",
        error instanceof Error ? error.message : String(error),
      );

      // Track server error in analytics
      if (this.analyticsService) {
        this.analyticsService.trackError(error);
      }
    });
  }

  private updateUserState(
    userId: string,
    userName: string,
    roomId: string,
    status: "online" | "offline",
  ): void {
    if (!this.worldState.users[userId]) {
      this.worldState.users[userId] = {
        id: userId,
        name: userName,
        rooms: [],
        status,
      };
    }

    this.worldState.users[userId].status = status;

    if (!this.worldState.users[userId].rooms.includes(roomId)) {
      this.worldState.users[userId].rooms.push(roomId);
    }
  }

  private updateRoomState(roomId: string, userId: string): void {
    if (!this.worldState.rooms[roomId]) {
      this.worldState.rooms[roomId] = {
        id: roomId,
        name: roomId, // Could be enhanced with actual room names
        participants: [],
        messages: [],
      };
    }

    if (!this.worldState.rooms[roomId].participants.includes(userId)) {
      this.worldState.rooms[roomId].participants.push(userId);
    }
  }

  private removeUserFromRoom(userId: string, roomId: string): void {
    if (this.worldState.users[userId]) {
      this.worldState.users[userId].rooms = this.worldState.users[
        userId
      ].rooms.filter((r) => r !== roomId);
    }

    if (this.worldState.rooms[roomId]) {
      this.worldState.rooms[roomId].participants = this.worldState.rooms[
        roomId
      ].participants.filter((p) => p !== userId);
    }
  }

  private updateUserStatus(
    socketId: string,
    status: "online" | "offline",
  ): void {
    // Find user by socket ID and update status
    // This is a simplified implementation - in production you'd maintain socket-to-user mapping
    Object.values(this.worldState.users).forEach((user) => {
      if (user.status === "online") {
        user.status = status;
      }
    });
  }

  private storeMessage(message: SocketMessage): void {
    if (this.worldState.rooms[message.roomId]) {
      this.worldState.rooms[message.roomId].messages.push(message);

      // Keep only last 100 messages per room
      if (this.worldState.rooms[message.roomId].messages.length > 100) {
        this.worldState.rooms[message.roomId].messages =
          this.worldState.rooms[message.roomId].messages.slice(-100);
      }
    }
  }

  /**
   * Pre-ElizaOS Message Processing Pipeline
   * Runs BEFORE messages reach ElizaOS system - perfect for filtering, enrichment, rate limiting
   */
  /**
   * Layer 2: Intelligent Message Processing
   * Enhanced pre-processing with variable extraction and system prompt routing
   */
  private async preprocessMessage(message: SocketMessage): Promise<boolean> {
    // Skip preprocessing if disabled
    if (!this.preprocessingConfig.enabled) {
      return true;
    }

    const startTime = Date.now();
    const traceId = pipelineAnalytics.generateTraceId();

    try {
      // 1. User Identification and Cross-platform Identity Linking
      if (this.preprocessingConfig.crossPlatformIdentity) {
        await this.identifyAndLinkUser(message, traceId);
      }

      // 2. @nubi Mention Detection and 1/8 Chance Engagement Logic
      const engagementResult = this.preprocessingConfig.engagementProcessing
        ? await this.processEngagement(message, traceId)
        : { shouldRespond: true, reason: "engagement_disabled" };

      // 3. Content Filtering (enhanced from Layer 1)
      if (
        this.preprocessingConfig.contentFiltering &&
        (await this.shouldFilterContent(message, traceId))
      ) {
        logger.info(`Content filtered: ${message.messageId}`);
        return false;
      }

      // 4. Rate Limiting (per user)
      if (
        this.preprocessingConfig.rateLimiting &&
        (await this.isRateLimited(message.senderId, traceId))
      ) {
        logger.info(`Rate limited: ${message.senderId}`);
        return false;
      }

      // 5. Variable Extraction and Message Classification
      const classification = this.preprocessingConfig.messageEnrichment
        ? await this.classifyAndEnrichMessage(message, traceId)
        : {
            selectedPrompt: "community-manager" as PromptType,
            confidenceScore: 1.0,
            intent: "unknown",
            reasoning: "",
            variables: {
              mentions: [],
              cryptoTokens: [],
              amounts: [],
              urls: [],
              usernames: [],
              keywords: [],
              sentiment: "neutral" as const,
              urgency: "low" as const,
              context: "",
              timeContext: {
                hour: new Date().getHours(),
                period: this.getPeriodFromHour(new Date().getHours()),
                dayOfWeek: new Date().toLocaleDateString("en", {
                  weekday: "long",
                }),
                isWeekend: [0, 6].includes(new Date().getDay()),
              },
              conversationHistory: {
                recentSentiment: "neutral" as const,
                topicContinuity: [],
                messageCount: 0,
              },
              userPatterns: {
                isFrequentRaider: false,
                isTechnicalUser: false,
                isMemeEnthusiast: false,
                isNewcomer: false,
                communicationStyle: "casual" as const,
              },
              communityContext: {
                activityLevel: "medium" as const,
                ongoingRaids: 0,
                communityMood: "neutral" as const,
              },
              platformSpecific: {
                platform: "websocket",
              },
            },
          };

      // 6. Dynamic System Prompt Routing
      if (
        engagementResult.shouldRespond &&
        this.preprocessingConfig.messageEnrichment
      ) {
        await this.injectSystemPrompt(message, classification, traceId);
      }

      // 7. Security checks
      if (
        this.preprocessingConfig.securityChecks &&
        (await this.securityCheck(message, traceId))
      ) {
        logger.warn(`Security check failed: ${message.messageId}`);
        return false;
      }

      // Log successful Layer 2 processing
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer2",
        platform: message.platform || "websocket",
        eventType: "classification",
        userId: message.senderId,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        success: true,
        metadata: {
          shouldRespond: engagementResult.shouldRespond,
          selectedPrompt: classification.selectedPrompt,
          confidence: classification.confidenceScore,
        },
      });

      return engagementResult.shouldRespond; // Allow message to proceed to ElizaOS only if we should respond
    } catch (error) {
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer2",
        platform: message.platform || "websocket",
        eventType: "classification",
        userId: message.senderId,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error(
        "Layer 2 processing error:",
        error instanceof Error ? error.message : String(error),
      );
      return true; // Default to allowing message if error occurs
    }
  }

  /**
   * Enhanced content filtering with ClickHouse logging
   */
  private async shouldFilterContent(
    message: SocketMessage,
    traceId?: string,
  ): Promise<boolean> {
    const content = message.message.toLowerCase();

    // Basic spam/scam detection
    const spamKeywords = [
      "spam",
      "scam",
      "free money",
      "click here",
      "limited time offer",
      "pump and dump",
    ];
    const hasSpam = spamKeywords.some((keyword) => content.includes(keyword));

    if (hasSpam) {
      logger.warn(
        `Spam detected from ${message.senderId}: ${content.substring(0, 100)}`,
      );

      if (traceId) {
        await pipelineAnalytics.logPipelineEvent({
          traceId,
          layer: "layer2",
          platform: message.platform || "websocket",
          eventType: "security_check",
          userId: message.senderId,
          messageId: message.messageId,
          processingTimeMs: 0,
          success: true,
          metadata: {
            filterReason: "spam_detected",
            keywords: spamKeywords.filter((k) => content.includes(k)),
          },
        });
      }

      return true; // Filter out
    }

    // Check for excessive caps or repeated characters
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 20) {
      if (traceId) {
        await pipelineAnalytics.logPipelineEvent({
          traceId,
          layer: "layer2",
          platform: message.platform || "websocket",
          eventType: "security_check",
          userId: message.senderId,
          messageId: message.messageId,
          processingTimeMs: 0,
          success: true,
          metadata: { filterReason: "excessive_caps", capsRatio },
        });
      }

      return true; // Filter out excessive caps
    }

    return false; // Allow
  }

  /**
   * Layer 2 Processing Functions
   */

  /**
   * User identification and cross-platform identity linking
   */
  private async identifyAndLinkUser(
    message: SocketMessage,
    traceId: string,
  ): Promise<void> {
    try {
      // Get or create user session
      let session = this.userSessions.get(message.senderId);
      if (!session) {
        session = {
          userId: message.senderId,
          platforms: new Set(),
          lastSeen: Date.now(),
          metadata: {},
        };
        this.userSessions.set(message.senderId, session);
      }

      // Add platform to user's platforms
      if (message.platform) {
        session.platforms.add(message.platform);
      }
      session.lastSeen = Date.now();

      // Try to link with cross-platform identity service if available
      if (this.runtime) {
        try {
          const identityService = this.runtime.getService(
            "cross-platform-identity",
          ) as any;
          if (
            identityService &&
            typeof identityService.linkUserIdentity === "function"
          ) {
            await identityService.linkUserIdentity({
              userId: message.senderId,
              platform: message.platform || "websocket",
              metadata: message.metadata,
            });
          }
        } catch (error) {
          // Don't fail if identity service isn't available
          logger.debug(
            "[SOCKET] Identity service not available or failed:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      // Store enriched user data in message metadata
      message.metadata = {
        ...message.metadata,
        userSession: {
          platforms: Array.from(session.platforms),
          lastSeen: session.lastSeen,
          sessionStart: session.lastSeen,
        },
      };
    } catch (error) {
      logger.warn(
        "[SOCKET] User identification failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Process engagement logic (@nubi mentions and 1/8 chance)
   */
  private async processEngagement(
    message: SocketMessage,
    traceId: string,
  ): Promise<{ shouldRespond: boolean; reason: string }> {
    const startTime = Date.now();

    try {
      const isNubiMentioned = this.messageRouter.isNubiMentioned(
        message.message,
      );
      const shouldEngageRandomly = this.messageRouter.shouldEngageRandomly(
        message.senderId,
        message.message,
      );

      let shouldRespond = false;
      let engagementType: string;
      let reason: string;

      if (isNubiMentioned) {
        shouldRespond = true;
        engagementType = "mention";
        reason = "NUBI mentioned";
      } else if (shouldEngageRandomly) {
        shouldRespond = true;
        engagementType = "random";
        reason = "1/8 chance engagement";
      } else {
        engagementType = "ignored";
        reason = "No engagement trigger";
      }

      // Log engagement decision
      await pipelineAnalytics.logEngagementEvent({
        userId: message.senderId,
        platform: message.platform || "websocket",
        engagementType: engagementType as any,
        messageContent: message.message.slice(0, 500),
        nubiMentioned: isNubiMentioned,
        randomTrigger: shouldEngageRandomly,
        responseGenerated: shouldRespond,
        processingTimeMs: Date.now() - startTime,
        metadata: { reason, traceId },
      });

      return { shouldRespond, reason };
    } catch (error) {
      logger.error(
        "[SOCKET] Engagement processing failed:",
        error instanceof Error ? error.message : String(error),
      );
      return { shouldRespond: true, reason: "Error - default to respond" };
    }
  }

  /**
   * Classify message and extract variables
   */
  private async classifyAndEnrichMessage(
    message: SocketMessage,
    traceId: string,
  ): Promise<MessageClassification> {
    try {
      const classification = await this.messageRouter.classifyMessage(
        message.message,
        message.senderId,
        message.platform || "websocket",
        traceId,
      );

      // Enrich message with extracted variables
      message.metadata = {
        ...message.metadata,
        classification: {
          intent: classification.intent,
          selectedPrompt: classification.selectedPrompt,
          confidence: classification.confidenceScore,
          variables: classification.variables,
        },
      };

      return classification;
    } catch (error) {
      logger.error(
        "[SOCKET] Message classification failed:",
        error instanceof Error ? error.message : String(error),
      );

      // Fallback classification
      return {
        intent: "general_conversation",
        selectedPrompt: "community-manager",
        confidenceScore: 0.1,
        reasoning: "Fallback due to classification error",
        variables: {
          mentions: [],
          cryptoTokens: [],
          amounts: [],
          urls: [],
          usernames: [],
          keywords: [],
          sentiment: "neutral",
          urgency: "low",
          context: message.message.slice(0, 100),
          timeContext: {
            hour: new Date().getHours(),
            period: this.getPeriodFromHour(new Date().getHours()),
            dayOfWeek: new Date().toLocaleDateString("en", { weekday: "long" }),
            isWeekend: [0, 6].includes(new Date().getDay()),
          },
          conversationHistory: {
            recentSentiment: "neutral",
            topicContinuity: [],
            messageCount: 0,
          },
          userPatterns: {
            isFrequentRaider: false,
            isTechnicalUser: false,
            isMemeEnthusiast: false,
            isNewcomer: false,
            communicationStyle: "casual",
          },
          communityContext: {
            activityLevel: "medium",
            ongoingRaids: 0,
            communityMood: "neutral",
          },
          platformSpecific: {
            platform: "websocket",
          },
        },
      };
    }
  }

  /**
   * Inject dynamic system prompt based on classification
   */
  private async injectSystemPrompt(
    message: SocketMessage,
    classification: MessageClassification,
    traceId: string,
  ): Promise<void> {
    try {
      const systemPrompt = this.messageRouter.getSystemPrompt(
        classification.selectedPrompt,
        classification.variables,
        message.metadata?.userSession,
      );

      // Inject system prompt into message for ElizaOS
      message.metadata = {
        ...message.metadata,
        systemPrompt,
        promptType: classification.selectedPrompt,
        processingComplete: true,
      };

      logger.debug(
        `[SOCKET] Injected ${classification.selectedPrompt} prompt for message ${message.messageId}`,
      );
    } catch (error) {
      logger.error(
        "[SOCKET] System prompt injection failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async isRateLimited(
    userId: string,
    traceId?: string,
  ): Promise<boolean> {
    // Simple in-memory rate limiting (5 messages per minute per user)
    const now = Date.now();
    const userKey = `rate_${userId}`;
    const windowMs = 60000; // 1 minute
    const maxMessages = 5;

    if (!this.rateLimitMap) {
      this.rateLimitMap = new Map();
    }

    const userRate = this.rateLimitMap.get(userKey) || {
      count: 0,
      resetTime: now + windowMs,
    };

    // Reset window if expired
    if (now > userRate.resetTime) {
      userRate.count = 0;
      userRate.resetTime = now + windowMs;
    }

    userRate.count++;
    this.rateLimitMap.set(userKey, userRate);

    return userRate.count > maxMessages; // True if rate limited
  }

  private async applyPlatformRules(message: SocketMessage): Promise<void> {
    switch (message.platform) {
      case "discord":
        if (message.message.startsWith("!")) {
          message.metadata = { ...message.metadata, isCommand: true };
        }
        break;

      case "telegram":
        if (message.message.startsWith("/")) {
          message.metadata = { ...message.metadata, isCommand: true };
        }
        break;
    }
  }

  private async enrichMessage(message: SocketMessage): Promise<void> {
    // Add contextual metadata that ElizaOS can use
    const hour = new Date().getHours();
    message.metadata = {
      ...message.metadata,
      enrichedAt: Date.now(),
      timeContext: {
        hour,
        period: hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening",
      },
      wordCount: message.message.split(" ").length,
      hasQuestion: message.message.includes("?"),
      hasUrl: /https?:\/\//.test(message.message),
      sentiment: this.basicSentiment(message.message),
    };
  }

  private async securityCheck(
    message: SocketMessage,
    traceId?: string,
  ): Promise<boolean> {
    const content = message.message;

    // Check for malicious patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /eval\(/i,
      /document\.cookie/i,
      /onclick=/i,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(content));
  }

  private basicSentiment(text: string): "positive" | "negative" | "neutral" {
    const positive = [
      "good",
      "great",
      "awesome",
      "love",
      "excellent",
      "amazing",
    ];
    const negative = ["bad", "terrible", "hate", "awful", "sucks", "horrible"];

    const lowerText = text.toLowerCase();
    const positiveCount = positive.filter((word) =>
      lowerText.includes(word),
    ).length;
    const negativeCount = negative.filter((word) =>
      lowerText.includes(word),
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  private rateLimitMap?: Map<string, { count: number; resetTime: number }>;

  /**
   * Bridge Discord messages to Socket.IO system
   * Called when Discord webhook events are received
   */
  async broadcastDiscordMessage(discordMessage: {
    channelId: string;
    userId: string;
    username: string;
    content: string;
    messageId: string;
    guildId?: string;
    metadata?: any;
  }): Promise<void> {
    if (!this.server) return;

    // Convert Discord message to SocketMessage format
    const socketMessage: SocketMessage = {
      senderId: discordMessage.userId,
      senderName: discordMessage.username,
      message: discordMessage.content,
      roomId: `discord_${discordMessage.channelId}`, // Prefix with discord_
      messageId: discordMessage.messageId,
      source: "discord",
      platform: "discord",
      timestamp: Date.now(),
      metadata: {
        guildId: discordMessage.guildId,
        channelId: discordMessage.channelId,
        ...discordMessage.metadata,
      },
    };

    // Ensure Discord room exists
    if (!this.worldState.rooms[socketMessage.roomId]) {
      this.worldState.rooms[socketMessage.roomId] = {
        id: socketMessage.roomId,
        name: `Discord Channel ${discordMessage.channelId}`,
        participants: [],
        messages: [],
      };
    }

    // Ensure Discord user exists
    if (!this.worldState.users[discordMessage.userId]) {
      this.worldState.users[discordMessage.userId] = {
        id: discordMessage.userId,
        name: discordMessage.username,
        rooms: [socketMessage.roomId],
        status: "online",
      };
    } else if (
      !this.worldState.users[discordMessage.userId].rooms.includes(
        socketMessage.roomId,
      )
    ) {
      this.worldState.users[discordMessage.userId].rooms.push(
        socketMessage.roomId,
      );
    }

    // Store message and broadcast
    this.storeMessage(socketMessage);

    // Track Discord message in analytics
    if (this.analyticsService) {
      this.analyticsService.trackMessage(socketMessage);
      this.analyticsService.trackRoomJoin(
        discordMessage.userId,
        socketMessage.roomId,
      );
    }

    this.server
      .to(socketMessage.roomId)
      .emit("messageBroadcast", socketMessage);
    this.server.emit("discordMessage", socketMessage); // Special event for Discord messages

    // Pre-ElizaOS Processing Pipeline for Discord messages
    const shouldProcess = await this.preprocessMessage(socketMessage);

    // Only forward to ElizaOS if pre-processing allows it
    if (shouldProcess) {
      logger.debug(
        `Discord message approved for ElizaOS processing: ${socketMessage.messageId}`,
      );
    } else {
      logger.debug(
        `Discord message filtered out before ElizaOS: ${socketMessage.messageId}`,
      );
    }

    logger.debug(
      `Discord message bridged to Socket.IO - Channel: ${discordMessage.channelId}, User: ${discordMessage.username}`,
    );
  }

  // Sessions API Management Methods

  /**
   * Get active session information
   */
  getActiveSession(sessionId: string) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const sessionTimeout = parseInt(
      process.env.SOCKET_SESSION_TIMEOUT || "1800000",
    ); // 30 minutes default

    for (const [sessionId, session] of Array.from(
      this.activeSessions.entries(),
    )) {
      if (now - session.lastActivity > sessionTimeout) {
        this.activeSessions.delete(sessionId);

        // Notify participants that session expired
        this.server?.to(`session_${sessionId}`).emit("session-ended", {
          sessionId,
          reason: "timeout",
          timestamp: now,
        });

        logger.info(`Session ${sessionId} expired due to inactivity`);
      }
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000);
  }

  /**
   * Broadcast message to all participants in a session
   */
  broadcastToSession(sessionId: string, event: string, data: any): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(
        `Attempted to broadcast to non-existent session: ${sessionId}`,
      );
      return false;
    }

    this.server?.to(`session_${sessionId}`).emit(event, {
      ...data,
      sessionId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Update session activity timestamp
   */
  updateSessionActivity(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  async stop(): Promise<void> {
    if (this.server) {
      logger.info("🔌 Stopping Socket.IO server...");
      this.server.close();
      this.server = undefined;
    }

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = undefined;
    }

    logger.info("🔌 Socket.IO server stopped");
  }

  // Utility methods for external services to interact with Socket.IO
  broadcastToRoom(roomId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(roomId).emit(event, data);
    }
  }

  broadcastToAll(event: string, data: any): void {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  getWorldState(): WorldState {
    return { ...this.worldState };
  }

  getRoomState(roomId: string) {
    return this.worldState.rooms[roomId] || null;
  }

  /**
   * Get time period from hour
   */
  private getPeriodFromHour(
    hour: number,
  ): "morning" | "afternoon" | "evening" | "night" {
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }
}
