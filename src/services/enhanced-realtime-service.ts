import { Service, IAgentRuntime, Memory, logger, UUID } from "@elizaos/core";
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from "@supabase/supabase-js";

/**
 * Enhanced Real-time Events Service for NUBI
 *
 * Combines ElizaOS Socket.IO integration with Supabase Realtime:
 * - ElizaOS Socket.IO: Agent message broadcasts, UI updates
 * - Supabase Realtime: Database changes, global state sync
 * - Unified event bus for seamless real-time features
 */

export interface SocketEventData {
  agentId: UUID;
  roomId?: UUID;
  userId?: UUID;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface ElizaOSMessage {
  type: number; // 1 = ROOM_JOINING, 2 = MESSAGE
  payload: {
    roomId: string;
    entityId?: string;
    content?: any;
    metadata?: Record<string, any>;
  };
}

export interface SupabaseRealtimeConfig {
  url?: string;
  anonKey?: string;
  serviceKey?: string;
  enabled: boolean;
}

export class EnhancedRealtimeService extends Service {
  static serviceType = "enhanced_realtime" as const;
  capabilityDescription =
    "Unified ElizaOS Socket.IO + Supabase Realtime events";

  private socketServer: any = null;
  private supabaseClient: SupabaseClient | null = null;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private eventQueue: Array<{ event: string; data: SocketEventData }> = [];
  private subscribers: Map<string, Set<string>> = new Map(); // event -> Set<socketId>

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<EnhancedRealtimeService> {
    const service = new EnhancedRealtimeService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize ElizaOS Socket.IO integration
      await this.initializeElizaOSSocketIO();

      // Initialize Supabase Realtime
      await this.initializeSupabaseRealtime();

      logger.info("✅ Enhanced realtime service initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize realtime service:", error);
    }
  }

  private async initializeElizaOSSocketIO(): Promise<void> {
    // Get Socket.IO server from ElizaOS runtime following official patterns
    this.socketServer = this.getElizaOSSocketServer();

    if (!this.socketServer) {
      logger.warn(
        "⚠️ ElizaOS Socket.IO server not available - events will be queued",
      );
      return;
    }

    // Set up ElizaOS-compliant event listeners
    this.setupElizaOSEventListeners();
    logger.info("📡 ElizaOS Socket.IO integration initialized");
  }

