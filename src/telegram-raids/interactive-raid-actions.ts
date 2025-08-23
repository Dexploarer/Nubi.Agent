/**
 * Interactive Raid Actions
 *
 * ElizaOS actions for handling interactive telegram raid buttons
 * Integrates with optimized telegram services for performance
 */

import {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  logger,
} from "@elizaos/core";
import OptimizedTelegramService from "./optimized-telegram-service";
import EnhancedRaidCoordinator from "./enhanced-raid-coordinator";
import { RaidTracker } from "./raid-tracker";
import { EngagementVerifier } from "./engagement-verifier";

/**
 * Join Raid Action - Handles raid participation
 */
export const joinRaidAction: Action = {
  name: "JOIN_TELEGRAM_RAID",
  similes: [
    "RAID_JOIN",
    "PARTICIPATE_RAID",
    "ENTER_RAID",
    "SIGN_UP_RAID",
    "RAID_SIGNUP",
  ],
  description: "Join an active telegram raid with interactive buttons",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    // Check for join raid commands
    return (
      text.includes("join raid") ||
      text.includes("participate") ||
      text.includes("sign up") ||
      text.includes("/joinraid") ||
      (message.content.source === "telegram_callback" &&
        message.content.action === "raid_join")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const raidCoordinator = runtime.getService(
        "enhanced_raid_coordinator",
      ) as EnhancedRaidCoordinator;
      if (!raidCoordinator) {
        throw new Error("Raid coordinator service not available");
      }

      const userId = message.entityId || "anonymous";
      const raidId = (options?.raidId as string) || "current";

      // Handle raid joining
      const result = await raidCoordinator.handleRaidJoin(userId, raidId);

      if (callback) {
        await callback({
          text: result,
          action: "JOIN_TELEGRAM_RAID",
        });
      }

      return {
        success: true,
        text: result,
      };
    } catch (error) {
      logger.error(
        "Join raid action failed:",
        error instanceof Error ? error.message : String(error),
      );

      if (callback) {
        await callback({
          text: "❌ Failed to join raid. Please try again.",
          action: "JOIN_TELEGRAM_RAID_ERROR",
        });
      }

      return {
        success: false,
        text: "Failed to join raid",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "I want to join the raid" },
      },
      {
        name: "NUBI",
        content: {
          text: "🎯 You've joined the raid! Complete engagements and mark complete when done.",
          action: "JOIN_TELEGRAM_RAID",
        },
      },
    ],
  ],
};

/**
 * Complete Raid Action - Handles raid completion verification
 */
export const completeRaidAction: Action = {
  name: "COMPLETE_TELEGRAM_RAID",
  similes: [
    "RAID_COMPLETE",
    "FINISH_RAID",
    "RAID_DONE",
    "VERIFY_ENGAGEMENT",
    "MARK_COMPLETE",
  ],
  description: "Complete raid participation and verify engagements",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    return (
      text.includes("complete") ||
      text.includes("done") ||
      text.includes("finished") ||
      text.includes("verify") ||
      text.includes("/complete") ||
      (message.content.source === "telegram_callback" &&
        message.content.action === "raid_complete")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const raidCoordinator = runtime.getService(
        "enhanced_raid_coordinator",
      ) as EnhancedRaidCoordinator;
      if (!raidCoordinator) {
        throw new Error("Raid coordinator service not available");
      }

      const userId = message.entityId || "anonymous";
      const raidId = (options?.raidId as string) || "current";

      // Handle raid completion
      const result = await raidCoordinator.handleRaidComplete(userId, raidId);

      if (callback) {
        await callback({
          text: result,
          action: "COMPLETE_TELEGRAM_RAID",
        });
      }

      return {
        success: true,
        text: result,
      };
    } catch (error) {
      logger.error(
        "Complete raid action failed:",
        error instanceof Error ? error.message : String(error),
      );

      if (callback) {
        await callback({
          text: "❌ Failed to complete raid. Please try again.",
          action: "COMPLETE_TELEGRAM_RAID_ERROR",
        });
      }

      return {
        success: false,
        text: "Failed to complete raid",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "I completed all the engagements" },
      },
      {
        name: "NUBI",
        content: {
          text: "🎉 Verified! You earned 15 points for this raid.",
          action: "COMPLETE_TELEGRAM_RAID",
        },
      },
    ],
  ],
};

