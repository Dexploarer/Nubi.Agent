import { IAgentRuntime } from "@elizaos/core";
import { RaidTracker } from "./raid-tracker";
import { ChatLockManager } from "./chat-lock-manager";
import { logger } from "@elizaos/core";

export interface BannedRaider {
  userId: string;
  username: string;
  bannedBy: string;
  bannedAt: Date;
  reason: string;
  banType: "permanent" | "temporary";
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ModerationAction {
  id: string;
  actionType:
    | "ban"
    | "unban"
    | "warn"
    | "reset_raid"
    | "force_unlock"
    | "clear_points";
  targetUserId: string;
  moderatorId: string;
  reason: string;
  timestamp: Date;
  channelId: string;
  raidId?: string;
  metadata?: Record<string, any>;
}

export class RaidModerationService {
  private runtime: IAgentRuntime;
  private raidTracker: RaidTracker;
  private chatLockManager: ChatLockManager;
  private telegramClient: any;
  private bannedUsers: Map<string, BannedRaider> = new Map();
  private moderationLog: ModerationAction[] = [];
  private adminUsers: Set<string> = new Set();
  private moderatorUsers: Set<string> = new Set();

  constructor(
    runtime: IAgentRuntime,
    raidTracker: RaidTracker,
    chatLockManager: ChatLockManager,
  ) {
    this.runtime = runtime;
    this.raidTracker = raidTracker;
    this.chatLockManager = chatLockManager;
    this.loadModerators();
  }

