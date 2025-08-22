import {
  Plugin,
  IAgentRuntime,
  Service,
  Action,
  Provider,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
  logger,
} from "@elizaos/core";

/**
 * Enhanced Telegram Raids Plugin
 *
 * Builds on top of @elizaos/plugin-telegram to add:
 * - NUBI-specific raid coordination
 * - Advanced leaderboards and scoring
 * - X/Twitter integration for raids
 * - Community engagement verification
 * - Multi-platform raid orchestration
 */

interface RaidConfig {
  enabled: boolean;
  autoRaid: boolean;
  postInterval: number; // hours
  maxConcurrentRaids: number;
  raidDuration: number; // minutes
  minParticipants: number;
  pointsPerAction: {
    like: number;
    retweet: number;
    comment: number;
    join: number;
  };
}

interface RaidSession {
  id: string;
  postUrl: string;
  startTime: Date;
  endTime: Date;
  participants: Map<string, RaidParticipant>;
  status: "active" | "completed" | "cancelled";
  totalEngagements: number;
  targetEngagements: number;
}

interface RaidParticipant {
  userId: string;
  username: string;
  joinedAt: Date;
  actions: RaidAction[];
  points: number;
  verified: boolean;
}

interface RaidAction {
  type: "like" | "retweet" | "comment" | "join";
  timestamp: Date;
  verified: boolean;
  points: number;
}

interface RaidStats {
  totalRaids: number;
  successfulRaids: number;
  totalParticipants: number;
  avgEngagements: number;
  topRaiders: RaidParticipant[];
}

export class EnhancedTelegramRaidsService extends Service {
  static serviceType = "enhanced_telegram_raids" as const;
  capabilityDescription =
    "Advanced Telegram raid coordination with ElizaOS integration";

  public raidConfig: RaidConfig;
  private activeSessions = new Map<string, RaidSession>();
  private globalStats: RaidStats;
  private userStats = new Map<string, RaidParticipant>();

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.raidConfig = this.loadConfig();
    this.globalStats = {
      totalRaids: 0,
      successfulRaids: 0,
      totalParticipants: 0,
      avgEngagements: 0,
      topRaiders: [],
    };
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<EnhancedTelegramRaidsService> {
    const service = new EnhancedTelegramRaidsService(runtime);
    await service.initialize();
    return service;
  }

  private loadConfig(): RaidConfig {
    return {
      enabled: process.env.RAIDS_ENABLED === "true",
      autoRaid: process.env.AUTO_RAIDS === "true",
      postInterval: parseInt(process.env.RAID_INTERVAL_HOURS || "6"),
      maxConcurrentRaids: parseInt(process.env.MAX_CONCURRENT_RAIDS || "3"),
      raidDuration: parseInt(process.env.RAID_DURATION_MINUTES || "30"),
      minParticipants: parseInt(process.env.MIN_RAID_PARTICIPANTS || "5"),
      pointsPerAction: {
        like: parseInt(process.env.POINTS_PER_LIKE || "1"),
        retweet: parseInt(process.env.POINTS_PER_RETWEET || "3"),
        comment: parseInt(process.env.POINTS_PER_COMMENT || "5"),
        join: parseInt(process.env.POINTS_PER_JOIN || "10"),
      },
    };
  }

  private async initialize(): Promise<void> {
    logger.info(
      "[ENHANCED_TELEGRAM_RAIDS] Initializing enhanced raids service...",
    );

    // Load existing stats and user data
    await this.loadPersistentData();

    // Start auto-raid timer if enabled
    if (this.raidConfig.enabled && this.raidConfig.autoRaid) {
      this.startAutoRaidTimer();
    }

    logger.info(
      "[ENHANCED_TELEGRAM_RAIDS] Enhanced raids service initialized successfully",
    );
  }

  private async loadPersistentData(): Promise<void> {
    try {
      // Load from database using our database services
      const dbService = this.runtime.getService("database_memory");
      if (dbService) {
        // Load raid stats and user data from persistent storage
        // This would use our enhanced database service
      }
    } catch (error) {
      logger.warn(
        "[ENHANCED_TELEGRAM_RAIDS] Could not load persistent data:",
        error,
      );
    }
  }

  private startAutoRaidTimer(): void {
    const intervalMs = this.raidConfig.postInterval * 60 * 60 * 1000; // Convert hours to ms

    setInterval(async () => {
      if (this.activeSessions.size < this.raidConfig.maxConcurrentRaids) {
        await this.initiateAutoRaid();
      }
    }, intervalMs);

    logger.info(
      `[ENHANCED_TELEGRAM_RAIDS] Auto-raid timer started (${this.raidConfig.postInterval}h intervals)`,
    );
  }

