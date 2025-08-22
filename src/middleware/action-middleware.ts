import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
  logger,
} from "@elizaos/core";

/**
 * Action Middleware for ElizaOS
 * 
 * Preprocesses @mentions and routes messages appropriately across platforms.
 * Handles Discord, Telegram, Twitter mention formats and normalizes them.
 */

interface PlatformMention {
  platform: "discord" | "telegram" | "twitter" | "unknown";
  username: string;
  userId?: string;
  raw: string;
}

/**
 * Detect and parse platform-specific mentions
 */
function detectMentions(text: string): PlatformMention[] {
  const mentions: PlatformMention[] = [];

  // Discord mentions: <@123456789> or <@!123456789>
  const discordRegex = /<@!?(\d+)>/g;
  let match;
  while ((match = discordRegex.exec(text)) !== null) {
    mentions.push({
      platform: "discord",
      username: `user_${match[1]}`,
      userId: match[1],
      raw: match[0],
    });
  }

  // Telegram mentions: @username or @username_bot
  const telegramRegex = /@([a-zA-Z0-9_]{5,32}(?:_bot)?)/g;
  while ((match = telegramRegex.exec(text)) !== null) {
    mentions.push({
      platform: "telegram",
      username: match[1],
      userId: undefined,
      raw: match[0],
    });
  }

  // Twitter mentions: @username
  const twitterRegex = /@([a-zA-Z0-9_]{1,15})(?![a-zA-Z0-9_])/g;
  while ((match = twitterRegex.exec(text)) !== null) {
    // Skip if it looks like a Telegram bot mention
    if (!match[1].endsWith("_bot")) {
      mentions.push({
        platform: "twitter",
        username: match[1],
        userId: undefined,
        raw: match[0],
      });
    }
  }

  return mentions;
}

/**
 * Normalize mentions to a consistent format
 */
function normalizeMentions(text: string, agentName: string): string {
  const mentions = detectMentions(text);
  let normalizedText = text;

  // Replace all mentions of the agent with a normalized @agent format
  const agentAliases = [
    "nubi", "anubis", "anubischat", "nubibot", "jackal",
    "nubi_bot", "anubis_bot", "nubiai", "anubisai"
  ];

  for (const mention of mentions) {
    const username = mention.username.toLowerCase();
    if (agentAliases.some(alias => username.includes(alias))) {
      normalizedText = normalizedText.replace(mention.raw, `@${agentName}`);
    }
  }

  return normalizedText;
}

/**
 * Extract platform from message metadata
 */
function detectPlatform(message: Memory): string {
  // Check for platform indicators in metadata
  const metadata = (message as any).metadata || {};
  
  if (metadata.platform) return metadata.platform;
  if (metadata.source) return metadata.source;
  
  // Check for platform-specific fields
  if ((message as any).discordId || (message as any).guildId) return "discord";
  if ((message as any).telegramChatId || (message as any).telegram_chat_id) return "telegram";
  if ((message as any).tweetId || (message as any).twitter_id) return "twitter";
  
  // Check content patterns
  const text = message.content?.text || "";
  if (text.includes("<@") && text.includes(">")) return "discord";
  if (text.includes("_bot")) return "telegram";
  
  return "unknown";
}

/**
 * Preprocess message for action routing
 */
async function preprocessMessage(
  runtime: IAgentRuntime,
  message: Memory,
  state: State
): Promise<Memory> {
  try {
    const platform = detectPlatform(message);
    const text = message.content?.text || "";
    
    // Normalize mentions
    const normalizedText = normalizeMentions(text, runtime.agentId);
    
    // Create preprocessed message
    const processedMessage: Memory = {
      ...message,
      content: {
        ...message.content,
        text: normalizedText,
        originalText: text,
      },
    };

    // Add platform metadata
    (processedMessage as any).platform = platform;
    (processedMessage as any).mentions = detectMentions(text);
    
    // Add to state for downstream use
    if (state) {
      state.platform = platform;
      state.preprocessed = true;
      state.originalText = text;
      state.normalizedText = normalizedText;
    }

    logger.debug(`[ACTION_MIDDLEWARE] Preprocessed ${platform} message with ${detectMentions(text).length} mentions`);
    
    return processedMessage;
  } catch (error) {
    logger.error("[ACTION_MIDDLEWARE] Preprocessing failed:", error);
    return message; // Return original on error
  }
}

/**
 * Wrap an action with middleware for preprocessing
 */
export function withActionMiddleware(action: Action): Action {
  return {
    ...action,
    
    validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State
    ): Promise<boolean> => {
      try {
        // Preprocess message
        const processedMessage = await preprocessMessage(
          runtime,
          message,
          state || ({ values: {}, data: {}, text: "" } as State)
        );
        
        // Call original validate with processed message
        return action.validate(runtime, processedMessage, state);
      } catch (error) {
        logger.error(`[ACTION_MIDDLEWARE] Validation error in ${action.name}:`, error);
        return false;
      }
    },

    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State,
      options: any,
      callback?: HandlerCallback
    ): Promise<ActionResult> => {
      try {
        // Preprocess message
        const processedMessage = await preprocessMessage(runtime, message, state);
        
        // Add correlation ID for tracing
        const correlationId = `${action.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        (state as any).correlationId = correlationId;
        
        logger.debug(`[ACTION_MIDDLEWARE] Executing ${action.name} with correlation ID: ${correlationId}`);
        
        // Call original handler with processed message
        const result: any = await action.handler(
          runtime,
          processedMessage,
          state,
          options,
          callback
        );
        
        // Log completion
        logger.debug(`[ACTION_MIDDLEWARE] ${action.name} completed: ${result.success ? "success" : "failure"}`);
        
        return result || { success: false, message: "No result" } as ActionResult;
      } catch (error) {
        logger.error(`[ACTION_MIDDLEWARE] Handler error in ${action.name}:`, error);
        
        // Return error result
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
  };
}

/**
 * Create a platform-aware action wrapper
 */
export function createPlatformAction(
  baseAction: Action,
  platformHandlers: {
    discord?: (message: Memory, state: State) => Promise<ActionResult>;
    telegram?: (message: Memory, state: State) => Promise<ActionResult>;
    twitter?: (message: Memory, state: State) => Promise<ActionResult>;
  }
): Action {
  return withActionMiddleware({
    ...baseAction,
    
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State,
      options: any,
      callback?: HandlerCallback
    ): Promise<ActionResult> => {
      const platform = (message as any).platform || detectPlatform(message);
      
      // Use platform-specific handler if available
      const platformHandler = platformHandlers[platform as keyof typeof platformHandlers];
      if (platformHandler) {
        logger.debug(`[PLATFORM_ACTION] Using ${platform}-specific handler for ${baseAction.name}`);
        return platformHandler(message, state);
      }
      
      // Fall back to base handler
      return (baseAction.handler as any)(runtime, message, state, options, callback);
    },
  });
}

export default withActionMiddleware;