  async initialize(): Promise<void> {
    try {
      this.telegramClient = await this.runtime.getService("telegram");
      if (!this.telegramClient) {
        throw new Error("Telegram service not initialized");
      }

      // Load banned users from database
      await this.loadBannedUsersFromDatabase();

      logger.info("Raid Moderation Service initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize Raid Moderation Service:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private loadModerators(): void {
    // Load admin and moderator IDs from environment
    const adminIds = process.env.TELEGRAM_ADMIN_IDS?.split(",") || [];
    const moderatorIds = process.env.TELEGRAM_MODERATOR_IDS?.split(",") || [];

    adminIds.forEach((id) => {
      this.adminUsers.add(id.trim());
      this.moderatorUsers.add(id.trim()); // Admins are also moderators
    });

    moderatorIds.forEach((id) => this.moderatorUsers.add(id.trim()));

    // Add default admin if specified
    const defaultAdmin = process.env.TELEGRAM_OWNER_ID;
    if (defaultAdmin) {
      this.adminUsers.add(defaultAdmin);
      this.moderatorUsers.add(defaultAdmin);
    }
  }

  isAdmin(userId: string): boolean {
    return this.adminUsers.has(userId);
  }

  isModerator(userId: string): boolean {
    return this.moderatorUsers.has(userId);
  }

  async handleModerationCommand(
    command: string,
    moderatorId: string,
    moderatorUsername: string,
    args: string[],
    channelId: string,
  ): Promise<string> {
    // Check permissions
    if (!this.isModerator(moderatorId)) {
      return "🚫 Insufficient divine authority. Only moderators may use moderation commands.";
    }

    switch (command) {
      case "/banraider":
        return this.handleBanRaider(
          args,
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/unbanraider":
        return this.handleUnbanRaider(
          args,
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/warnraider":
        return this.handleWarnRaider(
          args,
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/raiderstatus":
        return this.handleRaiderStatus(args, moderatorId, channelId);

      case "/resetraid":
        return this.handleResetRaid(
          args,
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/forceunlock":
        return this.handleForceUnlock(
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/clearpoints":
        return this.handleClearPoints(
          args,
          moderatorId,
          moderatorUsername,
          channelId,
        );

      case "/modlog":
        return this.handleModerationLog(args, moderatorId, channelId);

      case "/bannedlist":
        return this.handleBannedList(moderatorId, channelId);

      default:
        return "Unknown moderation command. Available: /banraider, /unbanraider, /warnraider, /raiderstatus, /resetraid, /forceunlock, /clearpoints, /modlog, /bannedlist";
    }
  }

  private async handleBanRaider(
    args: string[],
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (args.length < 2) {
      return "❌ Usage: /banraider [username/userid] [reason]";
    }

    const targetIdentifier = args[0].replace("@", "");
    const reason = args.slice(1).join(" ");

    try {
      // Find user ID (this would require a proper user lookup system)
      const targetUserId = await this.findUserIdByIdentifier(targetIdentifier);
      if (!targetUserId) {
        return `❌ User ${targetIdentifier} not found in raid system.`;
      }

      // Check if already banned
      if (this.bannedUsers.has(targetUserId)) {
        return `⚠️ User ${targetIdentifier} is already banned.`;
      }

      // Create ban record
      const bannedRaider: BannedRaider = {
        userId: targetUserId,
        username: targetIdentifier,
        bannedBy: moderatorId,
        bannedAt: new Date(),
        reason,
        banType: "permanent",
      };

      // Save to database and memory
      await this.saveBannedRaider(bannedRaider);
      this.bannedUsers.set(targetUserId, bannedRaider);

      // Log moderation action
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "ban",
        targetUserId,
        moderatorId,
        reason,
        timestamp: new Date(),
        channelId,
      });

      // Send notification
      await this.sendModerationNotification(
        channelId,
        `🔨 **DIVINE JUDGMENT RENDERED** 🔨\n\n@${targetIdentifier} has been banished from all raids by @${moderatorUsername}\n\n**Reason:** ${reason}\n\n*The gods have spoken.*`,
      );

      logger.info(
        `User ${targetIdentifier} banned by ${moderatorUsername}: ${reason}`,
      );
      return `✅ User @${targetIdentifier} has been permanently banned from raids.`;
    } catch (error) {
      logger.error(
        "Failed to ban raider:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to ban user. Please try again.";
    }
  }

  private async handleUnbanRaider(
    args: string[],
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: /unbanraider [username/userid] [optional reason]";
    }

    const targetIdentifier = args[0].replace("@", "");
    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
      const targetUserId = await this.findUserIdByIdentifier(targetIdentifier);
      if (!targetUserId) {
        return `❌ User ${targetIdentifier} not found.`;
      }

      // Check if actually banned
      const bannedUser = this.bannedUsers.get(targetUserId);
      if (!bannedUser) {
        return `⚠️ User @${targetIdentifier} is not currently banned.`;
      }

      // Remove ban
      await this.removeBannedRaider(targetUserId);
      this.bannedUsers.delete(targetUserId);

      // Log moderation action
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "unban",
        targetUserId,
        moderatorId,
        reason,
        timestamp: new Date(),
        channelId,
      });

      // Send notification
      await this.sendModerationNotification(
        channelId,
        `🌟 **DIVINE MERCY GRANTED** 🌟\n\n@${targetIdentifier} has been pardoned and may rejoin raids\n\n**Reason:** ${reason}\n\n*The gods show compassion.*`,
      );

      logger.info(
        `User ${targetIdentifier} unbanned by ${moderatorUsername}: ${reason}`,
      );
      return `✅ User @${targetIdentifier} has been unbanned and may rejoin raids.`;
    } catch (error) {
      logger.error(
        "Failed to unban raider:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to unban user. Please try again.";
    }
  }

  private async handleWarnRaider(
    args: string[],
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (args.length < 2) {
      return "❌ Usage: /warnraider [username/userid] [warning message]";
    }

    const targetIdentifier = args[0].replace("@", "");
    const warning = args.slice(1).join(" ");

    try {
      const targetUserId = await this.findUserIdByIdentifier(targetIdentifier);
      if (!targetUserId) {
        return `❌ User ${targetIdentifier} not found.`;
      }

      // Log warning
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "warn",
        targetUserId,
        moderatorId,
        reason: warning,
        timestamp: new Date(),
        channelId,
      });

      // Send warning notification
      await this.sendModerationNotification(
        channelId,
        `⚠️ **DIVINE WARNING** ⚠️\n\n@${targetIdentifier}, the gods have issued a warning:\n\n**${warning}**\n\n*Consider this divine guidance to improve your raid conduct.*`,
      );

      logger.info(
        `Warning issued to ${targetIdentifier} by ${moderatorUsername}: ${warning}`,
      );
      return `✅ Warning issued to @${targetIdentifier}.`;
    } catch (error) {
      logger.error(
        "Failed to warn raider:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to issue warning. Please try again.";
    }
  }

  private async handleRaiderStatus(
    args: string[],
    moderatorId: string,
    channelId: string,
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Usage: /raiderstatus [username/userid]";
    }

    const targetIdentifier = args[0].replace("@", "");

    try {
      const targetUserId = await this.findUserIdByIdentifier(targetIdentifier);
      if (!targetUserId) {
        return `❌ User ${targetIdentifier} not found.`;
      }

      // Get user stats
      const userStats = await this.raidTracker.getUserStats(targetUserId);
      const bannedInfo = this.bannedUsers.get(targetUserId);

      let message = `📊 **RAIDER STATUS: @${targetIdentifier}** 📊\n\n`;

      if (bannedInfo) {
        message += `🚫 **BANNED**\n`;
        message += `Banned by: <@${bannedInfo.bannedBy}>\n`;
        message += `Date: ${bannedInfo.bannedAt.toLocaleDateString()}\n`;
        message += `Reason: ${bannedInfo.reason}\n\n`;
      } else {
        message += `✅ **STATUS: ACTIVE**\n\n`;
      }

      message += `**RAID STATISTICS:**\n`;
      message += `🏆 Total Points: ${userStats.totalPoints || 0}\n`;
      message += `⚔️ Raids Participated: ${userStats.raidsParticipated || 0}\n`;
      message += `🥇 Best Raid Score: ${userStats.bestRaidScore || 0}\n`;
      message += `📈 Current Rank: #${userStats.rank || "Unranked"}\n`;

      // Get recent moderation actions
      const recentActions = this.moderationLog
        .filter((action) => action.targetUserId === targetUserId)
        .slice(-3)
        .reverse();

      if (recentActions.length > 0) {
        message += `\n**RECENT MODERATION:**\n`;
        recentActions.forEach((action) => {
          message += `• ${action.actionType.toUpperCase()}: ${action.reason} (${action.timestamp.toLocaleDateString()})\n`;
        });
      }

      return message;
    } catch (error) {
      logger.error(
        "Failed to get raider status:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to retrieve raider status. Please try again.";
    }
  }

  private async handleResetRaid(
    args: string[],
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (!this.isAdmin(moderatorId)) {
      return "🚫 Only divine administrators may reset raids.";
    }

    try {
      // Get active raid for channel
      const activeRaids = await this.raidTracker.getActiveRaids();
      const channelRaid = activeRaids[0]; // For now, assume most recent

      if (!channelRaid) {
        return "❌ No active raid to reset.";
      }

      // End the raid
      await this.raidTracker.endRaid(channelRaid.id);

      // Unlock chat if locked
      await this.chatLockManager.unlockChat(
        channelId,
        moderatorId,
        "🔄 Raid reset by divine administration",
      );

      // Log action
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "reset_raid",
        targetUserId: "system",
        moderatorId,
        reason: "Raid manually reset",
        timestamp: new Date(),
        channelId,
        raidId: channelRaid.id,
      });

      await this.sendModerationNotification(
        channelId,
        `🔄 **RAID RESET** 🔄\n\nRaid ${channelRaid.id.substring(0, 8)}... has been reset by @${moderatorUsername}\n\n*Divine slate wiped clean. Prepare for the next mission.*`,
      );

      return `✅ Raid ${channelRaid.id.substring(0, 8)}... has been reset.`;
    } catch (error) {
      logger.error(
        "Failed to reset raid:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to reset raid. Please try again.";
    }
  }

  private async handleForceUnlock(
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (!this.isAdmin(moderatorId)) {
      return "🚫 Only divine administrators may force unlock chats.";
    }

    try {
      const success = await this.chatLockManager.unlockChat(
        channelId,
        moderatorId,
        "🔓 Chat force unlocked by divine administration",
      );

      if (!success) {
        return "⚠️ Chat was not locked or failed to unlock.";
      }

      // Log action
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "force_unlock",
        targetUserId: "system",
        moderatorId,
        reason: "Chat force unlocked",
        timestamp: new Date(),
        channelId,
      });

      return `✅ Chat has been force unlocked by divine decree.`;
    } catch (error) {
      logger.error(
        "Failed to force unlock:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to force unlock chat. Please try again.";
    }
  }

