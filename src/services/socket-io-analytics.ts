import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { SocketMessage } from "./socket-io-server";

export interface SocketAnalytics {
  messagesPerRoom: Record<string, number>;
  activeUsers: Record<
    string,
    {
      lastSeen: number;
      messageCount: number;
      roomsJoined: string[];
    }
  >;
  roomActivity: Record<
    string,
    {
      created: number;
      lastActivity: number;
      peakUsers: number;
      totalMessages: number;
    }
  >;
  connectionEvents: {
    connections: number;
    disconnections: number;
    errors: number;
  };
  messageStats: {
    totalMessages: number;
    averageLength: number;
    messagesPerHour: number;
  };
}

export class SocketIOAnalyticsService extends Service {
  static serviceType = "socket-io-analytics";

  get capabilityDescription(): string {
    return "Analytics and monitoring service for Socket.IO events and performance metrics";
  }

  private analytics: SocketAnalytics;
  private startTime: number;
  private analyticsEngineUrl: string;
  private syncInterval?: NodeJS.Timeout;
  private lastSyncTime: number;
  private syncThresholds = {
    messages: parseInt(process.env.ANALYTICS_SYNC_MESSAGE_THRESHOLD || "50"),
    timeInterval: parseInt(process.env.ANALYTICS_SYNC_INTERVAL || "300000"), // 5 minutes default
    connections: parseInt(
      process.env.ANALYTICS_SYNC_CONNECTION_THRESHOLD || "10",
    ),
  };
  private syncEnabled = process.env.ANALYTICS_SYNC_ENABLED !== "false";

  constructor() {
    super();
    this.startTime = Date.now();
    this.lastSyncTime = Date.now();
    this.analyticsEngineUrl =
      process.env.ANALYTICS_ENGINE_URL ||
      "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/analytics-engine";
    this.analytics = {
      messagesPerRoom: {},
      activeUsers: {},
      roomActivity: {},
      connectionEvents: {
        connections: 0,
        disconnections: 0,
        errors: 0,
      },
      messageStats: {
        totalMessages: 0,
        averageLength: 0,
        messagesPerHour: 0,
      },
    };
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info("🔌 Socket.IO Analytics Service initialized");

    if (this.syncEnabled) {
      // Start automatic sync interval
      this.startSyncInterval();

      // Initial sync to establish baseline
      setTimeout(() => this.syncToAnalyticsEngine(), 30000); // 30 seconds after startup

      logger.info(
        `📊 Analytics sync enabled - Messages: ${this.syncThresholds.messages}, Interval: ${this.syncThresholds.timeInterval}ms, Connections: ${this.syncThresholds.connections}`,
      );
    } else {
      logger.info("📊 Analytics sync disabled by configuration");
    }
  }

