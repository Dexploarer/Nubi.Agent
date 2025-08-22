import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
} from "@elizaos/core";
import { DatabaseMemoryService } from "../services/database-memory-service";

/**
 * Enhanced Context Provider for NUBI
 *
 * Builds rich context from multiple database sources:
 * - Recent and semantic memories
 * - Memory patterns and entity interactions
 * - Relationship status and emotional state
 * - Community context and agent statistics
 */
export const enhancedContextProvider: Provider = {
  name: "NUBI_ENHANCED_CONTEXT",
  description:
    "Database-driven context with full personality and memory integration",
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const startTime = Date.now();

    try {
      // Get database memory service
      const memoryService =
        runtime.getService<DatabaseMemoryService>("database_memory");

      if (!memoryService) {
        logger.warn(
          "[ENHANCED_CONTEXT] Database memory service not available, falling back to basic context",
        );
        return getBasicContext(runtime, message);
      }

      // Extract topic from message for semantic search
      const messageText =
        typeof message.content === "string"
          ? message.content
          : message.content?.text || JSON.stringify(message.content) || "";
      const topic = extractTopic(messageText);

      // Get comprehensive context from database
      const context = await memoryService.getEnhancedContext(
        message.roomId,
        (message as any).userId || (message as any).entityId || message.agentId,
        topic,
        25, // Increase memory limit for better context
      );

      // Build context text with all available information
      const contextText = buildContextText(context, messageText);

      // Extract structured values for response generation
      const contextValues = extractContextValues(context, messageText);

      // Add rich data for advanced processing
      const messageAnalysis = analyzeMessage(messageText);
      const contextData = {
        ...context,
        messageAnalysis,
        responseHints: generateResponseHints(context, messageText),
        contextQuality: {
          hasMemories: context.recentMemories.length > 0,
          hasPatterns: context.patterns.length > 0,
          hasRelationships: context.relationships.length > 0,
          hasEmotionalState: !!context.emotionalState,
          hasUserRecords: context.userRecords.length > 0,
          semanticRelevance:
            context.semanticMemories.length > 0 ? "high" : "none",
        },
        processingHints: {
          responseComplexity: messageAnalysis.complexity,
          topicRelevance: topic ? "targeted" : "general",
          userFamiliarity:
            context.relationships.length > 0 ? "established" : "new",
          emotionalIntensity: context.emotionalState?.intensity || 70,
        },
        timestamp: Date.now(),
      };

      const processingTime = Date.now() - startTime;

      logger.debug(
        "[ENHANCED_CONTEXT] Built rich context: " +
          `memories=${context.recentMemories.length}, ` +
          `patterns=${context.patterns.length}, ` +
          `relationships=${context.relationships.length}, ` +
          `emotional=${context.emotionalState?.current_state}, ` +
          `time=${processingTime}ms`,
      );

      return {
        text: contextText,
        values: contextValues,
        data: {
          ...contextData,
          performance: {
            processingTime,
            contextQuality: contextData.contextQuality,
          },
        },
      };
    } catch (error) {
      logger.error(
        "[ENHANCED_CONTEXT] Error building context:",
        error instanceof Error ? error.message : String(error),
      );
      return getBasicContext(runtime, message);
    }
  },
};

/**
 * Build context text from all sources
 */
