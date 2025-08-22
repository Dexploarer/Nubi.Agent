import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import { nubiCharacter } from "./nubi-character";
import nubiPlugin from "./nubi-plugin";
import clickhouseAnalyticsPlugin from "./plugins/clickhouse-analytics";

// Remove explicit telegram plugin import to avoid duplicate registration
// The character's plugins array handles telegram via `@elizaos/plugin-telegram`
// import { ProjectStarterTestSuite } from "./__tests__/e2e/project-starter.e2e";

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  try {
    logger.info("🚀 Initializing NUBI - The Symbiotic Essence of Anubis");
    logger.info({ name: nubiCharacter.name }, "Agent Identity:");

    // Validate character configuration
    if (!nubiCharacter.name) {
      throw new Error("Invalid character configuration");
    }

    // Log comprehensive feature set
    logger.info(
      {
        personalityDimensions: 10,
        emotionalStates: 7,
        antiDetectionPatterns: 16,
        knowledgeBase: nubiCharacter.knowledge?.length || 0,
        messageExamples: nubiCharacter.messageExamples?.length || 0,
        topics: nubiCharacter.topics?.length || 0,
        plugins: 3, // NUBI + Telegram + ClickHouse Analytics
        symbioticArchitecture: "enabled",
        analytics: "ClickHouse",
      },
      "✨ Symbiotic Essence Features:",
    );

    // Validate environment
    const requiredEnvVars = ["OPENAI_API_KEY"];
    const missingVars = requiredEnvVars.filter(
      (var_name) => !process.env[var_name],
    );

    if (missingVars.length > 0) {
      logger.warn(
        { missingVars },
        "⚠️  Missing required environment variables",
      );
    }

    // Log optional features status
    const features = {
      raidBot: !!process.env.TELEGRAM_BOT_TOKEN,
      twitterIntegration: !!process.env.TWITTER_API_KEY,
      discordIntegration: !!process.env.DISCORD_API_TOKEN,
      solanaIntegration: !!process.env.SOLANA_PRIVATE_KEY,
      anthropicFallback: !!process.env.ANTHROPIC_API_KEY,
      clickhouseAnalytics: !!process.env.CLICKHOUSE_HOST,
    };

    logger.info(features, "🔧 Feature Status:");

    // Log ClickHouse analytics status
    if (process.env.CLICKHOUSE_HOST) {
      logger.info("📊 ClickHouse Analytics enabled");
      logger.info(`📈 Dashboard: Run ./clickhouse-queries.sh for analytics`);
    } else {
      logger.info("📊 ClickHouse Analytics disabled (no CLICKHOUSE_HOST set)");
    }

    logger.info("🎯 NUBI Agent ready for deployment");
  } catch (error) {
    logger.error("❌ Character initialization failed:", error);
    throw error;
  }
};

export const projectAgent: ProjectAgent = {
  character: nubiCharacter,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [
    // Prefer plugin resolution via character.plugins to avoid duplicate registration
    nubiPlugin, // Enhanced NUBI plugin with raids integration
    clickhouseAnalyticsPlugin, // Analytics and observability
  ],
//   tests: [ProjectStarterTestSuite],
};

const project: Project = {
  agents: [projectAgent],
};

export { nubiCharacter as character } from "./nubi-character";
export { nubiCharacter } from "./nubi-character";

export default project;