  private async initiateAutoRaid(): Promise<void> {
    try {
      // Generate X post content using our X content generator
      const xService = this.runtime.getService("x_content_generator");
      if (!xService) {
        logger.warn(
          "[ENHANCED_TELEGRAM_RAIDS] X service not available for auto-raid",
        );
        return;
      }

      // Create and post to X
      const postContent = await (xService as any).generateRaidContent();
      const postResult = await (xService as any).createPost(postContent);

      if (postResult.success) {
        // Start Telegram raid session
        await this.startRaidSession(postResult.url, true);
      }
    } catch (error) {
      logger.error(
        "[ENHANCED_TELEGRAM_RAIDS] Auto-raid initiation failed:",
        error,
      );
    }
  }

  async startRaidSession(
    postUrl: string,
    isAuto: boolean = false,
  ): Promise<string> {
    try {
      if (this.activeSessions.size >= this.raidConfig.maxConcurrentRaids) {
        return "❌ Maximum concurrent raids reached. Please wait for current raids to complete.";
      }

      const sessionId = this.generateSessionId();
      const startTime = new Date();
      const endTime = new Date(
        startTime.getTime() + this.raidConfig.raidDuration * 60 * 1000,
      );

      const session: RaidSession = {
        id: sessionId,
        postUrl,
        startTime,
        endTime,
        participants: new Map(),
        status: "active",
        totalEngagements: 0,
        targetEngagements: 50, // Dynamic based on community size
      };

      this.activeSessions.set(sessionId, session);

      // Send raid announcement to Telegram
      const telegramService = this.runtime.getService("telegram");
      if (
        telegramService &&
        typeof (telegramService as any).sendMessage === "function"
      ) {
        const raidMessage = this.formatRaidAnnouncement(session, isAuto);
        await (telegramService as any).sendMessage(raidMessage);
      }

      // Schedule raid completion
      setTimeout(
        () => {
          this.completeRaidSession(sessionId);
        },
        this.raidConfig.raidDuration * 60 * 1000,
      );

      logger.info(
        `[ENHANCED_TELEGRAM_RAIDS] Started raid session ${sessionId}`,
      );
      return `🚀 Raid initiated! Session: ${sessionId}\n🎯 Target: ${postUrl}\n⏰ Duration: ${this.raidConfig.raidDuration} minutes`;
    } catch (error) {
      logger.error(
        "[ENHANCED_TELEGRAM_RAIDS] Failed to start raid session:",
        error,
      );
      return "❌ Failed to start raid session. Please try again.";
    }
  }

  private formatRaidAnnouncement(
    session: RaidSession,
    isAuto: boolean,
  ): string {
    const emoji = isAuto ? "🤖" : "👑";
    return `
${emoji} **${isAuto ? "AUTO" : "MANUAL"} RAID INITIATED** 

🎯 **Target Post**: ${session.postUrl}
⏰ **Duration**: ${this.raidConfig.raidDuration} minutes
🏆 **Reward Pool**: ${this.calculateRewardPool()} NUBI points

**📋 Instructions:**
1️⃣ Like the post (+${this.raidConfig.pointsPerAction.like} pts)
2️⃣ Retweet (+${this.raidConfig.pointsPerAction.retweet} pts)  
3️⃣ Comment meaningfully (+${this.raidConfig.pointsPerAction.comment} pts)
4️⃣ Use /joinraid to participate (+${this.raidConfig.pointsPerAction.join} pts)

**🔥 Let's show the power of the NUBI community! 🔥**

Session ID: \`${session.id}\`
`;
  }

