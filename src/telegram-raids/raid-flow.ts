import { IAgentRuntime } from "@elizaos/core";
import { XPostingService } from "../x-integration/x-posting-service";
import { XContentGenerator } from "../x-integration/x-content-generator";
import { RaidCoordinator } from "./raid-coordinator";
import { RaidTracker } from "./raid-tracker";
import { LeaderboardService } from "./leaderboard-service";
import { UserInitiatedRaidFlow } from "./user-initiated-raid-flow";
import { RaidModerationService } from "./raid-moderation-service";
import { ChatLockManager } from "./chat-lock-manager";
import { EngagementVerifier } from "./engagement-verifier";
import { logger } from "@elizaos/core";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

export interface RaidFlowConfig {
  enabled: boolean;
  postInterval: number; // hours
  autoRaid: boolean;
  testMode: boolean;
  maxConcurrentRaids: number;
}

export class AnubisRaidFlow {
  private runtime: IAgentRuntime;
  private xService: XPostingService;
  private xContentGen: XContentGenerator;
  private raidCoordinator: RaidCoordinator;
  private raidTracker: RaidTracker;
  private leaderboardService: LeaderboardService;
  private userInitiatedFlow: UserInitiatedRaidFlow;
  private moderationService: RaidModerationService;
  private chatLockManager: ChatLockManager;
  private engagementVerifier: EngagementVerifier;
  private config!: RaidFlowConfig;
  private isRunning: boolean = false;
  private postingTimer: NodeJS.Timeout | null = null;
  private activeRaidCount: number = 0;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.xService = new XPostingService(runtime);
    this.xContentGen = new XContentGenerator(runtime);
    this.raidTracker = new RaidTracker();
    this.raidCoordinator = new RaidCoordinator(runtime);
    this.leaderboardService = new LeaderboardService(this.raidTracker);
    this.chatLockManager = new ChatLockManager(runtime, this.raidTracker);
    this.engagementVerifier = new EngagementVerifier(runtime);
    this.userInitiatedFlow = new UserInitiatedRaidFlow(
      runtime,
      this.raidTracker,
      this.raidCoordinator,
    );
    this.moderationService = new RaidModerationService(
      runtime,
      this.raidTracker,
      this.chatLockManager,
    );
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(
        process.cwd(),
        "configs",
        "raid-config.yaml",
      );
      const configContent = fs.readFileSync(configPath, "utf8");
      const full = yaml.load(configContent) as any;

      this.config = {
        enabled: Boolean(full?.x_posting?.enabled),
        postInterval: Number(full?.x_posting?.post_interval_hours ?? 4),
        autoRaid: Boolean(full?.raid?.auto_create),
        testMode: process.env.RAID_TEST_MODE === "true",
        maxConcurrentRaids: Number(
          full?.raid?.max_participants
            ? Math.max(
                1,
                Math.min(
                  10,
                  Math.floor((full.raid.max_participants || 3) / 10),
                ),
              )
            : 3,
        ),
      };

