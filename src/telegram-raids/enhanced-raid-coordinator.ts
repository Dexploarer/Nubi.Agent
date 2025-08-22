/**
 * Enhanced Raid Coordinator with Interactive Buttons
 *
 * Integrates with OptimizedTelegramService to provide:
 * - Interactive raid participation
 * - Real-time engagement tracking
 * - Automated verification workflows
 * - Performance analytics
 */

import { IAgentRuntime, logger, Service } from "@elizaos/core";
import { InlineKeyboardButton } from "telegraf/types";
import OptimizedTelegramService from "./optimized-telegram-service";
import { RaidTracker, RaidSession, RaidParticipant } from "./raid-tracker";
import { EngagementVerifier } from "./engagement-verifier";
import { LeaderboardService } from "./leaderboard-service";

export interface EnhancedRaidConfig {
  duration: number; // minutes
  minParticipants: number;
  maxParticipants: number;
  scoring: {
    like: number;
    retweet: number;
    reply: number;
    quote_tweet: number;
  };
  bonuses: {
    earlyJoiner: number; // First 10 participants
    speedBonus: number; // Complete actions within 5 minutes
    verificationBonus: number; // Successfully verify engagement
  };
  autoVerification: boolean;
  cooldownPeriod: number; // minutes between raids
  [key: string]: any; // Add index signature for Metadata compatibility
}

export interface RaidMetrics {
  totalEngagements: number;
  participantCount: number;
  engagementRate: number; // percentage
  avgResponseTime: number; // seconds
  topPerformers: RaidParticipant[];
}

export class EnhancedRaidCoordinator extends Service {
  static serviceType = "enhanced_raid_coordinator" as const;
  capabilityDescription =
    "Interactive raid coordination with performance optimization";

  protected runtime: IAgentRuntime;
  private telegramService: OptimizedTelegramService;
  private raidTracker: RaidTracker;
  private engagementVerifier: EngagementVerifier;
  private leaderboardService: LeaderboardService;
  public config: EnhancedRaidConfig;
  private analyticsEngineUrl: string;
  private raidCoordinatorUrl: string;

  // Active raid tracking
  private activeRaids: Map<string, RaidSession> = new Map();
  private raidTimers: Map<string, NodeJS.Timeout> = new Map();
  private participantQueue: Map<string, Set<string>> = new Map(); // raidId -> userId set

  constructor(runtime?: IAgentRuntime) {
    super();
    this.runtime = runtime!;
    this.telegramService = new OptimizedTelegramService(runtime!);
    this.raidTracker = new RaidTracker();
    this.engagementVerifier = new EngagementVerifier(runtime!);
    this.leaderboardService = new LeaderboardService(this.raidTracker);

    // Edge function URLs
    this.analyticsEngineUrl =
      process.env.ANALYTICS_ENGINE_URL ||
      "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/analytics-engine";
    this.raidCoordinatorUrl =
      process.env.RAID_COORDINATOR_URL ||
      "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/raid-coordinator";

    this.config = this.loadConfig();
    this.setupEventHandlers();
  }

  private loadConfig(): EnhancedRaidConfig {
    return {
      duration: 30,
      minParticipants: 5,
      maxParticipants: 100,
      scoring: {
        like: 1,
        retweet: 3,
        reply: 5,
        quote_tweet: 7,
      },
      bonuses: {
        earlyJoiner: 2,
        speedBonus: 3,
        verificationBonus: 1,
      },
      autoVerification: true,
      cooldownPeriod: 60,
    };
  }

  private setupEventHandlers(): void {
    // Setup callback handlers for interactive buttons
    this.telegramService.setupCallbackHandlers();
  }

  /**
   * Create a new raid with interactive UI
   */
  async createRaid(
    chatId: string | number,
    postUrl: string,
    customMessage?: string,
  ): Promise<string> {
    const raidId = this.generateRaidId();
    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + this.config.duration * 60 * 1000,
    );