/**
 * Raid Stats Action - Shows live raid statistics
 */
export const raidStatsAction: Action = {
  name: "RAID_STATS",
  similes: [
    "RAID_STATUS",
    "SHOW_STATS",
    "RAID_INFO",
    "CURRENT_RAID",
    "RAID_PROGRESS",
  ],
  description: "Display current raid statistics and progress",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    return (
      text.includes("stats") ||
      text.includes("status") ||
      text.includes("progress") ||
      text.includes("info") ||
      text.includes("/stats") ||
      (message.content.source === "telegram_callback" &&
        message.content.action === "raid_stats")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const raidCoordinator = runtime.getService(
        "enhanced_raid_coordinator",
      ) as EnhancedRaidCoordinator;
      if (!raidCoordinator) {
        throw new Error("Raid coordinator service not available");
      }

      const raidId = (options?.raidId as string) || "current";
      const stats = await raidCoordinator.getRaidStats(raidId);

      if (!stats) {
        const noRaidMessage = "❌ No active raid found";

        if (callback) {
          await callback({
            text: noRaidMessage,
            action: "RAID_STATS",
          });
        }

        return {
          success: false,
          text: noRaidMessage,
        };
      }

      const statsMessage = `📊 <b>Raid Statistics</b>

👥 <b>Participants:</b> ${stats.participantCount}
💥 <b>Total Engagements:</b> ${stats.totalEngagements}
📈 <b>Engagement Rate:</b> ${stats.engagementRate.toFixed(1)}%
⚡ <b>Avg Response:</b> ${stats.avgResponseTime.toFixed(1)}s

🏆 <b>Top Performers:</b>
${stats.topPerformers
  .slice(0, 3)
  .map((p, i) => `${i + 1}. ${p.username} - ${p.points} pts`)
  .join("\n")}`;

      if (callback) {
        await callback({
          text: statsMessage,
          action: "RAID_STATS",
        });
      }

      return {
        success: true,
        text: statsMessage,
      };
    } catch (error) {
      logger.error(
        "Raid stats action failed:",
        error instanceof Error ? error.message : String(error),
      );

      const errorMessage = "❌ Failed to fetch raid stats";
      if (callback) {
        await callback({
          text: errorMessage,
          action: "RAID_STATS_ERROR",
        });
      }

      return {
        success: false,
        text: errorMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Show me the current raid stats" },
      },
      {
        name: "NUBI",
        content: {
          text: "📊 Raid Statistics\n\n👥 Participants: 25\n💥 Total Engagements: 75\n📈 Engagement Rate: 80.0%",
          action: "RAID_STATS",
        },
      },
    ],
  ],
};

/**
 * Leaderboard Action - Shows global raid leaderboard
 */
