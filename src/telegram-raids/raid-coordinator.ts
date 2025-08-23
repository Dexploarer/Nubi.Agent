import { IAgentRuntime } from "@elizaos/core";
import { TweetResult } from "../x-integration/x-posting-service";
import { RaidTracker, RaidSession } from "./raid-tracker";
import { logger } from "@elizaos/core";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

export interface RaidConfig {
  name: string;
  version: string;
  channels: {
    telegram: {
      channel_id: string;
      test_channel?: string;
    };
  };
  raid_settings: {
    auto_raid: boolean;
    raid_duration: number; // minutes
    min_participants: number;
    scoring: {
      like: number;
      retweet: number;
      reply: number;
      quote_tweet: number;
    };
    multipliers: {
      speed_bonus: {
        first_5: number;
        first_10: number;
        first_25: number;
      };
    };
  };
  templates: {
    raid_announcement: string;
    raid_update: string;
    raid_complete: string;
    raid_reminder: string;
  };
}

export class RaidCoordinator {
  private runtime: IAgentRuntime;
  private telegramClient: any;
  private raidTracker: RaidTracker;
  private config!: RaidConfig;
  private personaData: any | undefined;
  private activeRaids: Map<string, NodeJS.Timeout> = new Map();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.raidTracker = new RaidTracker();
    this.config = this.getDefaultConfig();
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

      // Preserve persona data for tone rotation
      this.personaData = {
        raid_personas: full?.raid_personas,
        personality_rotation: full?.personality_rotation,
        mood_modifiers: full?.mood_modifiers,
      };

      // Map unified config to internal structure
      this.config = {
        name: "Anubis Solana Raiders",
        version: "1.0.0",
        channels: {
          telegram: {
            channel_id:
              full?.telegram?.raid_channel ||
              process.env.TELEGRAM_CHANNEL_ID ||
              "@AnubisRaids",
            test_channel: process.env.TELEGRAM_TEST_CHANNEL || "@AnubisTest",
          },
        },
        raid_settings: {
          auto_raid: Boolean(full?.raid?.auto_create),
          raid_duration: Number(full?.raid?.duration_minutes ?? 30),
          min_participants: Number(full?.raid?.min_participants ?? 10),
          scoring: {
            like: Number(full?.raid?.scoring?.like_points ?? 1),
            retweet: Number(full?.raid?.scoring?.repost_points ?? 2),
            reply: Number(full?.raid?.scoring?.comment_points ?? 3),
            quote_tweet: 5,
          },
          multipliers: {
            speed_bonus: { first_5: 3.0, first_10: 2.0, first_25: 1.5 },
          },
        },
        templates: {
          raid_announcement:
            full?.x_posting?.templates?.raid_announcement ||
            this.getDefaultConfig().templates.raid_announcement,
          raid_update: this.getDefaultConfig().templates.raid_update,
          raid_complete:
            full?.x_posting?.templates?.raid_victory ||
            this.getDefaultConfig().templates.raid_complete,
          raid_reminder: this.getDefaultConfig().templates.raid_reminder,
        },
      } as RaidConfig;

