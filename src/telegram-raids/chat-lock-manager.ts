import { IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { RaidTracker } from "./raid-tracker";

export interface RaidTargets {
  raidId: string;
  channelId: string;
  likes: number;
  retweets: number;
  comments: number;
  quotetweets?: number;
  setBy: string; // userId who set the targets
  setAt: Date;
  isActive: boolean;
}

export interface ChatLockState {
  channelId: string;
  raidId: string;
  isLocked: boolean;
  lockedAt: Date;
  lockedBy: string; // userId who locked
  reason: string;
  targets: RaidTargets;
  progress: {
    likes: number;
    retweets: number;
    comments: number;
    quotetweets: number;
    lastUpdated: Date;
  };
}

export interface UnlockCondition {
  type: "all_targets" | "any_target" | "minimum_engagement" | "time_based";
  required: boolean;
  threshold?: number;
}

export class ChatLockManager {
  private runtime: IAgentRuntime;
  private raidTracker: RaidTracker;
  private telegramClient: any;
  private lockStates: Map<string, ChatLockState> = new Map();
  private adminUsers: Set<string> = new Set();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(runtime: IAgentRuntime, raidTracker: RaidTracker) {
    this.runtime = runtime;
    this.raidTracker = raidTracker;
    this.loadAdminUsers();
  }

  async initialize(): Promise<void> {
    try {
      this.telegramClient = await this.runtime.getService("telegram");
      if (!this.telegramClient) {
        throw new Error("Telegram service not initialized");
      }

      // Load existing lock states from database
      await this.loadLockStatesFromDatabase();

      logger.info("Chat Lock Manager initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Chat Lock Manager:", error);
      throw error;
    }
  }

  private loadAdminUsers(): void {
    // Load admin user IDs from environment or config
    const adminIds = process.env.TELEGRAM_ADMIN_IDS?.split(",") || [];
    adminIds.forEach((id) => this.adminUsers.add(id.trim()));

    // Add default admin if specified
    const defaultAdmin = process.env.TELEGRAM_OWNER_ID;
    if (defaultAdmin) {
      this.adminUsers.add(defaultAdmin);
    }
  }

  isAdmin(userId: string): boolean {
    return this.adminUsers.has(userId);
  }

  async setRaidTargets(
    raidId: string,
    channelId: string,
    targets: Partial<RaidTargets>,
    setByUserId: string,
  ): Promise<boolean> {
    try {
      if (!this.isAdmin(setByUserId)) {
        logger.warn(
          `Non-admin user ${setByUserId} attempted to set raid targets`,
        );
        return false;
      }

      const raidTargets: RaidTargets = {
        raidId,
        channelId,
        likes: targets.likes || 0,
        retweets: targets.retweets || 0,
        comments: targets.comments || 0,
        quotetweets: targets.quotetweets || 0,
        setBy: setByUserId,
        setAt: new Date(),
        isActive: true,
      };

      // Save to database
      await this.saveRaidTargets(raidTargets);

      logger.info(
        `Raid targets set for ${raidId}: likes=${raidTargets.likes}, retweets=${raidTargets.retweets}, comments=${raidTargets.comments}`,
      );

      return true;
    } catch (error) {
      logger.error("Failed to set raid targets:", error);
      return false;
    }
  }

  async lockChat(
    channelId: string,
    raidId: string,
    lockedByUserId: string,
    reason: string = "🔒 Divine locks engaged until raid targets achieved",
  ): Promise<boolean> {
    try {
      if (!this.isAdmin(lockedByUserId)) {
        logger.warn(`Non-admin user ${lockedByUserId} attempted to lock chat`);
        return false;
      }

      // Get raid targets
      const targets = await this.getRaidTargets(raidId);
      if (!targets) {
        logger.error(`No targets set for raid ${raidId}`);
        return false;
      }

      // Create lock state
      const lockState: ChatLockState = {
        channelId,
        raidId,
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: lockedByUserId,
        reason,
        targets,
        progress: {
          likes: 0,
          retweets: 0,
          comments: 0,
          quotetweets: 0,
          lastUpdated: new Date(),
        },
      };

      // Apply Telegram permissions
      await this.applyTelegramLock(channelId);

      // Store lock state
      this.lockStates.set(channelId, lockState);
      await this.saveLockStateToDatabase(lockState);

      // Start monitoring progress
      this.startProgressMonitoring(channelId, raidId);

      // Send lock notification
      await this.sendLockNotification(channelId, lockState);

      logger.info(`Chat ${channelId} locked for raid ${raidId}`);
      return true;
    } catch (error) {
      logger.error("Failed to lock chat:", error);
      return false;
    }
  }

  async unlockChat(
    channelId: string,
    unlockedByUserId: string,
    reason: string = "🎉 Divine will satisfied - chat unlocked!",
  ): Promise<boolean> {
    try {
      const lockState = this.lockStates.get(channelId);
      if (!lockState || !lockState.isLocked) {
        return false;
      }

      // Remove Telegram permissions
      await this.removeTelegramLock(channelId);

      // Update lock state
      lockState.isLocked = false;
      this.lockStates.set(channelId, lockState);
      await this.saveLockStateToDatabase(lockState);

      // Stop monitoring
      this.stopProgressMonitoring(channelId);

      // Send unlock notification
      await this.sendUnlockNotification(channelId, lockState, reason);

      logger.info(`Chat ${channelId} unlocked by ${unlockedByUserId}`);
      return true;
    } catch (error) {
      logger.error("Failed to unlock chat:", error);
      return false;
    }
  }

  private async applyTelegramLock(channelId: string): Promise<void> {
    try {
      // Restrict all members from sending messages
      // Only admins can send messages during lock
      if (this.telegramClient && this.telegramClient.setChatPermissions) {
        await this.telegramClient.setChatPermissions(channelId, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        });
      }
    } catch (error) {
      logger.error("Failed to apply Telegram lock:", error);
    }
  }

  private async removeTelegramLock(channelId: string): Promise<void> {
    try {
      // Restore normal permissions
      if (this.telegramClient && this.telegramClient.setChatPermissions) {
        await this.telegramClient.setChatPermissions(channelId, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false, // Usually restricted to admins
          can_invite_users: true,
          can_pin_messages: false, // Usually restricted to admins
        });
      }
    } catch (error) {
      logger.error("Failed to remove Telegram lock:", error);
    }
  }

  private startProgressMonitoring(channelId: string, raidId: string): void {
    // Clear any existing monitoring
    this.stopProgressMonitoring(channelId);

    // Monitor progress every 30 seconds
    const interval = setInterval(async () => {
      await this.checkUnlockConditions(channelId, raidId);
    }, 30000);

    this.monitoringIntervals.set(channelId, interval);
  }

  private stopProgressMonitoring(channelId: string): void {
    const interval = this.monitoringIntervals.get(channelId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(channelId);
    }
  }

  async updateProgress(
    channelId: string,
    progress: Partial<ChatLockState["progress"]>,
  ): Promise<void> {
    const lockState = this.lockStates.get(channelId);
    if (!lockState || !lockState.isLocked) {
      return;
    }

    // Update progress
    Object.assign(lockState.progress, progress, { lastUpdated: new Date() });

    // Save to database
    await this.saveLockStateToDatabase(lockState);

    // Check if unlock conditions are met
    await this.checkUnlockConditions(channelId, lockState.raidId);
  }

  private async checkUnlockConditions(
    channelId: string,
    raidId: string,
  ): Promise<void> {
    const lockState = this.lockStates.get(channelId);
    if (!lockState || !lockState.isLocked) {
      return;
    }

    const { targets, progress } = lockState;

    // Check if all targets are met
    const targetsAchieved = {
      likes: progress.likes >= targets.likes,
      retweets: progress.retweets >= targets.retweets,
      comments: progress.comments >= targets.comments,
      quotetweets: progress.quotetweets >= (targets.quotetweets || 0),
    };

    // For now, require ALL targets to be met
    const allTargetsMet = Object.values(targetsAchieved).every(
      (achieved) => achieved,
    );

    if (allTargetsMet) {
      const reason =
        "🎉 ALL DIVINE TARGETS ACHIEVED! The cosmic algorithms smile upon us! 🎉";
      await this.unlockChat(channelId, "system", reason);
    }
  }

  async getChatLockStatus(channelId: string): Promise<ChatLockState | null> {
    return this.lockStates.get(channelId) || null;
  }

  async getAllLockedChats(): Promise<ChatLockState[]> {
    return Array.from(this.lockStates.values()).filter(
      (state) => state.isLocked,
    );
  }

  private async sendLockNotification(
    channelId: string,
    lockState: ChatLockState,
  ): Promise<void> {
    const { targets } = lockState;

    const message = `🔒 **DIVINE LOCK ENGAGED** 🔒

*The gods have spoken - this realm is sealed until mortals prove their devotion*

**UNLOCK REQUIREMENTS:**
${targets.likes > 0 ? `👍 Likes: ${targets.likes}` : ""}
${targets.retweets > 0 ? `🔄 Retweets: ${targets.retweets}` : ""}
${targets.comments > 0 ? `💬 Comments: ${targets.comments}` : ""}
${targets.quotetweets && targets.quotetweets > 0 ? `📝 Quote Tweets: ${targets.quotetweets}` : ""}

*Only when the cosmic algorithms register sufficient engagement will the divine seals break...*

⚔️ **CURRENT PROGRESS** ⚔️
All targets must be achieved to unlock the realm!`;

    await this.sendMessage(channelId, message);
  }

  private async sendUnlockNotification(
    channelId: string,
    lockState: ChatLockState,
    reason: string,
  ): Promise<void> {
    const message = `🌟 **DIVINE SEALS BROKEN!** 🌟

${reason}

*The gods are pleased with your coordination and devotion. The realm flows freely once more.*

**FINAL STATS:**
👍 Likes: ${lockState.progress.likes}/${lockState.targets.likes}
🔄 Retweets: ${lockState.progress.retweets}/${lockState.targets.retweets}
💬 Comments: ${lockState.progress.comments}/${lockState.targets.comments}

The divine legion moves as one! 🔥`;

    await this.sendMessage(channelId, message);
  }

  private async sendMessage(channelId: string, message: string): Promise<void> {
    try {
      if (this.telegramClient && this.telegramClient.sendMessage) {
        await this.telegramClient.sendMessage(channelId, message, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      logger.error("Failed to send lock/unlock notification:", error);
    }
  }

  // Database methods (placeholder - implement based on your database choice)
  private async saveRaidTargets(targets: RaidTargets): Promise<void> {
    // Implementation depends on your database setup
    // For now, we'll store in memory and log
    logger.info("Saving raid targets to database:", JSON.stringify(targets));
  }

  private async getRaidTargets(raidId: string): Promise<RaidTargets | null> {
    // Implementation depends on your database setup
    // For now, return a mock target for testing
    return {
      raidId,
      channelId: "test",
      likes: 10,
      retweets: 5,
      comments: 3,
      setBy: "admin",
      setAt: new Date(),
      isActive: true,
    };
  }

  private async saveLockStateToDatabase(
    lockState: ChatLockState,
  ): Promise<void> {
    // Implementation depends on your database setup
    logger.info(
      "Saving lock state to database:",
      JSON.stringify({
        channelId: lockState.channelId,
        raidId: lockState.raidId,
        isLocked: lockState.isLocked,
      }),
    );
  }

  private async loadLockStatesFromDatabase(): Promise<void> {
    // Implementation depends on your database setup
    logger.info("Loading lock states from database");
  }

  async cleanup(): Promise<void> {
    // Clear all monitoring intervals
    this.monitoringIntervals.forEach((interval) => clearInterval(interval));
    this.monitoringIntervals.clear();

    // Unlock any remaining locked chats
    const lockedChats = await this.getAllLockedChats();
    for (const lockState of lockedChats) {
      await this.unlockChat(
        lockState.channelId,
        "system",
        "🔄 System cleanup - chat unlocked",
      );
    }

    logger.info("Chat Lock Manager cleaned up");
  }
}