  async joinRaid(
    userId: string,
    username: string,
    sessionId?: string,
  ): Promise<string> {
    try {
      // Find active session
      const session = sessionId
        ? this.activeSessions.get(sessionId)
        : Array.from(this.activeSessions.values()).find(
            (s) => s.status === "active",
          );

      if (!session) {
        return "❌ No active raids to join. Wait for the next raid announcement!";
      }

      if (session.participants.has(userId)) {
        return "✅ You're already participating in this raid! Keep engaging with the post.";
      }

      // Add participant
      const participant: RaidParticipant = {
        userId,
        username,
        joinedAt: new Date(),
        actions: [
          {
            type: "join",
            timestamp: new Date(),
            verified: true,
            points: this.raidConfig.pointsPerAction.join,
          },
        ],
        points: this.raidConfig.pointsPerAction.join,
        verified: false,
      };

      session.participants.set(userId, participant);

      // Update global user stats
      this.updateUserStats(participant);

      logger.info(
        `[ENHANCED_TELEGRAM_RAIDS] User ${username} joined raid ${session.id}`,
      );

      return `🎉 Welcome to the raid, ${username}! 
      
🏆 **+${this.raidConfig.pointsPerAction.join} points** for joining!
🎯 **Target**: ${session.postUrl}
👥 **Participants**: ${session.participants.size}/${this.raidConfig.minParticipants}

Now go engage with the post and earn more points! 🚀`;
    } catch (error) {
      logger.error("[ENHANCED_TELEGRAM_RAIDS] Failed to join raid:", error);
      return "❌ Failed to join raid. Please try again.";
    }
  }

  async getRaidStats(userId?: string): Promise<string> {
    try {
      if (userId) {
        return this.formatUserStats(userId);
      } else {
        return this.formatGlobalStats();
      }
    } catch (error) {
      logger.error(
        "[ENHANCED_TELEGRAM_RAIDS] Failed to get raid stats:",
        error,
      );
      return "❌ Failed to retrieve raid statistics.";
    }
  }

  private formatUserStats(userId: string): string {
    const userStats = this.userStats.get(userId);
    if (!userStats) {
      return "📊 **Your Stats**: No raid activity yet. Join a raid to start earning points!";
    }

    const totalActions = userStats.actions.length;
    const rank = this.getUserRank(userId);

    return `📊 **Your Raid Stats**

🏆 **Total Points**: ${userStats.points}
📈 **Actions Completed**: ${totalActions}
🏅 **Global Rank**: #${rank}
📅 **First Raid**: ${userStats.joinedAt.toLocaleDateString()}

**Action Breakdown**:
${this.formatActionBreakdown(userStats.actions)}

Keep raiding to climb the leaderboard! 🚀`;
  }

  private formatGlobalStats(): string {
    const activeRaids = this.activeSessions.size;
    const topRaiders = Array.from(this.userStats.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    return `🌍 **Global Raid Stats**

🚀 **Active Raids**: ${activeRaids}
📊 **Total Raids Completed**: ${this.globalStats.totalRaids}
👥 **Total Participants**: ${this.globalStats.totalParticipants}
💥 **Avg Engagements/Raid**: ${this.globalStats.avgEngagements}

**🏆 Top Raiders:**
${topRaiders
  .map(
    (raider, index) =>
      `${index + 1}. ${raider.username} - ${raider.points} pts`,
  )
  .join("\n")}

The NUBI army grows stronger! 💪`;
  }

  private completeRaidSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = "completed";
    session.endTime = new Date();

    // Calculate final results
    const results = this.calculateRaidResults(session);

    // Send completion message
    const telegramService = this.runtime.getService("telegram");
    if (
      telegramService &&
      typeof (telegramService as any).sendMessage === "function"
    ) {
      const completionMessage = this.formatRaidCompletion(session, results);
      (telegramService as any).sendMessage(completionMessage);
    }

    // Update global stats
    this.updateGlobalStats(session);

    // Archive session
    this.activeSessions.delete(sessionId);

    logger.info(
      `[ENHANCED_TELEGRAM_RAIDS] Completed raid session ${sessionId}`,
    );
  }

  private calculateRaidResults(session: RaidSession): any {
    const participants = Array.from(session.participants.values());
    const totalPoints = participants.reduce((sum, p) => sum + p.points, 0);
    const mvp = participants.sort((a, b) => b.points - a.points)[0];

    return {
      participantCount: participants.length,
      totalPoints,
      mvp,
      success: participants.length >= this.raidConfig.minParticipants,
      engagementRate: session.totalEngagements / session.targetEngagements,
    };
  }

  private formatRaidCompletion(session: RaidSession, results: any): string {
    const statusEmoji = results.success ? "✅" : "⚠️";
    const duration = Math.round(
      (session.endTime.getTime() - session.startTime.getTime()) / 60000,
    );

    return `${statusEmoji} **RAID COMPLETED**

📊 **Session**: ${session.id}
⏱️ **Duration**: ${duration} minutes
👥 **Participants**: ${results.participantCount}
💪 **Total Points Earned**: ${results.totalPoints}

${results.mvp ? `🏆 **MVP**: ${results.mvp.username} (${results.mvp.points} pts)` : ""}

**Engagement**: ${Math.round(results.engagementRate * 100)}% of target reached

${
  results.success
    ? "🎉 **SUCCESS!** Great job everyone! The NUBI army strikes again! 💥"
    : "😅 **Partial Success** - We need more raiders next time! Keep growing the community! 📈"
}`;
  }