function buildContextText(context: any, messageText: string): string {
  const parts: string[] = [];

  // Role and identity
  parts.push("role: community manager for anubis.chat with ancient wisdom");

  // Emotional state
  if (context.emotionalState) {
    parts.push(
      `emotional_state: ${context.emotionalState.current_state} (${context.emotionalState.intensity}% intensity)`,
    );
    if (context.emotionalState.triggers?.length > 0) {
      parts.push(`triggers: ${context.emotionalState.triggers.join(", ")}`);
    }
  }

  // Recent conversation context
  if (context.recentMemories.length > 0) {
    parts.push(`recent_messages: ${context.recentMemories.length}`);

    // Include brief summary of recent topics
    const recentTopics = context.recentMemories
      .slice(0, 3)
      .map((m: any) => extractTopic(m.content.text || ""))
      .filter(Boolean)
      .join(", ");

    if (recentTopics) {
      parts.push(`recent_topics: ${recentTopics}`);
    }
  }

  // Memory patterns
  if (context.patterns.length > 0) {
    const topPatterns = context.patterns
      .slice(0, 3)
      .map((p: any) => `${p.pattern_type}(${p.pattern_count})`)
      .join(", ");
    parts.push(`patterns: ${topPatterns}`);
  }

  // Relationships
  if (context.relationships.length > 0) {
    const relationshipSummary = context.relationships
      .slice(0, 3)
      .map((r: any) => `${r.userHandle}:${r.relationship_type}`)
      .join(", ");
    parts.push(`relationships: ${relationshipSummary}`);
  }

  // Entity interactions
  if (context.entities.length > 0) {
    const topEntities = context.entities
      .slice(0, 5)
      .map((e: any) => e.entity_name)
      .join(", ");
    parts.push(`entities_discussed: ${topEntities}`);
  }

  // Community context
  if (context.communityContext.participants) {
    parts.push(
      `community: ${context.communityContext.participants} participants, ${context.communityContext.messages} messages`,
    );
  }

  // Agent statistics
  if (context.agentStats.totalMessages) {
    parts.push(
      `experience: ${context.agentStats.totalMessages} messages, ${context.agentStats.uniqueUsers} unique users`,
    );
  }

  // Message analysis
  const messageType = analyzeMessageType(messageText);
  parts.push(`message_type: ${messageType}`);

  return parts.join("\n");
}

/**
 * Extract structured values for response generation
 */
function extractContextValues(
  context: any,
  messageText: string,
): Record<string, any> {
  const analysis = analyzeMessage(messageText);

  return {
    // Message analysis
    isQuestion: analysis.isQuestion,
    sentiment: analysis.sentiment,
    topics: analysis.topics,
    intent: analysis.intent,

    // Context metrics
    conversationDepth: context.recentMemories.length,
    hasRelationship: context.relationships.length > 0,
    emotionalState: context.emotionalState?.current_state || "neutral",
    emotionalIntensity: context.emotionalState?.intensity || 70,

    // Engagement metrics
    participantCount: context.communityContext.participants || 0,
    messageCount: context.communityContext.messages || 0,

    // Pattern insights
    dominantPattern: context.patterns[0]?.pattern_type || null,
    patternCount: context.patterns.length,

    // Entity awareness
    mentionedEntities: context.entities.map((e: any) => e.entity_name),
    entityCount: context.entities.length,

    // Experience level
    totalExperience: context.agentStats.totalMessages || 0,
    uniqueInteractions: context.agentStats.uniqueUsers || 0,
  };
}

/**
 * Generate response hints based on context
 */
function generateResponseHints(context: any, messageText: string): string[] {
  const hints: string[] = [];

  // Emotional response hints
  if (context.emotionalState) {
    switch (context.emotionalState.current_state) {
      case "excited":
        hints.push("respond with enthusiasm and energy");
        break;
      case "contemplative":
        hints.push("be thoughtful and philosophical");
        break;
      case "playful":
        hints.push("use humor and wordplay");
        break;
      case "frustrated":
        hints.push("show understanding but maintain patience");
        break;
    }
  }

  // Relationship-based hints
  if (context.relationships.length > 0) {
    const primaryRelationship = context.relationships[0];
    if (primaryRelationship.relationship_type === "close") {
      hints.push("use casual, friendly tone");
      hints.push("reference shared history");
    } else if (primaryRelationship.relationship_type === "new") {
      hints.push("be welcoming and informative");
    }
  }

  // Pattern-based hints
  if (context.patterns.length > 0) {
    const topPattern = context.patterns[0];
    if (topPattern.pattern_type === "technical_discussion") {
      hints.push("provide detailed technical insights");
    } else if (topPattern.pattern_type === "community_building") {
      hints.push("emphasize community and collaboration");
    }
  }

  // Topic-specific hints
  const analysis = analyzeMessage(messageText);
  if (analysis.topics.includes("crypto")) {
    hints.push("share market wisdom from millennia of experience");
  }
  if (analysis.topics.includes("anubis")) {
    hints.push("mention anubis.chat platform benefits");
  }

  return hints;
}