      logger.info("Raid flow configuration loaded");
    } catch (error) {
      logger.error("Failed to load raid flow config:", error);
      this.config = {
        enabled: false,
        postInterval: 4,
        autoRaid: true,
        testMode: true,
        maxConcurrentRaids: 3,
      };
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Anubis Raid Flow...");

      // Initialize all services
      await this.xService.initialize();
      await this.raidTracker.initialize();
      await this.raidCoordinator.initialize();
      await this.chatLockManager.initialize();
      await this.engagementVerifier.initialize();
      await this.userInitiatedFlow.initialize();
      await this.moderationService.initialize();

      logger.info("All raid flow services initialized successfully");

      // Set up Telegram command handlers
      this.setupCommandHandlers();

      // Start automated posting if enabled
      if (this.config.enabled && !this.config.testMode) {
        this.startAutomatedPosting();
      }

      this.isRunning = true;
    } catch (error) {
      logger.error("Failed to initialize raid flow:", error);
      throw error;
    }
  }

  private setupCommandHandlers(): void {
    // This would integrate with the Telegram bot to handle commands
    // The actual integration would be done in the Telegram plugin
    logger.info(
      "Command handlers set up for user-initiated raids and moderation",
    );
  }

  async handleIncomingMessage(
    messageText: string,
    userId: string,
    username: string,
    messageId: string,
    channelId: string,
  ): Promise<void> {
    try {
      // Process message for X links (user-initiated raids)
      await this.userInitiatedFlow.processIncomingMessage(
        messageText,
        userId,
        username,
        messageId,
        channelId,
      );
    } catch (error) {
      logger.error("Error handling incoming message:", error);
    }
  }

  async executeRaidCycle(): Promise<void> {
    try {
      // Check if we're at max concurrent raids
      const activeRaids = await this.raidTracker.getActiveRaids();
      if (activeRaids.length >= this.config.maxConcurrentRaids) {
        logger.info(
          `Max concurrent raids (${this.config.maxConcurrentRaids}) reached, skipping cycle`,
        );
        return;
      }

      logger.info("Starting new raid cycle...");

      // Step 1: Generate and post to X
      const content = await this.xContentGen.generateContent();
      const xPost = await this.xService.postToX(content);
      logger.info(`Posted to X: ${xPost.url}`);

      // Step 2: Wait for post to propagate
      await this.wait(5000); // 5 seconds

      // Step 3: Create Telegram raid if auto-raid is enabled
      if (this.config.autoRaid) {
        const raidId = await this.raidCoordinator.createRaidFromTweet(
          xPost,
          this.config.testMode,
        );
        logger.info(`Raid created in Telegram: ${raidId}`);

        // Step 4: Monitor engagement (runs in background)
        this.monitorEngagement(xPost.tweetId, raidId);
      }

      this.activeRaidCount++;
      logger.info("Raid cycle completed successfully");
    } catch (error) {
      logger.error("Raid cycle failed:", error);
      // Continue running despite errors
    }
  }

  private async monitorEngagement(
    tweetId: string,
    raidId: string,
  ): Promise<void> {
    // This would integrate with Twitter API to monitor engagement
    // For now, we'll simulate monitoring
    logger.info(
      `Monitoring engagement for tweet ${tweetId} and raid ${raidId}`,
    );

    // Check engagement every minute
    const checkInterval = setInterval(async () => {
      try {
        const raid = await this.raidTracker.getRaid(raidId);
        if (!raid || raid.status !== "active") {
          clearInterval(checkInterval);
          this.activeRaidCount--;
          return;
        }

        // Here we would check Twitter API for new engagements
        // and update raid participants accordingly
        logger.debug(`Checking engagement for raid ${raidId}`);
      } catch (error) {
        logger.error("Error monitoring engagement:", error);
      }
    }, 60000); // Every minute
  }

  private startAutomatedPosting(): void {
    if (this.postingTimer) {
      clearInterval(this.postingTimer);
    }

    const intervalMs = this.config.postInterval * 60 * 60 * 1000; // Convert hours to ms

    // Execute immediately, then on interval
    this.executeRaidCycle();

    this.postingTimer = setInterval(() => {
      this.executeRaidCycle();
    }, intervalMs);

    logger.info(
      `Automated posting started with ${this.config.postInterval} hour interval`,
    );
  }

  async handleCommand(
    command: string,
    userId: string,
    username: string,
    args: string[],
    channelId: string = "default",
  ): Promise<string> {
    // Check for moderation commands first
    const moderationCommands = [
      "/banraider",
      "/unbanraider",
      "/warnraider",
      "/raiderstatus",
      "/resetraid",
      "/forceunlock",
      "/clearpoints",
      "/modlog",
      "/bannedlist",
    ];

    if (moderationCommands.includes(command)) {
      return this.moderationService.handleModerationCommand(
        command,
        userId,
        username,
        args,
        channelId,
      );
    }

    // Check for user-initiated raid commands
    const userRaidCommands = [
      "/setlikes",
      "/setretweets",
      "/setcomments",
      "/setquotes",
      "/lockraid",
      "/unlockraid",
      "/raidstatus",
    ];

    if (userRaidCommands.includes(command)) {
      return this.userInitiatedFlow.handleCommand(
        command,
        userId,
        username,
        args,
        channelId,
      );
    }

    // Handle traditional raid commands
    switch (command) {
      case "/raid":
      case "/join":
        return this.handleJoinRaid(userId, username);

      case "/leaderboard":
      case "/top":
        return this.handleLeaderboard(args[0] ? parseInt(args[0]) : 10);

      case "/mystats":
      case "/stats":
        return this.handleUserStats(userId);

      case "/achievements":
        return this.handleAchievements(userId);

      case "/help":
        return this.handleHelp();

      case "/next":
        return this.handleNextRaid();

      case "/active":
        return this.handleActiveRaids();

      case "/verify":
        return this.handleVerifyEngagement(userId, username, args);

      default:
        return "Unknown command. Use /help for available commands.";
    }
  }

  private async handleJoinRaid(
    userId: string,
    username: string,
  ): Promise<string> {
    const activeRaids = await this.raidTracker.getActiveRaids();

    if (activeRaids.length === 0) {
      return "❌ No active raids at the moment. Stay tuned for the next mission!";
    }

    // Join the most recent raid
    const latestRaid = activeRaids[0];
    return await this.raidCoordinator.handleRaidJoin(
      userId,
      username,
      latestRaid.id,
    );
  }

  private async handleLeaderboard(limit: number): Promise<string> {
    return await this.leaderboardService.formatLeaderboard(limit);
  }

  private async handleUserStats(userId: string): Promise<string> {
    return await this.leaderboardService.getUserStats(userId);
  }

  private async handleAchievements(userId: string): Promise<string> {
    return await this.leaderboardService.formatAchievements(userId);
  }

  private handleHelp(): string {
    return `⚔️ **ANUBIS RAID BOT COMMANDS** ⚔️

**🎯 Basic Raid Commands:**
/raid - Join the current active raid
/active - View all active raids
/verify [engagement_type] - Verify your engagement

**📊 Stats & Rankings:**
/leaderboard - View top 10 raiders
/leaderboard [n] - View top N raiders
/mystats - View your personal statistics
/achievements - View your unlocked achievements

**🔗 User-Initiated Raids:**
Just post an X/Twitter link to auto-create a raid!
You'll become a Prophet with 2x bonus points!

**🎮 Chat Lock Commands (Admins):**
/setlikes [number] - Set like target
/setretweets [number] - Set retweet target
/setcomments [number] - Set comment target
/lockraid - Lock chat until targets met
/unlockraid - Manually unlock chat
/raidstatus - Check current raid status

**🛡️ Moderation (Mods/Admins):**
/banraider [user] [reason] - Ban from raids
/unbanraider [user] [reason] - Unban user
/warnraider [user] [message] - Issue warning
/raiderstatus [user] - Check user status
/resetraid - Reset current raid
/forceunlock - Force unlock chat
/modlog [count] - View mod actions
/bannedlist - View banned users

**📱 Information:**
/next - When is the next raid?
/help - Show this help message

**🎯 How to Raid:**
1. Wait for raid announcement OR post X link
2. Click the target link
3. Like, Retweet, and Comment
4. Verify with /verify like (or /raid for auto-join)
5. Earn points and climb the leaderboard!

**💯 Point System:**
• Like: 1 point
• Retweet: 2 points
• Reply: 3 points
• Quote Tweet: 5 points

**⚡ Speed Bonuses:**
• First 5: 3x multiplier
• First 10: 2x multiplier
• First 25: 1.5x multiplier
• Prophet (link poster): 2x multiplier

**🔒 Chat Lock System:**
When targets are set, chat locks until goals achieved!
Only verified engagement counts toward unlock.

The divine legion coordinates as one! 🔥`;
  }

  private async handleNextRaid(): Promise<string> {
    if (!this.config.enabled) {
      return "🔮 Automated raids are currently disabled. Raids will be announced manually!";
    }

    const activeRaids = await this.raidTracker.getActiveRaids();
    if (activeRaids.length > 0) {
      const timeLeft = Math.ceil((activeRaids[0].endTime - Date.now()) / 60000);
      return `⚔️ Active raid in progress! ${timeLeft} minutes remaining.\n\nNext raid will start after current raids complete.`;
    }

    // Calculate next raid time based on interval
    const nextRaidTime = new Date(
      Date.now() + this.config.postInterval * 60 * 60 * 1000,
    );
    const timeUntil = Math.ceil((nextRaidTime.getTime() - Date.now()) / 60000);

    if (timeUntil < 60) {
      return `🔥 Next raid starting in ${timeUntil} minutes! Get ready!`;
    } else {
      const hours = Math.floor(timeUntil / 60);
      const minutes = timeUntil % 60;
      return `⏰ Next raid in approximately ${hours}h ${minutes}m\n\nStay alert, warrior! 🗡️`;
    }
  }

  private async handleActiveRaids(): Promise<string> {
    const activeRaids = await this.raidTracker.getActiveRaids();

    if (activeRaids.length === 0) {
      return "📊 No active raids at the moment.";
    }

    let message = "🔥 **ACTIVE RAIDS** 🔥\n\n";

    for (const raid of activeRaids) {
      const timeLeft = Math.ceil((raid.endTime - Date.now()) / 60000);
      const stats = await this.raidTracker.getRaidStats(raid.id);

      message += `📍 Raid: ${raid.id.substring(0, 8)}...\n`;
      message += `🔗 Target: ${raid.tweetUrl}\n`;
      message += `👥 Raiders: ${stats.totalParticipants}\n`;
      message += `⏱️ Time left: ${timeLeft} minutes\n`;
      message += `🏆 Leader: @${stats.topRaider?.username || "None"}\n\n`;
    }

    return message;
  }

  private async handleVerifyEngagement(
    userId: string,
    username: string,
    args: string[],
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: /verify [like|retweet|reply|quote] - Verify your engagement with the current raid target";
    }

    const engagementType = args[0].toLowerCase();
    const validTypes = ["like", "retweet", "reply", "quote", "quote_tweet"];

    if (!validTypes.includes(engagementType)) {
      return `❌ Invalid engagement type. Use: ${validTypes.join(", ")}`;
    }

    try {
      // Get active raid
      const activeRaids = await this.raidTracker.getActiveRaids();
      if (activeRaids.length === 0) {
        return "❌ No active raids to verify engagement for.";
      }

      const raid = activeRaids[0]; // Most recent
      const tweetId = this.extractTweetIdFromUrl(raid.tweetUrl);

      if (!tweetId) {
        return "❌ Invalid raid target URL.";
      }

      // Check if user is banned
      if (await this.moderationService.isUserBanned(userId)) {
        return "🚫 You are banned from participating in raids.";
      }

      // Verify engagement
      const verification = await this.engagementVerifier.verifyEngagement(
        tweetId,
        userId,
        username,
        engagementType as any,
      );

      if (!verification.verified) {
        return `❌ ${verification.reason || "Engagement verification failed. Please ensure you completed the action and try again."}`;
      }

      // Join raid if not already joined
      await this.raidTracker.joinRaid(raid.id, userId, username);

      // Record the verified action
      await this.raidTracker.recordAction(
        raid.id,
        userId,
        engagementType,
        verification.points,
      );

      // Update chat lock progress if applicable
      const progressUpdate: any = {};
      progressUpdate[`${engagementType}s`] = 1; // likes, retweets, etc.

      // Find the channel this raid belongs to (simplified)
      const channelId = "default"; // This would need proper channel tracking
      await this.chatLockManager.updateProgress(channelId, progressUpdate);

      return `✅ **${engagementType.toUpperCase()} VERIFIED!** ⚡\n\nYou earned **${verification.points} divine points** for your ${engagementType}!\n\n*The cosmic algorithms have registered your devotion.*`;
    } catch (error) {
      logger.error("Error verifying engagement:", error);
      return "❌ Verification service temporarily unavailable. Please try again later.";
    }
  }

  private extractTweetIdFromUrl(url: string): string | null {
    const match = url.match(
      /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/,
    );
    return match ? match[1] : null;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    logger.info("Stopping Anubis Raid Flow...");

    this.isRunning = false;

    if (this.postingTimer) {
      clearInterval(this.postingTimer);
      this.postingTimer = null;
    }

    await this.raidCoordinator.cleanup();
    await this.raidTracker.cleanup();
    await this.chatLockManager.cleanup();
    await this.engagementVerifier.cleanup();
    await this.userInitiatedFlow.cleanup();
    await this.moderationService.cleanup();

    logger.info("Anubis Raid Flow stopped");
  }

  async manualPost(): Promise<string> {
    try {
      logger.info("Executing manual post and raid...");
      await this.executeRaidCycle();
      return "Manual raid cycle executed successfully!";
    } catch (error) {
      logger.error("Manual post failed:", error);
      return "Failed to execute manual raid cycle.";
    }
  }

  // Getters for external access to services
  getUserInitiatedFlow(): UserInitiatedRaidFlow {
    return this.userInitiatedFlow;
  }

  getModerationService(): RaidModerationService {
    return this.moderationService;
  }

  getChatLockManager(): ChatLockManager {
    return this.chatLockManager;
  }

  getEngagementVerifier(): EngagementVerifier {
    return this.engagementVerifier;
  }
}
