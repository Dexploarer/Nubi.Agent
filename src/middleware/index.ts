/**
 * Middleware exports for ElizaOS NUBI Agent
 * 
 * Provides preprocessing and routing middleware for cross-platform message handling
 */

export {
  withActionMiddleware,
  createPlatformAction,
} from "./action-middleware";

// Re-export types
export type { PlatformMention } from "./action-middleware";

// Re-export the default for convenience
export { default as actionMiddleware } from "./action-middleware";

/**
 * Middleware utilities for platform-specific message processing
 */
export const middlewareUtils = {
  /**
   * Detect platform from message metadata
   */
  detectPlatform: (message: any): string => {
    const metadata = message?.metadata || {};
    
    if (metadata.platform) return metadata.platform;
    if (metadata.source) return metadata.source;
    
    // Check for platform-specific fields
    if (message.discordId || message.guildId) return "discord";
    if (message.telegramChatId || message.telegram_chat_id) return "telegram";
    if (message.tweetId || message.twitter_id) return "twitter";
    
    // Check content patterns
    const text = message.content?.text || "";
    if (text.includes("<@") && text.includes(">")) return "discord";
    if (text.includes("_bot")) return "telegram";
    
    return "unknown";
  },
  
  /**
   * Normalize agent mentions across platforms
   */
  normalizeAgentMentions: (text: string, agentName: string): string => {
    const agentAliases = [
      "nubi",
      "anubis", 
      "anubischat",
      "nubibot",
      "jackal",
      "nubi_bot",
      "anubis_bot",
      "nubiai",
      "anubisai",
    ];
    
    let normalizedText = text;
    
    // Replace Discord mentions
    const discordRegex = /<@!?(\d+)>/g;
    normalizedText = normalizedText.replace(discordRegex, (match, userId) => {
      return `@${agentName}`;
    });
    
    // Replace Telegram/Twitter mentions
    const mentionRegex = /@([a-zA-Z0-9_]{1,32}(?:_bot)?)/g;
    normalizedText = normalizedText.replace(mentionRegex, (match, username) => {
      const lowerUsername = username.toLowerCase();
      if (agentAliases.some(alias => lowerUsername.includes(alias))) {
        return `@${agentName}`;
      }
      return match; // Keep other mentions unchanged
    });
    
    return normalizedText;
  }
};

export default {
  withActionMiddleware,
  createPlatformAction,
  middlewareUtils,
};