  // Sync interval management

  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.checkAndSync("interval");
    }, this.syncThresholds.timeInterval);

    logger.debug(
      `📊 Analytics sync interval started: ${this.syncThresholds.timeInterval}ms`,
    );
  }

  private async checkAndSync(
    trigger: "interval" | "messages" | "connections",
  ): Promise<void> {
    if (!this.syncEnabled) return;

    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    let shouldSync = false;

    switch (trigger) {
      case "interval":
        shouldSync = timeSinceLastSync >= this.syncThresholds.timeInterval;
        break;
      case "messages":
        shouldSync =
          this.analytics.messageStats.totalMessages > 0 &&
          this.analytics.messageStats.totalMessages %
            this.syncThresholds.messages ===
            0;
        break;
      case "connections":
        shouldSync =
          this.analytics.connectionEvents.connections > 0 &&
          this.analytics.connectionEvents.connections %
            this.syncThresholds.connections ===
            0;
        break;
    }

    if (shouldSync) {
      logger.debug(
        `📊 Triggering analytics sync: ${trigger} (Messages: ${this.analytics.messageStats.totalMessages}, Connections: ${this.analytics.connectionEvents.connections})`,
      );
      await this.syncToAnalyticsEngine();
      this.lastSyncTime = Date.now();
    }
  }

  // Event tracking methods

  trackConnection(userId: string): void {
    this.analytics.connectionEvents.connections++;

    if (!this.analytics.activeUsers[userId]) {
      this.analytics.activeUsers[userId] = {
        lastSeen: Date.now(),
        messageCount: 0,
        roomsJoined: [],
      };
    } else {
      this.analytics.activeUsers[userId].lastSeen = Date.now();
    }

    logger.debug(`📊 Connection tracked for user ${userId}`);

    // Trigger sync check for connections
    this.checkAndSync("connections");
  }

  trackDisconnection(userId: string): void {
    this.analytics.connectionEvents.disconnections++;

    if (this.analytics.activeUsers[userId]) {
      this.analytics.activeUsers[userId].lastSeen = Date.now();
    }

    logger.debug(`📊 Disconnection tracked for user ${userId}`);
  }

  trackError(error: any): void {
    this.analytics.connectionEvents.errors++;
    logger.debug("📊 Socket error tracked:", error);
  }

  trackMessage(message: SocketMessage): void {
    const { roomId, senderId, message: text } = message;

    // Update message stats
    this.analytics.messageStats.totalMessages++;
    const currentAvg = this.analytics.messageStats.averageLength;
    const totalMessages = this.analytics.messageStats.totalMessages;
    this.analytics.messageStats.averageLength =
      (currentAvg * (totalMessages - 1) + text.length) / totalMessages;

    // Update messages per hour
    const hoursElapsed = (Date.now() - this.startTime) / (1000 * 60 * 60);
    this.analytics.messageStats.messagesPerHour =
      this.analytics.messageStats.totalMessages / Math.max(hoursElapsed, 1);

    // Update room statistics
    if (!this.analytics.messagesPerRoom[roomId]) {
      this.analytics.messagesPerRoom[roomId] = 0;
    }
    this.analytics.messagesPerRoom[roomId]++;

    if (!this.analytics.roomActivity[roomId]) {
      this.analytics.roomActivity[roomId] = {
        created: Date.now(),
        lastActivity: Date.now(),
        peakUsers: 1,
        totalMessages: 0,
      };
    }

    this.analytics.roomActivity[roomId].lastActivity = Date.now();
    this.analytics.roomActivity[roomId].totalMessages++;

    // Update user statistics
    if (this.analytics.activeUsers[senderId]) {
      this.analytics.activeUsers[senderId].messageCount++;
      this.analytics.activeUsers[senderId].lastSeen = Date.now();
    }

    logger.debug(`📊 Message tracked in room ${roomId} by user ${senderId}`);

    // Trigger sync check for messages
    this.checkAndSync("messages");
  }

  trackRoomJoin(userId: string, roomId: string): void {
    if (!this.analytics.activeUsers[userId]) {
      this.analytics.activeUsers[userId] = {
        lastSeen: Date.now(),
        messageCount: 0,
        roomsJoined: [],
      };
    }

    if (!this.analytics.activeUsers[userId].roomsJoined.includes(roomId)) {
      this.analytics.activeUsers[userId].roomsJoined.push(roomId);
    }

    // Update room activity
    if (!this.analytics.roomActivity[roomId]) {
      this.analytics.roomActivity[roomId] = {
        created: Date.now(),
        lastActivity: Date.now(),
        peakUsers: 0,
        totalMessages: 0,
      };
    }

    // Calculate current users in room (simplified)
    const currentUsersInRoom = Object.values(this.analytics.activeUsers).filter(
      (user) => user.roomsJoined.includes(roomId),
    ).length;

    this.analytics.roomActivity[roomId].peakUsers = Math.max(
      this.analytics.roomActivity[roomId].peakUsers,
      currentUsersInRoom,
    );

    logger.debug(`📊 Room join tracked: ${userId} joined ${roomId}`);
  }

  trackRoomLeave(userId: string, roomId: string): void {
    if (this.analytics.activeUsers[userId]) {
      this.analytics.activeUsers[userId].roomsJoined =
        this.analytics.activeUsers[userId].roomsJoined.filter(
          (r) => r !== roomId,
        );
    }

    logger.debug(`📊 Room leave tracked: ${userId} left ${roomId}`);
  }

  // Analytics retrieval methods

  getAnalytics(): SocketAnalytics {
    return { ...this.analytics };
  }

  getRoomAnalytics(roomId: string) {
    return {
      messages: this.analytics.messagesPerRoom[roomId] || 0,
      activity: this.analytics.roomActivity[roomId] || null,
      activeUsers: Object.entries(this.analytics.activeUsers)
        .filter(([_, user]) => user.roomsJoined.includes(roomId))
        .map(([userId, user]) => ({ userId, ...user })),
    };
  }

  getUserAnalytics(userId: string) {
    return this.analytics.activeUsers[userId] || null;
  }

  getTopRooms(limit: number = 10) {
    return Object.entries(this.analytics.messagesPerRoom)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([roomId, messageCount]) => ({
        roomId,
        messageCount,
        activity: this.analytics.roomActivity[roomId],
      }));
  }

  getTopUsers(limit: number = 10) {
    return Object.entries(this.analytics.activeUsers)
      .sort(([, a], [, b]) => b.messageCount - a.messageCount)
      .slice(0, limit)
      .map(([userId, stats]) => ({ userId, ...stats }));
  }

  getSystemStats() {
    return {
      uptime: Date.now() - this.startTime,
      totalRooms: Object.keys(this.analytics.roomActivity).length,
      totalUsers: Object.keys(this.analytics.activeUsers).length,
      ...this.analytics.connectionEvents,
      ...this.analytics.messageStats,
    };
  }

  // Analytics export

  exportAnalytics(): string {
    const data = {
      exportTime: Date.now(),
      startTime: this.startTime,
      systemStats: this.getSystemStats(),
      topRooms: this.getTopRooms(),
      topUsers: this.getTopUsers(),
      fullAnalytics: this.analytics,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Send analytics data to the analytics engine
   */
  async syncToAnalyticsEngine(): Promise<void> {
    try {
      const response = await fetch(this.analyticsEngineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "calculate",
          platform: "socket-io",
          metrics: this.getSystemStats(),
          topRooms: this.getTopRooms(5),
          topUsers: this.getTopUsers(5),
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        logger.warn(`Analytics engine sync failed: ${response.statusText}`);
        return;
      }

      const result = await response.json();
      logger.debug("📊 Analytics synced to engine:", result);
    } catch (error) {
      logger.warn(
        "📊 Failed to sync analytics to engine:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Cleanup methods

  cleanupOldData(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;

    // Remove inactive users
    Object.entries(this.analytics.activeUsers).forEach(([userId, user]) => {
      if (user.lastSeen < cutoff) {
        delete this.analytics.activeUsers[userId];
      }
    });

    // Clean up inactive rooms
    Object.entries(this.analytics.roomActivity).forEach(([roomId, room]) => {
      if (room.lastActivity < cutoff) {
        delete this.analytics.roomActivity[roomId];
        delete this.analytics.messagesPerRoom[roomId];
      }
    });

    logger.info("📊 Cleaned up old analytics data");
  }

  resetAnalytics(): void {
    this.analytics = {
      messagesPerRoom: {},
      activeUsers: {},
      roomActivity: {},
      connectionEvents: {
        connections: 0,
        disconnections: 0,
        errors: 0,
      },
      messageStats: {
        totalMessages: 0,
        averageLength: 0,
        messagesPerHour: 0,
      },
    };

    this.startTime = Date.now();
    logger.info("📊 Analytics data reset");
  }

  async stop(): Promise<void> {
    // Clean up sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      logger.debug("📊 Analytics sync interval cleared");
    }

    // Perform final sync to analytics engine
    try {
      await this.syncToAnalyticsEngine();
      logger.info("📊 Final analytics sync completed");
    } catch (error) {
      logger.warn(
        "📊 Final analytics sync failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Export final analytics before stopping
    const finalExport = this.exportAnalytics();
    logger.info("📊 Final analytics export:", finalExport);

    logger.info("📊 Socket.IO Analytics Service stopped");
  }
}
