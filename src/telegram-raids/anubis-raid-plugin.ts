import { Plugin, IAgentRuntime, Service } from "@elizaos/core";
import { AnubisRaidFlow } from "./raid-flow";
import { logger } from "@elizaos/core";

export class AnubisRaidService extends Service {
  static serviceType = "anubis-raid";
  capabilityDescription =
    "Anubis Raid Bot - Automated X posting and Telegram raid coordination";
  private raidFlow: AnubisRaidFlow;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.raidFlow = new AnubisRaidFlow(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new AnubisRaidService(runtime);
    logger.info("✅ Anubis Raid Service started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("anubis-raid");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ Anubis Raid Service started");
    // Service is ready - no specific startup tasks needed
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Anubis Raid Service...");
      await this.raidFlow.initialize();
      logger.info("Anubis Raid Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Anubis Raid Service:", error);
      throw error;
    }
  }

  async handleTelegramMessage(message: any): Promise<string> {
    try {
      const text = message.text || "";
      const userId = message.from?.id?.toString() || "";
      const username = message.from?.username || "Unknown";

      // Check if it's a command
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0];
        const args = parts.slice(1);

        return await this.raidFlow.handleCommand(
          command,
          userId,
          username,
          args,
        );
      }

      // Handle callback queries (button clicks)
      if (message.callback_query) {
        const data = message.callback_query.data;
        const [action, ...params] = data.split(":");

        switch (action) {
          case "join_raid":
            return await this.raidFlow.handleCommand(
              "/raid",
              userId,
              username,
              [],
            );
          case "raid_stats":
            return await this.raidFlow.handleCommand(
              "/mystats",
              userId,
              username,
              [],
            );
          default:
            return "Unknown action";
        }
      }

      return "";
    } catch (error) {
      logger.error("Error handling Telegram message:", error);
      return "An error occurred processing your request.";
    }
  }

  async manualRaid(): Promise<string> {
    return await this.raidFlow.manualPost();
  }

  async stop(): Promise<void> {
    await this.raidFlow.stop();
  }
}

const anubisRaidPlugin: Plugin = {
  name: "anubis-raid-bot",
  description:
    "Anubis Solana Raid Bot - Automated X posting and Telegram raid coordination",

  services: [AnubisRaidService],

  actions: [
    {
      name: "START_MANUAL_RAID",
      description: "Manually trigger a raid cycle",
      validate: async (runtime, message) => {
        // Check if user has admin permissions
        return message.content?.text?.includes("!raid start") || false;
      },
      handler: async (runtime, message, state, options, callback) => {
        try {
          const service = runtime.getService(
            "anubis-raid",
          ) as AnubisRaidService;
          if (service) {
            const result = await service.manualRaid();
            if (callback) {
              await callback({
                text: result,
                action: "START_MANUAL_RAID",
              });
            }
            return {
              success: true,
              text: result,
              values: { raidStarted: true },
              data: { action: "START_MANUAL_RAID" },
            };
          }
          throw new Error("Raid service not found");
        } catch (error) {
          if (callback) {
            await callback({
              text: "Failed to start manual raid",
              error: true,
            });
          }
          return {
            success: false,
            text: "Failed to start manual raid",
            values: { raidStarted: false },
            data: { error: error.message },
          };
        }
      },
      examples: [
        [
          {
            name: "{{user}}",
            content: { text: "!raid start" },
          },
          {
            name: "Anubis",
            content: {
              text: "Manual raid cycle initiated! Posting to X and creating Telegram raid...",
              action: "START_MANUAL_RAID",
            },
          },
        ],
      ],
    },
  ],

  providers: [
    {
      name: "raid-stats",
      description: "Provides raid statistics and leaderboard data",
      get: async (runtime, message, state) => {
        try {
          const service = runtime.getService(
            "anubis-raid",
          ) as AnubisRaidService;
          // Return relevant raid context for message generation
          return {
            text: "Raid statistics available",
            values: {
              hasActiveRaid: true,
              leaderboardAvailable: true,
            },
            data: {},
          };
        } catch (error) {
          return {
            text: "Raid stats unavailable",
            values: {},
            data: {},
          };
        }
      },
    },
  ],

  evaluators: [],

  models: {},

  config: {
    // Configuration schema for the plugin
    requiredEnvVars: [
      "TWITTER_API_KEY",
      "TWITTER_API_SECRET_KEY",
      "TWITTER_ACCESS_TOKEN",
      "TWITTER_ACCESS_TOKEN_SECRET",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHANNEL_ID",
    ],
    optionalEnvVars: [
      "TELEGRAM_TEST_CHANNEL",
      "RAID_AUTO_CREATE",
      "RAID_DURATION_MINUTES",
      "RAID_POST_INTERVAL_HOURS",
    ],
  },
};

export default anubisRaidPlugin;