  private async initializeSupabaseRealtime(): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL || this.extractSupabaseUrl();
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.warn(
        "⚠️ Supabase credentials not available - database events disabled",
      );
      return;
    }

    try {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      // Set up database change subscriptions
      await this.setupSupabaseChannels();
      logger.info("🔄 Supabase Realtime integration initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize Supabase Realtime:", error);
    }
  }

  /**
   * Extract Supabase URL from DATABASE_URL if needed
   */
  private extractSupabaseUrl(): string | undefined {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return undefined;

    // Convert PostgreSQL URL to Supabase REST URL
    const match = databaseUrl.match(
      /^postgresql:\/\/[^@]+@([^.]+)\.supabase\.co/,
    );
    if (match) {
      const projectRef = match[1];
      return `https://${projectRef}.supabase.co`;
    }
    return undefined;
  }

  /**
   * Get ElizaOS Socket.IO server following official patterns
   */
  private getElizaOSSocketServer(): any {
    const runtime = this.runtime as any;

    // Try ElizaOS standard locations
    if (runtime.socketServer?.emit) {
      logger.debug("🔍 Found Socket.IO at runtime.socketServer");
      return runtime.socketServer;
    }

    if (runtime.io?.emit) {
      logger.debug("🔍 Found Socket.IO at runtime.io");
      return runtime.io;
    }

    if (runtime.server?.io?.emit) {
      logger.debug("🔍 Found Socket.IO at runtime.server.io");
      return runtime.server.io;
    }

    return null;
  }

  /**
   * Set up ElizaOS-compliant Socket.IO event listeners
   */
  private setupElizaOSEventListeners(): void {
    if (!this.socketServer) return;

    this.socketServer.on("connection", (socket: any) => {
      logger.debug(`🔗 ElizaOS client connected: ${socket.id}`);

      // Handle ElizaOS room joining protocol
      socket.on("message", (message: ElizaOSMessage) => {
        this.handleElizaOSMessage(socket, message);
      });

      // Handle NUBI-specific subscriptions
      socket.on("subscribeToNubiEvents", (events: string[]) => {
        for (const event of events) {
          if (this.isValidNubiEvent(event)) {
            this.addSubscriber(event, socket.id);
            logger.debug(`📝 Client ${socket.id} subscribed to ${event}`);
          }
        }
      });

      // Clean up on disconnect
      socket.on("disconnect", () => {
        this.removeSubscriber(socket.id);
        logger.debug(`🔌 ElizaOS client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle ElizaOS message protocol
   */
  private handleElizaOSMessage(socket: any, message: ElizaOSMessage): void {
    switch (message.type) {
      case 1: // ROOM_JOINING
        socket.join(message.payload.roomId);
        this.addSubscriber("roomActivity", socket.id);
        logger.debug(`🏠 Client joined room: ${message.payload.roomId}`);
        break;

      case 2: // MESSAGE
        // Handle incoming messages if needed
        logger.debug(`💬 Message received in room: ${message.payload.roomId}`);
        break;
    }
  }

  /**
   * Set up Supabase Realtime channels for database changes
   */
  private async setupSupabaseChannels(): Promise<void> {
    if (!this.supabaseClient) return;

    // Raid Sessions channel for real-time raid coordination
    const raidChannel = this.supabaseClient
      .channel("raid_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raid_sessions",
        },
        (payload) => this.handleRaidSessionChange(payload),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raid_participants",
        },
        (payload) => this.handleRaidParticipantChange(payload),
      )
      .subscribe();

    this.realtimeChannels.set("raids", raidChannel);

    // Community Stats channel for leaderboards
    const communityChannel = this.supabaseClient
      .channel("community_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_stats",
        },
        (payload) => this.handleCommunityStatsChange(payload),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_identities",
        },
        (payload) => this.handleUserIdentityChange(payload),
      )
      .subscribe();

    this.realtimeChannels.set("community", communityChannel);

    // Personality Evolution channel
    const personalityChannel = this.supabaseClient
      .channel("personality_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "personality_snapshots",
        },
        (payload) => this.handlePersonalityChange(payload),
      )
      .subscribe();

    this.realtimeChannels.set("personality", personalityChannel);

    logger.info("📊 Supabase Realtime channels subscribed");
  }

  /**
   * Handle database change events
   */
  private async handleRaidSessionChange(payload: any): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      timestamp: new Date().toISOString(),
      data: {
        raidId: payload.new?.id || payload.old?.id,
        action: this.getActionFromPayload(payload),
        status: payload.new?.status,
        participants: payload.new?.participant_count,
        score: payload.new?.current_score,
      },
      metadata: { eventType: "raid_db", source: "supabase" },
    };

    await this.broadcastToAll("nubiRaidUpdate", eventData);
  }

  private async handleRaidParticipantChange(payload: any): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      timestamp: new Date().toISOString(),
      data: {
        raidId: payload.new?.raid_session_id || payload.old?.raid_session_id,
        userId: payload.new?.user_uuid || payload.old?.user_uuid,
        action: this.getActionFromPayload(payload),
        score: payload.new?.score,
      },
      metadata: { eventType: "raid_participant", source: "supabase" },
    };

    await this.broadcastToAll("nubiRaidUpdate", eventData);
  }

  private async handleCommunityStatsChange(payload: any): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      timestamp: new Date().toISOString(),
      data: {
        userId: payload.new?.user_uuid || payload.old?.user_uuid,
        stats: payload.new,
        action: this.getActionFromPayload(payload),
      },
      metadata: { eventType: "community_stats", source: "supabase" },
    };

    await this.broadcastToAll("communityLeaderboard", eventData);
  }

  private async handleUserIdentityChange(payload: any): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      timestamp: new Date().toISOString(),
      data: {
        userId: payload.new?.user_uuid || payload.old?.user_uuid,
        identity: payload.new,
        action: this.getActionFromPayload(payload),
      },
      metadata: { eventType: "user_identity", source: "supabase" },
    };

    await this.broadcastToAll("userIdentityUpdate", eventData);
  }

  private async handlePersonalityChange(payload: any): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      timestamp: new Date().toISOString(),
      data: {
        traits: payload.new?.traits,
        changes: payload.new?.changes,
        trigger: payload.new?.trigger,
        intensity: payload.new?.intensity,
      },
      metadata: { eventType: "personality", source: "supabase" },
    };

    await this.broadcastToAll("personalityEvolution", eventData);
  }

  private getActionFromPayload(payload: any): string {
    if (payload.eventType === "INSERT") return "created";
    if (payload.eventType === "UPDATE") return "updated";
    if (payload.eventType === "DELETE") return "deleted";
    return "changed";
  }

  /**
   * Broadcast to both ElizaOS Socket.IO and Supabase channels
   */
  private async broadcastToAll(
    event: string,
    data: SocketEventData,
  ): Promise<void> {
    // ElizaOS Socket.IO broadcast
    await this.emitToSubscribers(event, data);

    // Supabase Broadcast for external clients
    if (this.supabaseClient) {
      const channel = this.supabaseClient.channel("nubi_events");
      channel.send({
        type: "broadcast",
        event: event,
        payload: data,
      });
    }
  }

  /**
   * ElizaOS-compliant message broadcast
   */
  async broadcastMessage(
    roomId: string,
    content: any,
    metadata?: any,
  ): Promise<void> {
    if (!this.socketServer) {
      logger.warn("⚠️ Socket.IO not available for broadcast");
      return;
    }

    const message: ElizaOSMessage = {
      type: 2, // MESSAGE
      payload: {
        roomId,
        content,
        metadata: {
          ...metadata,
          agentId: this.runtime.agentId,
          timestamp: new Date().toISOString(),
        },
      },
    };

    this.socketServer.to(roomId).emit("messageBroadcast", message);
    logger.debug(`📢 Broadcasted to room ${roomId}`);
  }

  /**
   * Enhanced raid update with dual broadcast
   */
  async emitRaidUpdate(data: {
    raidId: string;
    roomId: UUID;
    action: "start" | "update" | "complete";
    participants: number;
    score?: number;
    leaderboard?: Array<{ userId: string; score: number }>;
  }): Promise<void> {
    const eventData: SocketEventData = {
      agentId: this.runtime.agentId,
      roomId: data.roomId,
      timestamp: new Date().toISOString(),
      data: {
        raidId: data.raidId,
        action: data.action,
        participants: data.participants,
        score: data.score,
        leaderboard: data.leaderboard,
      },
      metadata: { eventType: "raid", source: "direct" },
    };

    await this.broadcastToAll("nubiRaidUpdate", eventData);

    // Also broadcast via ElizaOS message protocol
    await this.broadcastMessage(data.roomId, eventData);
  }

  /**
   * Generic method to emit to event subscribers
   */
  private async emitToSubscribers(
    event: string,
    data: SocketEventData,
  ): Promise<void> {
    if (!this.socketServer) {
      this.queueEvent(event, data);
      return;
    }

    const subscribers = this.subscribers.get(event);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    for (const socketId of subscribers) {
      const socket = this.socketServer.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    }
  }

  /**
   * Queue events when Socket.IO is not available
   */
  private queueEvent(event: string, data: SocketEventData): void {
    this.eventQueue.push({ event, data });

    // Keep queue size manageable
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift();
    }
  }

  /**
   * Helper methods
   */
  private isValidNubiEvent(event: string): boolean {
    const validEvents = [
      "nubiRaidUpdate",
      "communityLeaderboard",
      "personalityEvolution",
      "sessionActivity",
      "memoryInsights",
      "emotionalStateChange",
      "userIdentityUpdate",
    ];
    return validEvents.includes(event);
  }

  private addSubscriber(event: string, socketId: string): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(socketId);
  }

  private removeSubscriber(socketId: string): void {
    for (const [event, subscribers] of this.subscribers) {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.subscribers.delete(event);
      }
    }
  }

  /**
   * Get real-time statistics
   */
  async getStatistics(): Promise<{
    elizaOSConnectedClients: number;
    supabaseChannels: number;
    activeSubscriptions: Record<string, number>;
    queuedEvents: number;
  }> {
    const elizaOSConnectedClients = this.socketServer
      ? Object.keys(this.socketServer.sockets.sockets).length
      : 0;

    const activeSubscriptions: Record<string, number> = {};
    for (const [event, subscribers] of this.subscribers) {
      activeSubscriptions[event] = subscribers.size;
    }

    return {
      elizaOSConnectedClients,
      supabaseChannels: this.realtimeChannels.size,
      activeSubscriptions,
      queuedEvents: this.eventQueue.length,
    };
  }

  /**
   * Clean up on service stop
   */
  async stop(): Promise<void> {
    // Close Supabase channels
    for (const [name, channel] of this.realtimeChannels) {
      if (channel && typeof channel.unsubscribe === "function") {
        await channel.unsubscribe();
        logger.debug(`🔌 Unsubscribed from ${name} channel`);
      }
    }
    this.realtimeChannels.clear();

    // Clean up Supabase client
    if (this.supabaseClient) {
      this.supabaseClient = null;
    }

    // Clean up event queue and subscribers
    this.eventQueue = [];
    this.subscribers.clear();

    logger.info("🛑 Enhanced Realtime Service stopped");
  }
}

export default EnhancedRealtimeService;
