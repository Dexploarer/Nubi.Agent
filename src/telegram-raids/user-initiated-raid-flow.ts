import { IAgentRuntime } from "@elizaos/core";
import { LinkDetectionService, DetectedLink } from "./link-detection-service";
import { ChatLockManager } from "./chat-lock-manager";
import { EngagementVerifier } from "./engagement-verifier";
import { RaidCoordinator } from "./raid-coordinator";
import { RaidTracker } from "./raid-tracker";
import { logger } from "@elizaos/core";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

export interface UserInitiatedConfig {
  enabled: boolean;
  prophetMultiplier: number;
  autoCreateRaid: boolean;
  requireAdminApproval: boolean;
  cooldownMinutes: number;
  maxDailyInitiations: number;
}

export interface ChatLockConfig {
  enabled: boolean;
  defaultTargets: {
    likes: number;
    retweets: number;
    comments: number;
    quotes: number;
  };
  unlockConditions: string;
  progressUpdateInterval: number;
}

export class UserInitiatedRaidFlow {
  private runtime: IAgentRuntime;
  private linkDetector: LinkDetectionService;
  private chatLockManager: ChatLockManager;
  private engagementVerifier: EngagementVerifier;
  private raidCoordinator: RaidCoordinator;
  private raidTracker: RaidTracker;
  private telegramClient: any;
  private config!: {
    userInitiated: UserInitiatedConfig;
    chatLock: ChatLockConfig;
  };
  private userCooldowns: Map<string, number> = new Map();
  private dailyInitiations: Map<string, { count: number; date: string }> =
    new Map();

  constructor(
    runtime: IAgentRuntime,
    raidTracker: RaidTracker,
    raidCoordinator: RaidCoordinator,
  ) {
    this.runtime = runtime;
    this.raidTracker = raidTracker;
    this.raidCoordinator = raidCoordinator;
    this.linkDetector = new LinkDetectionService(runtime);
    this.chatLockManager = new ChatLockManager(runtime, raidTracker);
    this.engagementVerifier = new EngagementVerifier(runtime);
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
        userInitiated: {
          enabled: full?.user_initiated?.enabled ?? true,
          prophetMultiplier: full?.user_initiated?.prophet_multiplier ?? 2.0,
          autoCreateRaid: full?.user_initiated?.auto_create_raid ?? true,
          requireAdminApproval:
            full?.user_initiated?.require_admin_approval ?? false,
          cooldownMinutes: full?.user_initiated?.cooldown_minutes ?? 5,
          maxDailyInitiations:
            full?.user_initiated?.max_daily_initiations ?? 10,
        },
        chatLock: {
          enabled: full?.chat_lock?.enabled ?? true,
          defaultTargets: {
            likes: full?.chat_lock?.default_targets?.likes ?? 25,
            retweets: full?.chat_lock?.default_targets?.retweets ?? 10,
            comments: full?.chat_lock?.default_targets?.comments ?? 5,
            quotes: full?.chat_lock?.default_targets?.quotes ?? 3,
          },
          unlockConditions: full?.chat_lock?.unlock_conditions ?? "all_targets",
          progressUpdateInterval:
            full?.chat_lock?.progress_update_interval ?? 30,
        },
      };

