import { logger } from "@elizaos/core";

/**
 * Environment Configuration and Validation
 *
 * Centralized environment variable management with type safety and validation
 */

export interface EnvironmentConfig {
  // Core API Keys
  openaiApiKey: string;
  anthropicApiKey?: string;

  // Platform Integration
  telegramBotToken?: string;
  discordApiToken?: string;
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessTokenSecret?: string;

  // Database
  databaseUrl?: string;

  // NUBI Specific
  raidsEnabled: boolean;
  autoRaids: boolean;
  raidIntervalHours: number;
  maxConcurrentRaids: number;
  raidDurationMinutes: number;
  minRaidParticipants: number;

  // Performance
  logLevel: string;
  nodeEnv: string;
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  try {
    // Required variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    const config: EnvironmentConfig = {
      // Core API Keys
      openaiApiKey,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,

      // Platform Integration
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      discordApiToken: process.env.DISCORD_API_TOKEN,
      twitterApiKey: process.env.TWITTER_API_KEY,
      twitterApiSecret: process.env.TWITTER_API_SECRET_KEY,
      twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN,
      twitterAccessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,

      // Database
      databaseUrl: process.env.DATABASE_URL,

      // NUBI Specific
      raidsEnabled: process.env.RAIDS_ENABLED === "true",
      autoRaids: process.env.AUTO_RAIDS === "true",
      raidIntervalHours: safeParseInt(process.env.RAID_INTERVAL_HOURS, 6),
      maxConcurrentRaids: safeParseInt(process.env.MAX_CONCURRENT_RAIDS, 3),
      raidDurationMinutes: safeParseInt(process.env.RAID_DURATION_MINUTES, 30),
      minRaidParticipants: safeParseInt(process.env.MIN_RAID_PARTICIPANTS, 5),

      // Performance
      logLevel: process.env.LOG_LEVEL || "info",
      nodeEnv: process.env.NODE_ENV || "development",
    };

    validateConfig(config);
    return config;
  } catch (error) {
    logger.error("Failed to load environment configuration:", error);
    throw error;
  }
}

/**
 * Safely parse integer environment variable
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate configuration values
 */
function validateConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  // Validate raid configuration
  if (config.raidIntervalHours < 1) {
    errors.push("RAID_INTERVAL_HOURS must be at least 1");
  }

  if (config.maxConcurrentRaids < 1) {
    errors.push("MAX_CONCURRENT_RAIDS must be at least 1");
  }

  if (config.raidDurationMinutes < 5) {
    errors.push("RAID_DURATION_MINUTES must be at least 5");
  }

  if (config.minRaidParticipants < 1) {
    errors.push("MIN_RAID_PARTICIPANTS must be at least 1");
  }

  // Validate log level
  const validLogLevels = ["error", "warn", "info", "debug"];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(", ")}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment configuration errors:\n${errors.join("\n")}`);
  }

  logger.info("✅ Environment configuration validated successfully");
}

/**
 * Get feature availability based on environment
 */
export function getFeatureAvailability(config: EnvironmentConfig) {
  return {
    telegram: !!config.telegramBotToken,
    discord: !!config.discordApiToken,
    twitter: !!(
      config.twitterApiKey &&
      config.twitterApiSecret &&
      config.twitterAccessToken &&
      config.twitterAccessTokenSecret
    ),
    raids: config.raidsEnabled && !!config.telegramBotToken,
    autoRaids: config.autoRaids && config.raidsEnabled,
    database: !!config.databaseUrl,
  };
}

/**
 * Default environment configuration for development
 */
export const defaultEnvironment: Partial<EnvironmentConfig> = {
  logLevel: "info",
  nodeEnv: "development",
  raidsEnabled: false,
  autoRaids: false,
  raidIntervalHours: 6,
  maxConcurrentRaids: 3,
  raidDurationMinutes: 30,
  minRaidParticipants: 5,
};
