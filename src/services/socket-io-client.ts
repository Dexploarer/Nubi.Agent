import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { io, Socket } from "socket.io-client";
import { SocketMessage, WorldState } from "./socket-io-server";
import { MemoryService } from "./index";

export interface SocketIOClientConfig {
  url: string;
  transports?: string[];
  reconnection?: boolean;
  reconnectionAttempts?: number;
  timeout?: number;
}

export class SocketIOClientService extends Service {
  static serviceType = "socket-io-client";

  private socket?: Socket;
  private clientConfig: SocketIOClientConfig;
  private currentRoomId?: string;
  private userId?: string;
  private userName?: string;
  private isConnected = false;
  private messageHandlers: Map<string, Function[]> = new Map();
  private agentRuntime?: IAgentRuntime;

  // Sessions API support
  private activeSessions = new Map<
    string,
    {
      sessionId: string;
      isStreaming: boolean;
      lastActivity: number;
    }
  >();

  get capabilityDescription(): string {
    return "Real-time WebSocket client for bidirectional communication with Socket.IO server";
  }

  constructor(runtime?: IAgentRuntime, config?: Partial<SocketIOClientConfig>) {
    super();
    this.clientConfig = {
      url: process.env.SOCKET_IO_URL || "http://localhost:3001",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 5000,
      ...config,
    };
    if (runtime) {
      this.agentRuntime = runtime;
    }
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.agentRuntime = runtime;

    try {
      // Initialize Socket.IO client
      this.socket = io(this.clientConfig.url, {
        transports: this.clientConfig.transports as any,
        reconnection: this.clientConfig.reconnection,
        reconnectionAttempts: this.clientConfig.reconnectionAttempts,
        timeout: this.clientConfig.timeout,
      });

      this.setupEventHandlers();

      // Wait for connection
      await this.waitForConnection();

      logger.info(`🔌 Socket.IO client connected to ${this.clientConfig.url}`);
    } catch (error) {
      logger.error(
        "Failed to initialize Socket.IO client:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.isConnected = true;
      logger.info("🔌 Socket.IO client connected");

      // Rejoin room if we were in one
      if (this.currentRoomId && this.userId && this.userName) {
        this.joinRoom(this.currentRoomId, this.userId, this.userName);
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      logger.warn(`🔌 Socket.IO client disconnected: ${reason}`);
    });

    this.socket.on("connect_error", (error) => {
      logger.error(
        "🔌 Socket.IO client connection error:",
        error instanceof Error ? error.message : String(error),
      );
    });

    // Handle incoming messages
    this.socket.on("messageBroadcast", (message: SocketMessage) => {
      try {
        // Filter messages for current room
        if (this.currentRoomId && message.roomId === this.currentRoomId) {
          logger.debug(
            `Received message in ${message.roomId}: ${message.message.substring(0, 50)}...`,
          );

          // Notify handlers
          this.notifyHandlers("message", message);

          // Process with runtime if available
          if (this.agentRuntime && message.senderId !== this.userId) {
            this.processIncomingMessage(message);
          }
        }
      } catch (error) {
        logger.error(
          "Error handling incoming message:",
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    this.socket.on(
      "messageComplete",
      (data: { messageId: string; timestamp: number }) => {
        logger.debug(`Message ${data.messageId} completed`);
        this.notifyHandlers("messageComplete", data);
      },
    );

    this.socket.on("world-state", (state: WorldState) => {
      logger.debug("Received world state update");
      this.notifyHandlers("worldState", state);
    });

    this.socket.on(
      "userJoined",
      (data: {
        userId: string;
        userName: string;
        roomId: string;
        timestamp: number;
      }) => {
        logger.info(`User ${data.userName} joined room ${data.roomId}`);
        this.notifyHandlers("userJoined", data);
      },
    );

    this.socket.on(
      "userLeft",
      (data: { userId: string; roomId: string; timestamp: number }) => {
        logger.info(`User ${data.userId} left room ${data.roomId}`);
        this.notifyHandlers("userLeft", data);
      },
    );

    this.socket.on("logEntry", (logData: any) => {
      logger.debug("Real-time log entry:", logData);
      this.notifyHandlers("logEntry", logData);
    });

    this.socket.on("error", (error: any) => {
      logger.error("Socket.IO client error:", error);
      this.notifyHandlers("error", error);
    });

    // Sessions API event handlers
    this.socket.on(
      "session-started",
      (data: { sessionId: string; timestamp: number }) => {
        logger.info(`Session started: ${data.sessionId}`);
        this.activeSessions.set(data.sessionId, {
          sessionId: data.sessionId,
          isStreaming: false,
          lastActivity: Date.now(),
        });
        this.notifyHandlers("sessionStarted", data);
      },
    );

    this.socket.on(
      "streaming-started",
      (data: { sessionId: string; timestamp: number }) => {
        logger.info(`Streaming started for session: ${data.sessionId}`);
        const session = this.activeSessions.get(data.sessionId);
        if (session) {
          session.isStreaming = true;
          session.lastActivity = Date.now();
        }
        this.notifyHandlers("streamingStarted", data);
      },
    );

    this.socket.on(
      "stream-chunk",
      (data: {
        sessionId: string;
        chunk: string;
        timestamp: number;
        isComplete: boolean;
      }) => {
        logger.debug(
          `Stream chunk received for session ${data.sessionId}: ${data.chunk.substring(0, 50)}...`,
        );
        const session = this.activeSessions.get(data.sessionId);
        if (session) {
          session.lastActivity = Date.now();
        }
        this.notifyHandlers("streamChunk", data);
      },
    );

    this.socket.on(
      "streaming-complete",
      (data: { sessionId: string; timestamp: number }) => {
        logger.info(`Streaming completed for session: ${data.sessionId}`);
        const session = this.activeSessions.get(data.sessionId);
        if (session) {
          session.isStreaming = false;
          session.lastActivity = Date.now();
        }
        this.notifyHandlers("streamingComplete", data);
      },
    );

    this.socket.on(
      "session-ended",
      (data: { sessionId: string; reason?: string; timestamp: number }) => {
        logger.info(
          `Session ended: ${data.sessionId}, reason: ${data.reason || "manual"}`,
        );
        this.activeSessions.delete(data.sessionId);
        this.notifyHandlers("sessionEnded", data);
      },
    );
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Socket.IO connection timeout"));
      }, this.clientConfig.timeout);

      this.socket?.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket?.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async processIncomingMessage(message: SocketMessage): Promise<void> {
    try {
      if (!this.agentRuntime) return;

      // Convert socket message to ElizaOS memory format
      const memory = {
        id: message.messageId as any,
        agentId: this.agentRuntime.agentId,
        userId: message.senderId as any,
        roomId: message.roomId as any,
        entityId: message.senderId as any,
        content: {
          text: message.message,
          source: message.source || "socket.io",
          metadata: message.metadata,
        },
        createdAt: message.timestamp,
      };

      // Store in memory using the database memory service
      const memoryService =
        this.agentRuntime.getService<MemoryService>("database-memory");
      if (memoryService) {
        await memoryService.createMemory(memory);
      }

      // Trigger message processing
      // This would typically involve calling the agent's message handler
      logger.debug("Processed incoming Socket.IO message through runtime");
    } catch (error) {
      logger.error(
        "Error processing incoming message:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Public API methods

  async joinRoom(
    roomId: string,
    userId: string,
    userName: string,
  ): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    this.currentRoomId = roomId;
    this.userId = userId;
    this.userName = userName;

    this.socket.emit("join", { roomId, userId, userName });
    logger.info(`Joined room ${roomId} as ${userName}`);
  }

  async leaveRoom(): Promise<void> {
    if (!this.socket || !this.currentRoomId || !this.userId) {
      return;
    }

    this.socket.emit("leave", {
      roomId: this.currentRoomId,
      userId: this.userId,
    });

    logger.info(`Left room ${this.currentRoomId}`);
    this.currentRoomId = undefined;
  }

  async sendMessage(message: string, metadata?: any): Promise<string> {
    if (
      !this.socket ||
      !this.isConnected ||
      !this.currentRoomId ||
      !this.userId ||
      !this.userName
    ) {
      throw new Error("Socket.IO client not ready for sending messages");
    }

    const socketMessage: SocketMessage = {
      senderId: this.userId,
      senderName: this.userName,
      message,
      roomId: this.currentRoomId,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: "websocket" as const,
      attachments: [],
      metadata,
      timestamp: Date.now(),
    };

    this.socket.emit("message", socketMessage);
    logger.debug(`Sent message: ${message.substring(0, 50)}...`);

    return socketMessage.messageId;
  }

  async requestWorldState(roomId?: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    this.socket.emit("request-world-state", { roomId });
  }

  // Sessions API Methods

  async startSession(sessionId: string, roomId?: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    this.socket.emit("start-session", {
      sessionId,
      userId: this.userId || `user_${Date.now()}`,
      roomId: roomId || this.currentRoomId || "default",
    });

    logger.info(`Started session: ${sessionId}`);
  }

  async startStreaming(sessionId: string, prompt?: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.socket.emit("start-streaming", { sessionId, prompt });
    logger.info(`Started streaming for session: ${sessionId}`);
  }

  async sendStreamChunk(
    sessionId: string,
    chunk: string,
    isComplete = false,
  ): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isStreaming) {
      throw new Error(`Session ${sessionId} not found or not streaming`);
    }

    this.socket.emit("stream-chunk", { sessionId, chunk, isComplete });
    logger.debug(
      `Sent stream chunk for session ${sessionId}: ${chunk.substring(0, 50)}...`,
    );
  }

  async endSession(sessionId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket.IO client not connected");
    }

    this.socket.emit("end-session", { sessionId });
    this.activeSessions.delete(sessionId);
    logger.info(`Ended session: ${sessionId}`);
  }

  getActiveSession(sessionId: string) {
    return this.activeSessions.get(sessionId);
  }

  getAllActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  isSessionStreaming(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.isStreaming || false;
  }

  // Event handler registration

  onSessionStarted(
    handler: (data: { sessionId: string; timestamp: number }) => void,
  ): void {
    this.addHandler("sessionStarted", handler);
  }

  onStreamingStarted(
    handler: (data: { sessionId: string; timestamp: number }) => void,
  ): void {
    this.addHandler("streamingStarted", handler);
  }

  onStreamChunk(
    handler: (data: {
      sessionId: string;
      chunk: string;
      timestamp: number;
      isComplete: boolean;
    }) => void,
  ): void {
    this.addHandler("streamChunk", handler);
  }

  onStreamingComplete(
    handler: (data: { sessionId: string; timestamp: number }) => void,
  ): void {
    this.addHandler("streamingComplete", handler);
  }

  onSessionEnded(
    handler: (data: {
      sessionId: string;
      reason?: string;
      timestamp: number;
    }) => void,
  ): void {
    this.addHandler("sessionEnded", handler);
  }

  onMessage(handler: (message: SocketMessage) => void): void {
    this.addHandler("message", handler);
  }

  onUserJoined(
    handler: (data: {
      userId: string;
      userName: string;
      roomId: string;
      timestamp: number;
    }) => void,
  ): void {
    this.addHandler("userJoined", handler);
  }

  onUserLeft(
    handler: (data: {
      userId: string;
      roomId: string;
      timestamp: number;
    }) => void,
  ): void {
    this.addHandler("userLeft", handler);
  }

  onWorldState(handler: (state: WorldState) => void): void {
    this.addHandler("worldState", handler);
  }

  onError(handler: (error: any) => void): void {
    this.addHandler("error", handler);
  }

  private addHandler(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  private notifyHandlers(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error(
            `Error in ${event} handler:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      });
    }
  }

  // Getters

  get connected(): boolean {
    return this.isConnected;
  }

  get currentRoom(): string | undefined {
    return this.currentRoomId;
  }

  get user(): { id?: string; name?: string } {
    return { id: this.userId, name: this.userName };
  }

  async stop(): Promise<void> {
    if (this.currentRoomId) {
      await this.leaveRoom();
    }

    if (this.socket) {
      logger.info("🔌 Disconnecting Socket.IO client...");
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.isConnected = false;
    this.messageHandlers.clear();

    logger.info("🔌 Socket.IO client stopped");
  }
}