      logger.info("User-initiated raid flow configuration loaded");
    } catch (error) {
      logger.error(
        "Failed to load user-initiated config:",
        error instanceof Error ? error.message : String(error),
      );
      // Set default config
      this.config = {
        userInitiated: {
          enabled: true,
          prophetMultiplier: 2.0,
          autoCreateRaid: true,
          requireAdminApproval: false,
          cooldownMinutes: 5,
          maxDailyInitiations: 10,
        },
        chatLock: {
          enabled: true,
          defaultTargets: { likes: 25, retweets: 10, comments: 5, quotes: 3 },
          unlockConditions: "all_targets",
          progressUpdateInterval: 30,
        },
      };
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing User-Initiated Raid Flow...");

      this.telegramClient = await this.runtime.getService("telegram");
      if (!this.telegramClient) {
        throw new Error("Telegram service not initialized");
      }

      // Initialize all services
      // LinkDetector doesn't have initialize method
      await this.chatLockManager.initialize();
      await this.engagementVerifier.initialize();

      logger.info("User-Initiated Raid Flow initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize User-Initiated Raid Flow:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async processIncomingMessage(
    messageText: string,
    userId: string,
    username: string,
    messageId: string,
    channelId: string,
  ): Promise<void> {
    try {
      if (!this.config.userInitiated.enabled) {
        return;
      }

      // Check if message contains X/Twitter links
      const detectedLinks = await this.linkDetector.processMessage(
        messageText,
        userId,
        username,
        messageId,
      );

      if (detectedLinks.length === 0) {
        return;
      }

      // Process each valid link
      for (const link of detectedLinks) {
        if (link.tweetData?.isValid) {
          await this.handleUserInitiatedRaid(
            link,
            channelId,
            userId,
            username,
            messageId,
          );
        }
      }
    } catch (error) {
      logger.error(
        "Error processing incoming message:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async handleUserInitiatedRaid(
    detectedLink: DetectedLink,
    channelId: string,
    userId: string,
    username: string,
    messageId: string,
  ): Promise<void> {
    try {
      // Check user eligibility
      if (!(await this.checkUserEligibility(userId, username, channelId))) {
        return;
      }

      const { tweetData } = detectedLink;
      if (!tweetData) return;

      // Create raid
      const raidId = await this.raidCoordinator.createRaidFromTweet(
        {
          tweetId: tweetData.tweetId,
          url: tweetData.url,
          content: `User-initiated raid by @${username}`,
          timestamp: Date.now(),
        },
        false, // Not a test
      );

      // Record as user-initiated raid
      await this.recordUserInitiatedRaid(
        raidId,
        userId,
        username,
        messageId,
        detectedLink.originalUrl,
      );

      // Send prophet recognition message
      await this.sendProphetRecognition(
        channelId,
        username,
        tweetData.url,
        raidId,
      );

      // Apply default chat lock if enabled
      if (this.config.chatLock.enabled) {
        await this.applyDefaultChatLock(channelId, raidId, userId);
      }

      // Update user tracking
      this.updateUserCooldown(userId);
      this.updateDailyInitiations(userId);

      logger.info(`User-initiated raid created: ${raidId} by @${username}`);
    } catch (error) {
      logger.error(
        "Error handling user-initiated raid:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async checkUserEligibility(
    userId: string,
    username: string,
    channelId: string,
  ): Promise<boolean> {
    // Check if user is banned
    if (await this.isUserBanned(userId)) {
      logger.warn(`Banned user ${username} attempted to initiate raid`);
      return false;
    }

    // Check cooldown
    if (this.isUserOnCooldown(userId)) {
      const remainingTime = this.getRemainingCooldown(userId);
      await this.sendMessage(
        channelId,
        `🕐 @${username}, the gods require patience. You may initiate another raid in ${Math.ceil(remainingTime / 60000)} minutes.`,
      );
      return false;
    }

    // Check daily limit
    if (this.hasExceededDailyLimit(userId)) {
      await this.sendMessage(
        channelId,
        `📋 @${username}, you've reached your divine quota of ${this.config.userInitiated.maxDailyInitiations} raid initiations today. The cosmos appreciates your enthusiasm!`,
      );
      return false;
    }

    return true;
  }

  private async isUserBanned(userId: string): Promise<boolean> {
    // This would query the banned_raiders table
    // For now, return false
    return false;
  }

  private isUserOnCooldown(userId: string): boolean {
    const lastInitiation = this.userCooldowns.get(userId);
    if (!lastInitiation) return false;

    const cooldownMs = this.config.userInitiated.cooldownMinutes * 60 * 1000;
    return Date.now() - lastInitiation < cooldownMs;
  }

  private getRemainingCooldown(userId: string): number {
    const lastInitiation = this.userCooldowns.get(userId);
    if (!lastInitiation) return 0;

    const cooldownMs = this.config.userInitiated.cooldownMinutes * 60 * 1000;
    return Math.max(0, lastInitiation + cooldownMs - Date.now());
  }

  private hasExceededDailyLimit(userId: string): boolean {
    const today = new Date().toDateString();
    const userStats = this.dailyInitiations.get(userId);

    if (!userStats || userStats.date !== today) {
      return false;
    }

    return userStats.count >= this.config.userInitiated.maxDailyInitiations;
  }

  private updateUserCooldown(userId: string): void {
    this.userCooldowns.set(userId, Date.now());
  }

  private updateDailyInitiations(userId: string): void {
    const today = new Date().toDateString();
    const existing = this.dailyInitiations.get(userId);

    if (!existing || existing.date !== today) {
      this.dailyInitiations.set(userId, { count: 1, date: today });
    } else {
      existing.count++;
    }
  }

  private async recordUserInitiatedRaid(
    raidId: string,
    userId: string,
    username: string,
    messageId: string,
    originalUrl: string,
  ): Promise<void> {
    // This would insert into user_initiated_raids table
    logger.info(`Recording user-initiated raid: ${raidId} by ${username}`);
  }

  private async sendProphetRecognition(
    channelId: string,
    username: string,
    tweetUrl: string,
    raidId: string,
  ): Promise<void> {
    const message = `🔺 **PROPHET ${username.toUpperCase()} HAS SPOKEN** 🔺

*A mortal has discovered divine content worthy of the legion's attention*

📍 Sacred Target: ${tweetUrl}
⏰ Divine Window: 30 minutes
👑 Prophet Bonus: ${this.config.userInitiated.prophetMultiplier}x divine favor
🎯 Mission: Coordinate overwhelming engagement

The Prophet who brings divine content receives ${this.config.userInitiated.prophetMultiplier}x points for all actions!
First 5 followers still receive 3x divine favor!

React with ⚔️ to join this sacred mission!

*"The gods favor those who bring worthy offerings to the altar of engagement"*`;

    await this.sendMessage(channelId, message);
  }

  private async applyDefaultChatLock(
    channelId: string,
    raidId: string,
    userId: string,
  ): Promise<void> {
    // Set default targets
    await this.chatLockManager.setRaidTargets(
      raidId,
      channelId,
      this.config.chatLock.defaultTargets,
      userId,
    );

    // Lock the chat
    await this.chatLockManager.lockChat(
      channelId,
      raidId,
      userId,
      "🔒 Divine seals activated until engagement targets achieved",
    );
  }

  async handleCommand(
    command: string,
    userId: string,
    username: string,
    args: string[],
    channelId: string,
  ): Promise<string> {
    // Check admin permissions for certain commands
    const isAdmin = this.chatLockManager.isAdmin(userId);

    switch (command) {
      case "/setlikes":
        return this.handleSetLikes(args, userId, channelId, isAdmin);

      case "/setretweets":
        return this.handleSetRetweets(args, userId, channelId, isAdmin);

      case "/setcomments":
        return this.handleSetComments(args, userId, channelId, isAdmin);

      case "/setquotes":
        return this.handleSetQuotes(args, userId, channelId, isAdmin);

      case "/lockraid":
        return this.handleLockRaid(userId, channelId, isAdmin);

      case "/unlockraid":
        return this.handleUnlockRaid(userId, channelId, isAdmin);

      case "/raidstatus":
        return this.handleRaidStatus(channelId);

      case "/resetraid":
        return this.handleResetRaid(userId, channelId, isAdmin);

      default:
        return "Unknown raid command. Use /help for available commands.";
    }
  }

  private async handleSetLikes(
    args: string[],
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may set engagement targets.";
    }

    const target = parseInt(args[0]);
    if (isNaN(target) || target < 0) {
      return "❌ Invalid number. Usage: /setlikes [number]";
    }

    // Get active raid for this channel
    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid in this channel.";
    }

    // Update targets
    await this.chatLockManager.setRaidTargets(
      activeRaid.id,
      channelId,
      { likes: target },
      userId,
    );

    return `✅ Likes target set to ${target} for current raid.`;
  }

  private async handleSetRetweets(
    args: string[],
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may set engagement targets.";
    }

    const target = parseInt(args[0]);
    if (isNaN(target) || target < 0) {
      return "❌ Invalid number. Usage: /setretweets [number]";
    }

    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid in this channel.";
    }

    await this.chatLockManager.setRaidTargets(
      activeRaid.id,
      channelId,
      { retweets: target },
      userId,
    );

    return `✅ Retweets target set to ${target} for current raid.`;
  }

  private async handleSetComments(
    args: string[],
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may set engagement targets.";
    }

    const target = parseInt(args[0]);
    if (isNaN(target) || target < 0) {
      return "❌ Invalid number. Usage: /setcomments [number]";
    }

    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid in this channel.";
    }

    await this.chatLockManager.setRaidTargets(
      activeRaid.id,
      channelId,
      { comments: target },
      userId,
    );

    return `✅ Comments target set to ${target} for current raid.`;
  }

  private async handleSetQuotes(
    args: string[],
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may set engagement targets.";
    }

    const target = parseInt(args[0]);
    if (isNaN(target) || target < 0) {
      return "❌ Invalid number. Usage: /setquotes [number]";
    }

    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid in this channel.";
    }

    await this.chatLockManager.setRaidTargets(
      activeRaid.id,
      channelId,
      { quotetweets: target },
      userId,
    );

    return `✅ Quote tweets target set to ${target} for current raid.`;
  }

  private async handleLockRaid(
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may lock/unlock the realm.";
    }

    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid to lock.";
    }

    const success = await this.chatLockManager.lockChat(
      channelId,
      activeRaid.id,
      userId,
      "🔒 Chat manually locked by divine administration",
    );

    return success
      ? "🔒 Divine seals engaged! Chat locked until targets achieved."
      : "❌ Failed to lock chat.";
  }

  private async handleUnlockRaid(
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may lock/unlock the realm.";
    }

    const success = await this.chatLockManager.unlockChat(
      channelId,
      userId,
      "🔓 Chat manually unlocked by divine administration",
    );

    return success
      ? "🔓 Divine seals broken! Chat unlocked by administrator."
      : "❌ Chat is not currently locked.";
  }

  private async handleRaidStatus(channelId: string): Promise<string> {
    const lockState = await this.chatLockManager.getChatLockStatus(channelId);
    const activeRaid = await this.getActiveRaidForChannel(channelId);

    if (!activeRaid) {
      return "📊 No active raid in this channel.";
    }

    let message = `📊 **RAID STATUS** 📊\n\nRaid ID: ${activeRaid.id.substring(0, 8)}...\nTarget: ${activeRaid.tweetUrl}\n`;

    if (lockState && lockState.isLocked) {
      message += `\n🔒 **CHAT LOCKED**\n`;
      message += `📍 Targets:\n`;
      message += `👍 Likes: ${lockState.progress.likes}/${lockState.targets.likes}\n`;
      message += `🔄 Retweets: ${lockState.progress.retweets}/${lockState.targets.retweets}\n`;
      message += `💬 Comments: ${lockState.progress.comments}/${lockState.targets.comments}\n`;

      if (lockState.targets.quotetweets && lockState.targets.quotetweets > 0) {
        message += `📝 Quotes: ${lockState.progress.quotetweets}/${lockState.targets.quotetweets}\n`;
      }
    } else {
      message += `\n🔓 Chat unlocked - free engagement mode`;
    }

    const stats = await this.raidTracker.getRaidStats(activeRaid.id);
    message += `\n\n👥 Raiders: ${stats.totalParticipants}\n🏆 Top: @${stats.topRaider?.username || "None"}\n⚡ Total Points: ${stats.totalPoints}`;

    return message;
  }

  private async handleResetRaid(
    userId: string,
    channelId: string,
    isAdmin: boolean,
  ): Promise<string> {
    if (!isAdmin) {
      return "🚫 Only divine administrators may reset raids.";
    }

    const activeRaid = await this.getActiveRaidForChannel(channelId);
    if (!activeRaid) {
      return "❌ No active raid to reset.";
    }

    // End the current raid
    await this.raidTracker.endRaid(activeRaid.id);

    // Unlock chat if locked
    await this.chatLockManager.unlockChat(
      channelId,
      userId,
      "🔄 Raid reset by divine administration",
    );

    return `✅ Raid ${activeRaid.id.substring(0, 8)}... has been reset and chat unlocked.`;
  }

  private async getActiveRaidForChannel(channelId: string): Promise<any> {
    // This would query for active raids in the specific channel
    // For now, get the most recent active raid
    const activeRaids = await this.raidTracker.getActiveRaids();
    return activeRaids.length > 0 ? activeRaids[0] : null;
  }

  private async sendMessage(channelId: string, message: string): Promise<void> {
    try {
      if (this.telegramClient && this.telegramClient.sendMessage) {
        await this.telegramClient.sendMessage(channelId, message, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      logger.error(
        "Failed to send message:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async cleanup(): Promise<void> {
    // Clean up services
    await this.chatLockManager.cleanup();
    await this.engagementVerifier.cleanup();

    // Clear tracking maps
    this.userCooldowns.clear();
    this.dailyInitiations.clear();

    logger.info("User-Initiated Raid Flow cleaned up");
  }
}