    // Create raid session
    const session: RaidSession = {
      id: raidId,
      tweetId: "", // Will be populated when tweet is created
      tweetUrl: postUrl,
      postUrl,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      participants: new Map(),
      status: "active",
      totalParticipants: 0,
      totalEngagements: 0,
    };

    this.activeRaids.set(raidId, session);
    this.participantQueue.set(raidId, new Set());

    // Send interactive raid announcement
    await this.sendRaidAnnouncement(chatId, session, customMessage);

    // Start raid in edge function coordinator
    const coordResult = await this.callRaidCoordinator("start", {
      sessionId: raidId,
      targetUrl: postUrl,
      platform: "telegram",
      userId: chatId.toString(),
      metadata: {
        duration: this.config.duration,
        maxParticipants: this.config.maxParticipants,
        customMessage,
      },
    });

    if (coordResult) {
      logger.info(`Raid started in coordinator:`, coordResult);
    }

    // Setup raid completion timer
    const timer = setTimeout(
      async () => {
        await this.completeRaid(raidId, chatId);
      },
      this.config.duration * 60 * 1000,
    );

    this.raidTimers.set(raidId, timer);

    // Send periodic updates
    this.scheduleRaidUpdates(raidId, chatId);

    logger.info(`Created raid ${raidId} for ${postUrl}`);
    return raidId;
  }

  /**
   * Send interactive raid announcement
   */
  private async sendRaidAnnouncement(
    chatId: string | number,
    session: RaidSession,
    customMessage?: string,
  ): Promise<void> {
    const message = customMessage || this.generateRaidMessage(session);

    const buttons = this.createRaidButtons(
      session.id,
      session.postUrl || session.tweetUrl,
    );

    await this.telegramService.sendMessageWithButtons(chatId, message, buttons);
  }

  /**
   * Create interactive buttons for raid
   */
  private createRaidButtons(
    raidId: string,
    postUrl: string,
  ): InlineKeyboardButton[][] {
    return [
      // Primary actions
      [
        {
          text: "⚔️ Join Raid",
          callback_data: `raid_join:${raidId}`,
        },
        {
          text: "📊 Live Stats",
          callback_data: `raid_stats:${raidId}`,
        },
      ],
      // Engagement actions
      [
        {
          text: "✅ Mark Complete",
          callback_data: `raid_complete:${raidId}`,
        },
        {
          text: "🔄 Refresh Status",
          callback_data: `raid_refresh:${raidId}`,
        },
      ],
      // External links
      [
        {
          text: "🔗 Open Post",
          url: postUrl,
        },
        {
          text: "🏆 Leaderboard",
          callback_data: "global_leaderboard",
        },
      ],
    ];
  }

  /**
   * Handle user joining raid
   */
  async handleRaidJoin(userId: string, raidId: string): Promise<string> {
    const session = this.activeRaids.get(raidId);
    if (!session) {
      return "❌ Raid not found or has ended";
    }

    if (session.status !== "active") {
      return "❌ This raid is no longer active";
    }

    // Check if user already joined
    if (session.participants.has(userId)) {
      return "✅ You're already in this raid! Go complete your engagements.";
    }

    // Check participant limits
    if (session.participants.size >= this.config.maxParticipants) {
      return "❌ This raid is full. Try joining the next one!";
    }

    // Add participant
    const participant: RaidParticipant = {
      userId,
      username: `user_${userId}`, // This would be fetched from Telegram
      joinedAt: Date.now(),
      actions: [],
      points: 0,
      verified: false,
    };

    // Early joiner bonus
    if (session.participants.size < 10) {
      participant.points += this.config.bonuses.earlyJoiner;
    }

    session.participants.set(userId, participant);
    this.participantQueue.get(raidId)?.add(userId);

    logger.info(`User ${userId} joined raid ${raidId}`);
    return "🎯 You've joined the raid! Complete engagements and mark complete when done.";
  }

  /**
   * Handle raid completion by user
   */
  async handleRaidComplete(userId: string, raidId: string): Promise<string> {
    const session = this.activeRaids.get(raidId);
    if (!session) {
      return "❌ Raid not found";
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      return "❌ You haven't joined this raid yet";
    }

    if (participant.verified) {
      return "✅ You've already completed this raid!";
    }

    // Auto-verification if enabled
    if (this.config.autoVerification) {
      const verification = await this.engagementVerifier.verifyEngagement(
        session.tweetId,
        userId,
        participant.username,
        "like", // default engagement type
      );

      if (verification.verified) {
        participant.verified = true;
        participant.points += verification.points;
        participant.points += this.config.bonuses.verificationBonus;

        // Speed bonus if completed within 5 minutes
        const completionTime = Date.now() - participant.joinedAt.getTime();
        if (completionTime < 5 * 60 * 1000) {
          participant.points += this.config.bonuses.speedBonus;
        }

        session.totalEngagements += verification.engagements || 1;
        await this.updateLeaderboard(participant);

        return `🎉 Verified! You earned ${participant.points} points for this raid.`;
      } else {
        return "❌ Could not verify your engagement. Make sure you've liked/retweeted the post.";
      }
    } else {
      // Manual verification
      participant.verified = true;
      return "✅ Marked complete! Verification will be done manually.";
    }
  }

  /**
   * Get raid statistics
   */
  async getRaidStats(raidId: string): Promise<RaidMetrics | null> {
    const session = this.activeRaids.get(raidId);
    if (!session) return null;

    const participants = Array.from(session.participants.values());
    const verifiedCount = participants.filter((p) => p.verified).length;

    return {
      totalEngagements: session.totalEngagements,
      participantCount: session.participants.size,
      engagementRate: (verifiedCount / session.participants.size) * 100,
      avgResponseTime: this.calculateAvgResponseTime(participants),
      topPerformers: participants
        .sort((a, b) => b.points - a.points)
        .slice(0, 5),
    };
  }

  /**
   * Generate raid announcement message
   */
  private generateRaidMessage(session: RaidSession): string {
    const timeLeft = Math.ceil((session.endTime - Date.now()) / 60000);

    return `🚨 <b>RAID ALERT!</b> 🚨

🎯 <b>Target:</b> ${session.postUrl}
⏰ <b>Duration:</b> ${timeLeft} minutes remaining
👥 <b>Participants:</b> ${session.participants.size}/${this.config.maxParticipants}
🎁 <b>Rewards:</b> Up to ${this.calculateMaxPoints()} points

<b>How to participate:</b>
1️⃣ Click "Join Raid"
2️⃣ Like, retweet, and engage with the post
3️⃣ Click "Mark Complete" when done
4️⃣ Earn points and climb the leaderboard!

⚡ <i>Early joiners get bonus points!</i>`;
  }

  private calculateMaxPoints(): number {
    return (
      Math.max(...Object.values(this.config.scoring)) +
      this.config.bonuses.earlyJoiner +
      this.config.bonuses.speedBonus +
      this.config.bonuses.verificationBonus
    );
  }

  /**
   * Complete a raid and send summary
   */
  private async completeRaid(
    raidId: string,
    chatId: string | number,
  ): Promise<void> {
    const session = this.activeRaids.get(raidId);
    if (!session) return;

    session.status = "completed";
    const stats = await this.getRaidStats(raidId);

    // Send raid data to analytics engine
    const analyticsData = await this.callAnalyticsEngine("calculate", {
      platform: "telegram",
      raidId,
      participants: session.participants?.size || 0,
      totalEngagements: session.totalEngagements || 0,
      duration: this.config.duration,
      metadata: { chatId, targetUrl: session.postUrl },
    });

    if (analyticsData) {
      logger.info(`Analytics recorded for raid ${raidId}:`, analyticsData);
    }

    if (stats) {
      const summary = this.generateRaidSummary(session, stats);
      await this.telegramService.sendMessageWithButtons(chatId, summary, [
        [{ text: "🏆 View Leaderboard", callback_data: "global_leaderboard" }],
      ]);
    }

    // Cleanup
    this.activeRaids.delete(raidId);
    this.participantQueue.delete(raidId);
    const timer = this.raidTimers.get(raidId);
    if (timer) {
      clearTimeout(timer);
      this.raidTimers.delete(raidId);
    }

    logger.info(`Raid ${raidId} completed`);
  }

  private generateRaidSummary(
    session: RaidSession,
    stats: RaidMetrics,
  ): string {
    return `🏁 <b>RAID COMPLETE!</b>

📊 <b>Final Stats:</b>
👥 Participants: ${stats.participantCount}
💥 Total Engagements: ${stats.totalEngagements}
📈 Engagement Rate: ${stats.engagementRate.toFixed(1)}%
⚡ Avg Response: ${stats.avgResponseTime.toFixed(1)}s

🏆 <b>Top Performers:</b>
${stats.topPerformers
  .map((p, i) => `${i + 1}. ${p.username} - ${p.points} pts`)
  .join("\n")}

Great work, raiders! 🎯`;
  }

  /**
   * Call analytics engine for raid metrics
   */
  private async callAnalyticsEngine(action: string, data?: any): Promise<any> {
    try {
      const response = await fetch(this.analyticsEngineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action,
          ...data,
        }),
      });

      if (!response.ok) {
        logger.warn(`Analytics engine error: ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error("Failed to call analytics engine:", error);
      return null;
    }
  }

  /**
   * Call raid coordinator edge function
   */
  private async callRaidCoordinator(action: string, data?: any): Promise<any> {
    try {
      const response = await fetch(this.raidCoordinatorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action,
          ...data,
        }),
      });

      if (!response.ok) {
        logger.warn(`Raid coordinator error: ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error("Failed to call raid coordinator:", error);
      return null;
    }
  }

  private calculateAvgResponseTime(participants: RaidParticipant[]): number {
    if (participants.length === 0) return 0;

    const responseTimes = participants
      .filter((p) => p.verified)
      .map((p) => {
        const lastAction = p.actions[p.actions.length - 1];
        return lastAction ? (lastAction.timestamp - p.joinedAt) / 1000 : 0;
      });

    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  private async updateLeaderboard(participant: RaidParticipant): Promise<void> {
    // Note: LeaderboardService will be updated through RaidTracker when raid completes
    logger.debug(
      `Participant ${participant.userId} earned ${participant.points} points`,
    );
  }

  private scheduleRaidUpdates(raidId: string, chatId: string | number): void {
    // Send periodic updates every 10 minutes
    const updateInterval = setInterval(
      async () => {
        const session = this.activeRaids.get(raidId);
        if (!session || session.status !== "active") {
          clearInterval(updateInterval);
          return;
        }

        const stats = await this.getRaidStats(raidId);
        if (stats) {
          const update = `⏰ Raid Update: ${stats.participantCount} raiders, ${stats.totalEngagements} engagements so far!`;
          // Send update (implementation depends on how you want to handle updates)
        }
      },
      10 * 60 * 1000,
    );
  }

  private generateRaidId(): string {
    return `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async stop(): Promise<void> {
    // Clear all timers
    for (const timer of this.raidTimers.values()) {
      clearTimeout(timer);
    }
    this.raidTimers.clear();

    // Complete active raids
    for (const [raidId] of this.activeRaids) {
      // Mark as cancelled
      const session = this.activeRaids.get(raidId);
      if (session) {
        session.status = "cancelled";
      }
    }

    this.activeRaids.clear();
    this.participantQueue.clear();

    await this.telegramService.stop();
    logger.info("EnhancedRaidCoordinator stopped");
  }
}

export default EnhancedRaidCoordinator;