export const leaderboardAction: Action = {
  name: "RAID_LEADERBOARD",
  similes: [
    "SHOW_LEADERBOARD",
    "TOP_RAIDERS",
    "RANKINGS",
    "SCOREBOARD",
    "TOP_PLAYERS",
  ],
  description: "Display raid leaderboard and user rankings",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    return (
      text.includes("leaderboard") ||
      text.includes("rankings") ||
      text.includes("top raiders") ||
      text.includes("scoreboard") ||
      text.includes("/leaderboard") ||
      (message.content.source === "telegram_callback" &&
        message.content.action === "global_leaderboard")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const raidDatabase = runtime.getService("optimized_raid_database") as any;
      if (!raidDatabase) {
        throw new Error("Raid database service not available");
      }

      const period = (options?.period as string) || "weekly";
      const limit = (options?.limit as number) || 10;

      const leaderboard = await raidDatabase.getLeaderboard(period, limit);

      const leaderboardMessage = `🏆 <b>Raid Leaderboard (${period})</b>

${leaderboard
  .map(
    (entry: any, index: number) =>
      `${index + 1}. ${entry.username} - ${entry.total_points} pts (${entry.total_raids} raids)`,
  )
  .join("\n")}

⚡ <i>Keep raiding to climb the ranks!</i>`;

      if (callback) {
        await callback({
          text: leaderboardMessage,
          action: "RAID_LEADERBOARD",
        });
      }

      return {
        success: true,
        text: leaderboardMessage,
      };
    } catch (error) {
      logger.error(
        "Leaderboard action failed:",
        error instanceof Error ? error.message : String(error),
      );

      const errorMessage = "❌ Failed to fetch leaderboard";
      if (callback) {
        await callback({
          text: errorMessage,
          action: "RAID_LEADERBOARD_ERROR",
        });
      }

      return {
        success: false,
        text: errorMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Show me the leaderboard" },
      },
      {
        name: "NUBI",
        content: {
          text: "🏆 Raid Leaderboard (weekly)\n\n1. CryptoRaider - 420 pts (15 raids)\n2. MoonHunter - 380 pts (12 raids)",
          action: "RAID_LEADERBOARD",
        },
      },
    ],
  ],
};

/**
 * Create Raid Action - Start a new raid with interactive UI
 */
export const createRaidAction: Action = {
  name: "CREATE_TELEGRAM_RAID",
  similes: [
    "START_RAID",
    "NEW_RAID",
    "RAID_CREATE",
    "BEGIN_RAID",
    "LAUNCH_RAID",
  ],
  description: "Create a new telegram raid with interactive buttons",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    // Only allow admins or specific roles to create raids
    const isAdmin =
      message.content.source === "admin" ||
      message.entityId === runtime.agentId ||
      text.includes("/createraid");

    return (
      isAdmin &&
      (text.includes("create raid") ||
        text.includes("start raid") ||
        text.includes("new raid") ||
        text.includes("/raid"))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const raidCoordinator = runtime.getService(
        "enhanced_raid_coordinator",
      ) as EnhancedRaidCoordinator;
      if (!raidCoordinator) {
        throw new Error("Raid coordinator service not available");
      }

      const postUrl =
        (options?.postUrl as string) ||
        extractUrlFromMessage(message.content.text || "");

      if (!postUrl) {
        const errorMessage = "❌ Please provide a post URL to raid";

        if (callback) {
          await callback({
            text: errorMessage,
            action: "CREATE_TELEGRAM_RAID_ERROR",
          });
        }

        return {
          success: false,
          text: errorMessage,
        };
      }

      const chatId = message.roomId || "default";
      const customMessage = options?.customMessage as string;

      const raidId = await raidCoordinator.createRaid(
        chatId,
        postUrl,
        customMessage,
      );

      const successMessage = `🚨 New raid created! ID: ${raidId}`;

      if (callback) {
        await callback({
          text: successMessage,
          action: "CREATE_TELEGRAM_RAID",
        });
      }

      return {
        success: true,
        text: successMessage,
        values: { raidId, postUrl },
      };
    } catch (error) {
      logger.error(
        "Create raid action failed:",
        error instanceof Error ? error.message : String(error),
      );

      const errorMessage = "❌ Failed to create raid";
      if (callback) {
        await callback({
          text: errorMessage,
          action: "CREATE_TELEGRAM_RAID_ERROR",
        });
      }

      return {
        success: false,
        text: errorMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Create a raid for https://x.com/example/status/123" },
      },
      {
        name: "NUBI",
        content: {
          text: "🚨 New raid created! Join now and earn points!",
          action: "CREATE_TELEGRAM_RAID",
        },
      },
    ],
  ],
};

// Helper function to extract URLs from messages
function extractUrlFromMessage(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

// Export all raid actions
export const telegramRaidActions = [
  joinRaidAction,
  completeRaidAction,
  raidStatsAction,
  leaderboardAction,
  createRaidAction,
];

export default telegramRaidActions;