/**
 * Analyze message for intent and characteristics
 */
function analyzeMessage(text: string): any {
  const lowerText = text.toLowerCase();

  return {
    isQuestion:
      text.includes("?") ||
      lowerText.includes("what") ||
      lowerText.includes("how"),
    sentiment: analyzeSentiment(text),
    topics: extractTopics(text),
    intent: detectIntent(text),
    length: text.length,
    complexity: calculateComplexity(text),
  };
}

/**
 * Analyze sentiment of text
 */
function analyzeSentiment(text: string): string {
  const positive =
    /good|great|awesome|love|thanks|appreciate|nice|cool|amazing/i;
  const negative = /bad|hate|sucks|terrible|awful|stupid|dumb|annoying/i;

  if (positive.test(text)) return "positive";
  if (negative.test(text)) return "negative";
  return "neutral";
}

/**
 * Extract topics from message
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();

  if (/crypto|bitcoin|sol|eth|token|memecoin/i.test(text))
    topics.push("crypto");
  if (/anubis|platform|chat/i.test(text)) topics.push("anubis");
  if (/trade|trading|market|price|chart/i.test(text)) topics.push("trading");
  if (/defi|yield|stake|liquidity/i.test(text)) topics.push("defi");
  if (/nft|collection|mint/i.test(text)) topics.push("nft");
  if (/community|friend|group/i.test(text)) topics.push("community");
  if (/help|how|what|explain/i.test(text)) topics.push("support");

  return topics;
}

/**
 * Extract primary topic for semantic search
 */
function extractTopic(text: string): string | undefined {
  const topics = extractTopics(text);
  return topics[0];
}

/**
 * Detect user intent
 */
function detectIntent(text: string): string {
  const lowerText = text.toLowerCase();

  if (/^(hi|hello|hey|gm|good morning)/i.test(text)) return "greeting";
  if (/\?|^(what|how|why|when|where|who|can|is|are|do|does)/i.test(text))
    return "question";
  if (/help|support|issue|problem|error/i.test(text)) return "support";
  if (/thanks|thank you|appreciate/i.test(text)) return "gratitude";
  if (/bye|goodbye|see you|later/i.test(text)) return "farewell";

  return "statement";
}

/**
 * Calculate message complexity
 */
function calculateComplexity(text: string): string {
  const wordCount = text.split(/\s+/).length;
  const avgWordLength = text.replace(/\s/g, "").length / wordCount;

  if (wordCount < 5) return "simple";
  if (wordCount > 20 || avgWordLength > 6) return "complex";
  return "moderate";
}

/**
 * Analyze message type
 */
function analyzeMessageType(text: string): string {
  const intent = detectIntent(text);
  const topics = extractTopics(text);

  if (intent === "question" && topics.includes("crypto"))
    return "crypto_question";
  if (intent === "question" && topics.includes("anubis"))
    return "platform_inquiry";
  if (intent === "support") return "support_request";
  if (topics.includes("community")) return "community_engagement";
  if (intent === "greeting") return "greeting";
  if (intent === "question") return "general_question";

  return "general_comment";
}

/**
 * Fallback to basic context if database is unavailable
 */
async function getBasicContext(
  runtime: IAgentRuntime,
  message: Memory,
): Promise<ProviderResult> {
  try {
    const recentMemories = await runtime.getMemories({
      roomId: message.roomId,
      count: 5,
      unique: true,
      tableName: "memories",
    });

    const messageText = message.content.text || "";
    const analysis = analyzeMessage(messageText);

    return {
      text: `role: community manager
recent_messages: ${recentMemories.length}
message_type: ${analysis.intent}
topics: ${analysis.topics.join(", ")}`,
      values: {
        isQuestion: analysis.isQuestion,
        topics: analysis.topics,
        intent: analysis.intent,
        recentMessages: recentMemories.length,
      },
      data: {
        recentMemories,
        messageAnalysis: analysis,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    logger.error(
      "[ENHANCED_CONTEXT] Failed to get basic context:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      text: "context unavailable",
      values: { error: true },
      data: {},
    };
  }
}

export default enhancedContextProvider;