      logger.info("Raid configuration loaded successfully");
    } catch (error) {
      logger.error("Failed to load raid configuration:", error instanceof Error ? error.message : String(error));
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): RaidConfig {
    return {
      name: "Anubis Solana Raiders",
      version: "1.0.0",
      channels: {
        telegram: {
          channel_id: process.env.TELEGRAM_CHANNEL_ID || "@AnubisRaids",
          test_channel: process.env.TELEGRAM_TEST_CHANNEL || "@AnubisTest",
        },
      },
      raid_settings: {
        auto_raid: true,
        raid_duration: 30,
        min_participants: 10,
        scoring: {
          like: 1,
          retweet: 2,
          reply: 3,
          quote_tweet: 5,
        },
        multipliers: {
          speed_bonus: {
            first_5: 3.0,
            first_10: 2.0,
            first_25: 1.5,
          },
        },
      },
      templates: {
        raid_announcement: `🔥 NEW ANUBIS RAID MISSION 🔥\n\n📍 Target: {{tweet_link}}\n⏰ Duration: {{duration}} minutes\n🎯 Mission: Like, RT, Comment\n\nFirst 5 raiders get 3x points!\n\nReact with ⚔️ to join the raid!`,
        raid_update: `⚡ RAID UPDATE ⚡\n\n👥 Raiders: {{current_raiders}}/{{min_raiders}}\n⏱️ Time remaining: {{time_left}} minutes\n🏆 Top Raider: @{{top_raider}}\n\nKeep pushing, warriors!`,
        raid_complete: `✅ RAID COMPLETE!\n\n📊 Stats:\n• Total Raiders: {{total_raiders}}\n• Engagement Score: {{engagement_score}}\n• Top Raider: @{{top_raider}} ({{top_points}} pts)\n\nLeaderboard: /leaderboard`,
        raid_reminder: `⏰ RAID REMINDER!\n\n{{time_left}} minutes remaining!\nTarget: {{tweet_link}}\n\nJoin now for bonus points! ⚔️`,
      },
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Telegram client through the plugin
      this.telegramClient = await this.runtime.getService("telegram");
      if (!this.telegramClient) {
        throw new Error("Telegram service not initialized");
      }

      // Initialize raid tracker
      await this.raidTracker.initialize();

      logger.info("Raid Coordinator initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize Raid Coordinator:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async createRaidFromTweet(
    tweetData: TweetResult,
    isTest: boolean = false,
  ): Promise<string> {
    try {
      // Create raid session
      const raidId = await this.raidTracker.createRaid(tweetData);

      // Generate raid announcement
      let announcement = this.generateRaidMessage(
        this.config.templates.raid_announcement,
        {
          tweet_link: tweetData.url,
          duration: this.config.raid_settings.raid_duration.toString(),
          min_raiders: this.config.raid_settings.min_participants.toString(),
        },
      );

      const personaIntro = this.pickPersonaPhrase("start");
      if (personaIntro) {
        announcement = `${personaIntro}

${announcement}`;
      }

      // Select channel (test or main)
      const channelId = isTest
        ? this.config.channels.telegram.test_channel ||
          this.config.channels.telegram.channel_id
        : this.config.channels.telegram.channel_id;

      // Send raid announcement
      const message = await this.sendTelegramMessage(channelId, announcement, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚔️ Join Raid", callback_data: `join_raid:${raidId}` },
              { text: "📊 Stats", callback_data: `raid_stats:${raidId}` },
            ],
          ],
        },
      });

      // Set up raid monitoring
      this.startRaidMonitoring(raidId, channelId, message.message_id);

      // Schedule raid completion
      const duration = this.config.raid_settings.raid_duration * 60 * 1000; // Convert to ms
      const completionTimer = setTimeout(() => {
        this.completeRaid(raidId, channelId);
      }, duration);

      this.activeRaids.set(raidId, completionTimer);

      logger.info(`Raid created successfully: ${raidId}`);
      return raidId;
    } catch (error) {
      logger.error("Failed to create raid:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async sendTelegramMessage(
    channelId: string,
    text: string,
    options?: any,
  ): Promise<any> {
    try {
      if (this.telegramClient && this.telegramClient.sendMessage) {
        return await this.telegramClient.sendMessage(channelId, text, options);
      } else {
        // Fallback for direct Telegram API call
        logger.warn("Using fallback Telegram message sending");
        // This would require implementing direct Telegram Bot API calls
        return { message_id: Date.now().toString() };
      }
    } catch (error) {
      logger.error(
        "Failed to send Telegram message:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private generateRaidMessage(
    template: string,
    variables: Record<string, string>,
  ): string {
    let message = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, "g"), value);
    });

    return message;
  }

  private startRaidMonitoring(
    raidId: string,
    channelId: string,
    messageId: string,
  ): void {
    // Send updates every 5 minutes
    const updateInterval = setInterval(
      async () => {
        const raid = await this.raidTracker.getRaid(raidId);
        if (!raid || raid.status !== "active") {
          clearInterval(updateInterval);
          return;
        }

        const stats = await this.raidTracker.getRaidStats(raidId);
        const timeLeft = Math.ceil((raid.endTime - Date.now()) / 60000); // minutes

        let update = this.generateRaidMessage(
          this.config.templates.raid_update,
          {
            current_raiders: stats.totalParticipants.toString(),
            min_raiders: this.config.raid_settings.min_participants.toString(),
            time_left: timeLeft.toString(),
            top_raider: stats.topRaider?.username || "None",
          },
        );

        const during = this.pickPersonaPhrase("during");
        if (during) {
          update = `${during}

${update}`;
        }

        // Edit the original message with update
        await this.editTelegramMessage(channelId, messageId, update);
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    // Store the interval so we can clear it later
    const existingTimer = this.activeRaids.get(raidId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
  }

  private async editTelegramMessage(
    channelId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    try {
      if (this.telegramClient && this.telegramClient.editMessageText) {
        await this.telegramClient.editMessageText(channelId, messageId, text);
      }
    } catch (error) {
      logger.error("Failed to edit Telegram message:", error instanceof Error ? error.message : String(error));
    }
  }

  async completeRaid(raidId: string, channelId: string): Promise<void> {
    try {
      // Mark raid as complete
      await this.raidTracker.endRaid(raidId);

      // Get final stats
      const stats = await this.raidTracker.getRaidStats(raidId);

      // Generate completion message
      let completion = this.generateRaidMessage(
        this.config.templates.raid_complete,
        {
          total_raiders: stats.totalParticipants.toString(),
          engagement_score: stats.totalPoints.toString(),
          top_raider: stats.topRaider?.username || "None",
          top_points: stats.topRaider?.points?.toString() || "0",
        },
      );

      const finish = this.pickPersonaPhrase("complete");
      if (finish) {
        completion = `${finish}

${completion}`;
      }

      // Send completion message
      await this.sendTelegramMessage(channelId, completion);

      // Clear timers
      const timer = this.activeRaids.get(raidId);
      if (timer) {
        clearTimeout(timer);
        this.activeRaids.delete(raidId);
      }

      logger.info(`Raid completed: ${raidId}`);
    } catch (error) {
      logger.error("Failed to complete raid:", error instanceof Error ? error.message : String(error));
    }
  }

  async handleRaidJoin(
    userId: string,
    username: string,
    raidId: string,
  ): Promise<string> {
    try {
      const joined = await this.raidTracker.joinRaid(raidId, userId, username);

      if (joined) {
        const position = await this.raidTracker.getParticipantPosition(
          raidId,
          userId,
        );
        let message = `⚔️ Welcome to the raid, @${username}!`;

        // Apply speed bonus
        if (position <= 5) {
          message += ` You're in the first 5! 3x points bonus activated! 🔥`;
        } else if (position <= 10) {
          message += ` You're in the first 10! 2x points bonus activated! 💪`;
        } else if (position <= 25) {
          message += ` You're in the first 25! 1.5x points bonus activated! ⚡`;
        }

        return message;
      } else {
        return `You're already in this raid, @${username}! Keep raiding! 💪`;
      }
    } catch (error) {
      logger.error("Failed to handle raid join:", error instanceof Error ? error.message : String(error));
      return "Failed to join raid. Please try again.";
    }
  }

  async getRaidStats(raidId: string): Promise<string> {
    try {
      const stats = await this.raidTracker.getRaidStats(raidId);

      return (
        `📊 RAID STATS\n\n` +
        `👥 Total Raiders: ${stats.totalParticipants}\n` +
        `🏆 Total Points: ${stats.totalPoints}\n` +
        `👑 Top Raider: @${stats.topRaider?.username || "None"} (${stats.topRaider?.points || 0} pts)\n` +
        `⏱️ Status: ${stats.status}`
      );
    } catch (error) {
      logger.error("Failed to get raid stats:", error instanceof Error ? error.message : String(error));
      return "Failed to retrieve stats. Please try again.";
    }
  }

  async cleanup(): Promise<void> {
    // Clear all active timers
    this.activeRaids.forEach((timer) => clearTimeout(timer));
    this.activeRaids.clear();

    // Close database connections
    await this.raidTracker.cleanup();

    logger.info("Raid Coordinator cleaned up");
  }

  // Persona helpers
  private currentPersonaId(): string | undefined {
    const rot = this.personaData?.personality_rotation?.schedule;
    if (!rot) return undefined;
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return rot.morning;
    if (hour >= 12 && hour < 18) return rot.afternoon;
    if (hour >= 18 && hour < 22) return rot.evening;
    if (hour >= 22 || hour < 2) return rot.night;
    if (hour >= 2 && hour < 6) return rot.late_night;
    return undefined;
  }

  private pickPersonaPhrase(
    phase: "start" | "during" | "complete",
  ): string | undefined {
    const pid = this.currentPersonaId();
    const personas = this.personaData?.raid_personas;
    if (!pid || !personas || !personas[pid]) return undefined;
    const arr: string[] = personas[pid]?.phrases?.[phase] || [];
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