  private async handleClearPoints(
    args: string[],
    moderatorId: string,
    moderatorUsername: string,
    channelId: string,
  ): Promise<string> {
    if (!this.isAdmin(moderatorId)) {
      return "🚫 Only divine administrators may clear points.";
    }

    if (args.length < 1) {
      return "❌ Usage: /clearpoints [username/userid] [optional reason]";
    }

    const targetIdentifier = args[0].replace("@", "");
    const reason = args.slice(1).join(" ") || "Points cleared by admin";

    try {
      const targetUserId = await this.findUserIdByIdentifier(targetIdentifier);
      if (!targetUserId) {
        return `❌ User ${targetIdentifier} not found.`;
      }

      // This would require a method to clear user points in the leaderboard
      // For now, log the action
      await this.logModerationAction({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        actionType: "clear_points",
        targetUserId,
        moderatorId,
        reason,
        timestamp: new Date(),
        channelId,
      });

      await this.sendModerationNotification(
        channelId,
        `🧹 **DIVINE RESET** 🧹\n\n@${targetIdentifier}'s points have been cleared by @${moderatorUsername}\n\n**Reason:** ${reason}\n\n*The slate is wiped clean.*`,
      );

      return `✅ Points cleared for @${targetIdentifier}.`;
    } catch (error) {
      logger.error(
        "Failed to clear points:",
        error instanceof Error ? error.message : String(error),
      );
      return "❌ Failed to clear points. Please try again.";
    }
  }