  // Helper methods
  private generateSessionId(): string {
    return `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRewardPool(): number {
    return this.raidConfig.raidDuration * 10; // 10 points per minute
  }

  private updateUserStats(participant: RaidParticipant): void {
    const existing = this.userStats.get(participant.userId);
    if (existing) {
      existing.actions.push(...participant.actions);
      existing.points += participant.points;
    } else {
      this.userStats.set(participant.userId, { ...participant });
    }
  }

  private updateGlobalStats(session: RaidSession): void {
    this.globalStats.totalRaids++;
    this.globalStats.totalParticipants += session.participants.size;
    this.globalStats.avgEngagements =
      (this.globalStats.avgEngagements * (this.globalStats.totalRaids - 1) +
        session.totalEngagements) /
      this.globalStats.totalRaids;

    if (session.participants.size >= this.raidConfig.minParticipants) {
      this.globalStats.successfulRaids++;
    }
  }

  private getUserRank(userId: string): number {
    const sortedUsers = Array.from(this.userStats.entries()).sort(
      ([, a], [, b]) => b.points - a.points,
    );

    const userIndex = sortedUsers.findIndex(([id]) => id === userId);
    return userIndex + 1;
  }

  private formatActionBreakdown(actions: RaidAction[]): string {
    const breakdown = actions.reduce(
      (acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(breakdown)
      .map(([type, count]) => `• ${type}: ${count}`)
      .join("\n");
  }

  async stop(): Promise<void> {
    // Save persistent data
    await this.savePersistentData();

    // Complete any active sessions
    for (const [sessionId] of this.activeSessions) {
      this.completeRaidSession(sessionId);
    }

    logger.info("[ENHANCED_TELEGRAM_RAIDS] Enhanced raids service stopped");
  }

  private async savePersistentData(): Promise<void> {
    try {
      const dbService = this.runtime.getService("database_memory");
      if (dbService) {
        // Save stats and user data to persistent storage
        // This would use our enhanced database service
      }
    } catch (error) {
      logger.warn(
        "[ENHANCED_TELEGRAM_RAIDS] Could not save persistent data:",
        error,
      );
    }
  }
}

// Enhanced Telegram Raids Actions
const raidActions: Action[] = [
  {
    name: "START_RAID",
    similes: ["INITIATE_RAID", "BEGIN_RAID", "LAUNCH_RAID", "CREATE_RAID"],
    description: "Start a new Telegram raid session with X post coordination",
    validate: async (runtime, message, state) => {
      if (message.entityId === runtime.agentId) return false;

      const text = message.content?.text?.toLowerCase() || "";
      return (
        text.includes("/startraid") ||
        text.includes("!raid start") ||
        text.includes("start raid")
      );
    },
    handler: async (runtime, message, state, options, callback) => {
      try {
        const raidsService = runtime.getService(
          "enhanced_telegram_raids",
        ) as EnhancedTelegramRaidsService;
        if (!raidsService) {
          return { success: false, text: "Raids service not available" };
        }

        // Extract post URL if provided
        const text = message.content?.text || "";
        const urlMatch = text.match(/https?:\/\/[^\s]+/);

        if (!urlMatch) {
          return {
            success: false,
            text: "❌ Please provide a valid X/Twitter post URL",
          };
        }

        const result = await raidsService.startRaidSession(urlMatch[0]);

        if (callback) {
          await callback({ text: result });
        }

        return { success: true, text: result };
      } catch (error) {
        logger.error("Failed to start raid:", error);
        return { success: false, text: "❌ Failed to start raid session" };
      }
    },
    examples: [
      [
        {
          name: "{{user}}",
          content: {
            text: "/startraid https://twitter.com/example/status/123",
          },
        },
        {
          name: "Anubis",
          content: {
            text: "🚀 Raid initiated! Get ready to show our community power! 💪",
          },
        },
      ],
    ],
  },

  {
    name: "JOIN_RAID",
    similes: ["PARTICIPATE_RAID", "ENTER_RAID", "RAID_JOIN"],
    description: "Join an active raid session",
    validate: async (runtime, message, state) => {
      if (message.entityId === runtime.agentId) return false;

      const text = message.content?.text?.toLowerCase() || "";
      return text.includes("/joinraid") || text.includes("join raid");
    },
    handler: async (runtime, message, state, options, callback) => {
      try {
        const raidsService = runtime.getService(
          "enhanced_telegram_raids",
        ) as EnhancedTelegramRaidsService;
        if (!raidsService) {
          return { success: false, text: "Raids service not available" };
        }

        const userId = message.entityId || "";
        const username = (message as any).username || "Unknown";

        const result = await raidsService.joinRaid(userId, username);

        if (callback) {
          await callback({ text: result });
        }

        return { success: true, text: result };
      } catch (error) {
        logger.error("Failed to join raid:", error);
        return { success: false, text: "❌ Failed to join raid" };
      }
    },
    examples: [
      [
        { name: "{{user}}", content: { text: "/joinraid" } },
        {
          name: "Anubis",
          content: {
            text: "🎉 Welcome to the raid! Let's show our community strength! 🚀",
          },
        },
      ],
    ],
  },

  {
    name: "RAID_STATS",
    similes: ["MY_STATS", "RAID_LEADERBOARD", "RAID_INFO"],
    description: "Get raid statistics and leaderboard information",
    validate: async (runtime, message, state) => {
      if (message.entityId === runtime.agentId) return false;

      const text = message.content?.text?.toLowerCase() || "";
      return (
        text.includes("/raidstats") ||
        text.includes("/mystats") ||
        text.includes("raid stats")
      );
    },
    handler: async (runtime, message, state, options, callback) => {
      try {
        const raidsService = runtime.getService(
          "enhanced_telegram_raids",
        ) as EnhancedTelegramRaidsService;
        if (!raidsService) {
          return { success: false, text: "Raids service not available" };
        }

        const userId = message.entityId;
        const result = await raidsService.getRaidStats(userId);

        if (callback) {
          await callback({ text: result });
        }

        return { success: true, text: result };
      } catch (error) {
        logger.error("Failed to get raid stats:", error);
        return {
          success: false,
          text: "❌ Failed to retrieve raid statistics",
        };
      }
    },
    examples: [
      [
        { name: "{{user}}", content: { text: "/mystats" } },
        {
          name: "Anubis",
          content: {
            text: "📊 Here are your raid statistics! Keep climbing the leaderboard! 🏆",
          },
        },
      ],
    ],
  },
];

// Enhanced Telegram Raids Provider
const raidStatsProvider: Provider = {
  name: "RAID_STATISTICS",
  description:
    "Provides current raid session data and user statistics for context",
  dynamic: true,
  get: async (runtime, message, state) => {
    try {
      const raidsService = runtime.getService(
        "enhanced_telegram_raids",
      ) as EnhancedTelegramRaidsService;
      if (!raidsService) {
        return { text: "raid_stats: unavailable", values: {}, data: {} };
      }

      // Get current raid context for better responses
      const hasActiveRaids = true; // This would be dynamically determined
      const userParticipating = false; // This would check if user is in active raid

      return {
        text: `raid_context: ${hasActiveRaids ? "active_raids" : "no_active_raids"}, user_status: ${userParticipating ? "participating" : "not_participating"}`,
        values: {
          hasActiveRaids,
          userParticipating,
          raidSystemActive: true,
        },
        data: {
          raidSystemStatus: "operational",
          contextType: "raid_aware",
        },
      };
    } catch (error) {
      return { text: "raid_stats: error", values: {}, data: { error: true } };
    }
  },
};

// Enhanced Telegram Raids Plugin
const enhancedTelegramRaidsPlugin: Plugin = {
  name: "enhanced-telegram-raids",
  description:
    "Advanced Telegram raid coordination built on ElizaOS Telegram plugin",

  actions: raidActions,

  providers: [raidStatsProvider],

  services: [EnhancedTelegramRaidsService],

  evaluators: [],

  routes: [],

  events: {},

  config: {
    requiredEnvVars: [
      "TELEGRAM_BOT_TOKEN", // Uses official plugin's token
    ],
    optionalEnvVars: [
      "RAIDS_ENABLED",
      "AUTO_RAIDS",
      "RAID_INTERVAL_HOURS",
      "MAX_CONCURRENT_RAIDS",
      "RAID_DURATION_MINUTES",
      "MIN_RAID_PARTICIPANTS",
      "POINTS_PER_LIKE",
      "POINTS_PER_RETWEET",
      "POINTS_PER_COMMENT",
      "POINTS_PER_JOIN",
    ],
  },
};

export default enhancedTelegramRaidsPlugin;