  private async handleModerationLog(
    args: string[],
    moderatorId: string,
    channelId: string,
  ): Promise<string> {
    const limit = args[0] ? parseInt(args[0]) : 10;
    const recentActions = this.moderationLog.slice(-limit).reverse();

    if (recentActions.length === 0) {
      return "📝 No moderation actions recorded.";
    }

    let message = `📝 **MODERATION LOG** (Last ${recentActions.length})\n\n`;

    recentActions.forEach((action, index) => {
      message += `${index + 1}. **${action.actionType.toUpperCase()}**\n`;
      message += `   Target: <@${action.targetUserId}>\n`;
      message += `   Moderator: <@${action.moderatorId}>\n`;
      message += `   Reason: ${action.reason}\n`;
      message += `   Date: ${action.timestamp.toLocaleDateString()}\n\n`;
    });

    return message;
  }

  private async handleBannedList(
    moderatorId: string,
    channelId: string,
  ): Promise<string> {
    const banned = Array.from(this.bannedUsers.values());

    if (banned.length === 0) {
      return "📋 No users are currently banned.";
    }

    let message = `🚫 **BANNED RAIDERS** (${banned.length})\n\n`;

    banned.slice(0, 20).forEach((ban, index) => {
      // Limit to 20 for message length
      message += `${index + 1}. @${ban.username}\n`;
      message += `   Banned: ${ban.bannedAt.toLocaleDateString()}\n`;
      message += `   Reason: ${ban.reason}\n\n`;
    });

    if (banned.length > 20) {
      message += `... and ${banned.length - 20} more`;
    }

    return message;
  }

  async isUserBanned(userId: string): Promise<boolean> {
    const bannedUser = this.bannedUsers.get(userId);

    if (!bannedUser) {
      return false;
    }

    // Check if temporary ban has expired
    if (
      bannedUser.banType === "temporary" &&
      bannedUser.expiresAt &&
      bannedUser.expiresAt < new Date()
    ) {
      await this.removeBannedRaider(userId);
      this.bannedUsers.delete(userId);
      return false;
    }

    return true;
  }

  private async findUserIdByIdentifier(
    identifier: string,
  ): Promise<string | null> {
    // This would require a proper user lookup system
    // For now, assume the identifier is the user ID if it's numeric
    if (/^\d+$/.test(identifier)) {
      return identifier;
    }

    // Otherwise, try to find by username in recent raid participants
    // This is a simplified implementation
    return identifier; // Placeholder
  }

  private async logModerationAction(action: ModerationAction): Promise<void> {
    this.moderationLog.push(action);

    // Keep only last 1000 actions in memory
    if (this.moderationLog.length > 1000) {
      this.moderationLog = this.moderationLog.slice(-1000);
    }

    // Save to database
    logger.info(
      `Moderation action logged: ${action.actionType} on ${action.targetUserId} by ${action.moderatorId}`,
    );
  }

  private async sendModerationNotification(
    channelId: string,
    message: string,
  ): Promise<void> {
    try {
      if (this.telegramClient && this.telegramClient.sendMessage) {
        await this.telegramClient.sendMessage(channelId, message, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      logger.error(
        "Failed to send moderation notification:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Database methods (placeholder implementations)
  private async loadBannedUsersFromDatabase(): Promise<void> {
    // Implementation depends on your database setup
    logger.info("Loading banned users from database");
  }

  private async saveBannedRaider(bannedRaider: BannedRaider): Promise<void> {
    // Implementation depends on your database setup
    logger.info(`Saving banned raider: ${bannedRaider.username}`);
  }

  private async removeBannedRaider(userId: string): Promise<void> {
    // Implementation depends on your database setup
    logger.info(`Removing banned raider: ${userId}`);
  }

  async cleanup(): Promise<void> {
    // Save all data to database
    for (const bannedUser of this.bannedUsers.values()) {
      await this.saveBannedRaider(bannedUser);
    }

    // Clear memory
    this.bannedUsers.clear();
    this.moderationLog.length = 0;

    logger.info("Raid Moderation Service cleaned up");
  }
}
