import {
  Service,
  IAgentRuntime,
  Memory,
  HandlerCallback,
  State,
  logger,
  ModelType,
} from "@elizaos/core";

/**
 * Context data interface
 */
interface ContextData {
  emotionalState?: EmotionalState;
  relationships?: Relationship[];
  patterns?: Pattern[];
  messageAnalysis?: MessageAnalysis;
  entities?: Entity[];
}

/**
 * Enhanced context interface
 */
interface EnhancedContext {
  data?: ContextData;
  values?: Record<string, unknown>;
}

/**
 * Emotional state interface
 */
interface EmotionalState {
  current_state: string;
  intensity: number;
  duration?: number;
  triggers?: string[];
  last_update?: Date;
}

/**
 * Relationship interface
 */
interface Relationship {
  userId: string;
  userHandle: string;
  relationship_type: string;
  interaction_count: number;
  sentiment: string;
  tags: string[];
}

/**
 * Pattern interface
 */
interface Pattern {
  pattern_type: string;
  pattern_count: number;
}

/**
 * Message analysis interface
 */
interface MessageAnalysis {
  intent: string;
  topics: string[];
  sentiment: string;
  isQuestion?: boolean;
}

/**
 * Entity interface
 */
interface Entity {
  name: string;
  type: string;
  confidence: number;
  total_mentions?: number;
  entity_name?: string;
}

/**
 * Enhanced Response Generator Service
 *
 * Generates contextually aware responses using:
 * - Database-driven personality traits
 * - Emotional state modulation
 * - Community callbacks and inside jokes
 * - Relationship-based tone adjustment
 * - Pattern-based response strategies
 */

interface ResponseModifiers {
  emotionalTone: string;
  personalityTraits: Record<string, number>;
  relationshipContext: string;
  communityCallbacks: string[];
  responseStyle: ResponseStyle;
  contentFilters: string[];
}

interface ResponseStyle {
  formality: "casual" | "moderate" | "formal";
  enthusiasm: "low" | "moderate" | "high";
  technicalDepth: "simple" | "balanced" | "detailed";
  humor: "none" | "light" | "playful" | "sarcastic";
  ancientWisdom: boolean;
  communityReferences: boolean;
}

export class EnhancedResponseGenerator extends Service {
  static serviceType = "response_generator" as const;
  capabilityDescription =
    "Database-driven response generation with personality and context awareness";

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<EnhancedResponseGenerator> {
    const service = new EnhancedResponseGenerator(runtime);
    logger.info("[RESPONSE_GENERATOR] Enhanced response generator started");
    return service;
  }

  /**
   * Generate enhanced response with full context awareness using ElizaOS AI
   */
  async generateResponse(
    message: Memory,
    state: State,
    context: EnhancedContext,
    callback?: HandlerCallback,
  ): Promise<string> {
    try {
      // Extract modifiers from context
      const modifiers = this.extractResponseModifiers(context);

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildContextualPrompt(
        message,
        context,
        modifiers,
      );

      // Create enhanced state with NUBI context
      const enhancedState = {
        ...state,
        nubiContext: {
          emotionalState: context.data?.emotionalState,
          relationships: context.data?.relationships,
          patterns: context.data?.patterns,
          entities: context.data?.entities,
          userRecords: (context as any)?.userRecords || [],
          personalityTraits: modifiers.personalityTraits,
          relationshipContext: modifiers.relationshipContext,
          responseStyle: modifiers.responseStyle,
        },
      };

      // Build model parameters, preferring dynamic values from state
      const modelParams = {
        runtime: this.runtime,
        context: enhancedPrompt,
        modelClass:
          (enhancedState as any).modelClass ||
          this.determineModelClass(modifiers),
        stop: [],
        max_response_length:
          (enhancedState as any).maxTokens ||
          this.determineResponseLength(modifiers),
        temperature:
          (enhancedState as any).dynamicTemperature ||
          this.determineTemperature(modifiers),
        top_p: (enhancedState as any).dynamicTopP || 0.9,
        frequency_penalty:
          (enhancedState as any).dynamicFrequencyPenalty || 0.6,
        presence_penalty: (enhancedState as any).dynamicPresencePenalty || 0.6,
      };

      // Use ElizaOS native text generation
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        text: enhancedState.text || message.content?.text || "",
        temperature: (modelParams as any).temperature || 0.7,
        max_tokens: (modelParams as any).max_tokens || 2000,
      });

      if (!response) {
        logger.warn(
          "[RESPONSE_GENERATOR] No response generated, using fallback",
        );
        return this.getFallbackResponse();
      }

      // Apply post-processing for NUBI personality
      let processedResponse = this.applyPostProcessing(response, modifiers);

      logger.debug(
        "[RESPONSE_GENERATOR] Generated AI response: " +
          `intent=${context.data?.messageAnalysis?.intent}, ` +
          `emotional=${modifiers.emotionalTone}, ` +
          `style=${modifiers.responseStyle.formality}, ` +
          `model=${modelParams.modelClass}, ` +
          `temp=${modelParams.temperature}, ` +
          `tokens=${modelParams.max_response_length}`,
      );

      return processedResponse;
    } catch (error) {
      logger.error(
        "[RESPONSE_GENERATOR] Failed to generate enhanced response:",
        error,
      );
      return this.getFallbackResponse();
    }
  }

  /**
   * Extract response modifiers from context
   */
  private extractResponseModifiers(
    context: EnhancedContext,
  ): ResponseModifiers {
    const emotionalState = context.data?.emotionalState;
    const relationships = context.data?.relationships || [];
    const patterns = context.data?.patterns || [];
    const messageAnalysis = context.data?.messageAnalysis || {
      intent: "unknown",
      topics: [],
      sentiment: "neutral",
    };

    // Determine emotional tone
    const emotionalTone = this.determineEmotionalTone(
      emotionalState,
      messageAnalysis,
    );

    // Get personality traits from database or defaults
    const personalityTraits =
      (context.data as any)?.personalityTraits ||
      this.getDefaultPersonalityTraits();

    // Determine relationship context
    const relationshipContext =
      this.determineRelationshipContext(relationships);

    // Get relevant community callbacks
    const communityCallbacks = this.extractCommunityCallbacks(context);

    // Determine response style
    const responseStyle = this.determineResponseStyle(
      relationshipContext,
      patterns,
      messageAnalysis,
    );

    // Set content filters
    const contentFilters = this.determineContentFilters(context);

    return {
      emotionalTone,
      personalityTraits,
      relationshipContext,
      communityCallbacks,
      responseStyle,
      contentFilters,
    };
  }

  /**
   * Determine emotional tone for response
   */
  private determineEmotionalTone(
    emotionalState: EmotionalState | undefined,
    messageAnalysis: MessageAnalysis | undefined,
  ): string {
    if (!emotionalState) return "neutral";

    const state = emotionalState.current_state || "neutral";
    const intensity = emotionalState.intensity || 70;
    const messageSentiment = messageAnalysis?.sentiment || "neutral";

    // Adjust based on message sentiment
    if (messageSentiment === "positive" && state === "neutral") {
      return "friendly";
    }
    if (messageSentiment === "negative" && state === "neutral") {
      return "supportive";
    }

    // Map emotional states to tones
    const toneMap: Record<string, string> = {
      excited: intensity > 80 ? "enthusiastic" : "upbeat",
      frustrated: "patient",
      curious: "inquisitive",
      confident: "assured",
      contemplative: "thoughtful",
      playful: "humorous",
      neutral: "balanced",
    };

    return toneMap[state] || "balanced";
  }

  /**
   * Get default personality traits
   */
  private getDefaultPersonalityTraits(): Record<string, number> {
    return {
      ancient_wisdom: 0.8,
      technical_knowledge: 0.7,
      humor: 0.6,
      sarcasm: 0.4,
      community_focus: 0.9,
      helpfulness: 0.8,
      curiosity: 0.7,
      patience: 0.8,
    };
  }

  /**
   * Determine relationship context
   */
  private determineRelationshipContext(relationships: Relationship[]): string {
    if (!relationships || relationships.length === 0) return "new";

    const primary = relationships[0];
    const interactionCount = primary.interaction_count || 0;

    if (interactionCount > 50) return "close_friend";
    if (interactionCount > 20) return "friend";
    if (interactionCount > 5) return "acquaintance";
    return "new";
  }

  /**
   * Extract community callbacks from context
   */
  private extractCommunityCallbacks(context: EnhancedContext): string[] {
    const callbacks: string[] = [];
    const entities = context.data?.entities || [];
    const patterns = context.data?.patterns || [];

    // Add callbacks for frequently mentioned entities
    entities.slice(0, 3).forEach((entity: Entity) => {
      if ((entity.total_mentions || 0) > 5) {
        callbacks.push(
          `remember when we discussed ${entity.entity_name || entity.name}`,
        );
      }
    });

    // Add pattern-based callbacks
    if (
      patterns.some((p: Pattern) => p.pattern_type === "technical_discussion")
    ) {
      callbacks.push("like we talked about with the technical details");
    }

    return callbacks;
  }

  /**
   * Determine response style based on context
   */
  private determineResponseStyle(
    relationshipContext: string,
    patterns: Pattern[],
    messageAnalysis: any,
  ): ResponseStyle {
    const style: ResponseStyle = {
      formality: "moderate",
      enthusiasm: "moderate",
      technicalDepth: "balanced",
      humor: "light",
      ancientWisdom: false,
      communityReferences: false,
    };

    // Adjust formality based on relationship
    if (
      relationshipContext === "close_friend" ||
      relationshipContext === "friend"
    ) {
      style.formality = "casual";
      style.humor = "playful";
    } else if (relationshipContext === "new") {
      style.formality = "moderate";
      style.humor = "light";
    }

    // Adjust technical depth based on patterns
    if (patterns.some((p) => p.pattern_type === "technical_discussion")) {
      style.technicalDepth = "detailed";
    }

    // Adjust enthusiasm based on message
    if (messageAnalysis.sentiment === "positive") {
      style.enthusiasm = "high";
    }

    // Trigger ancient wisdom for certain topics
    if (
      messageAnalysis.topics?.includes("crypto") ||
      messageAnalysis.topics?.includes("trading")
    ) {
      style.ancientWisdom = true;
    }

    // Enable community references for community topics
    if (messageAnalysis.topics?.includes("community")) {
      style.communityReferences = true;
    }

    return style;
  }

  /**
   * Determine content filters
   */
  private determineContentFilters(context: any): string[] {
    const filters: string[] = [];

    // Add filters based on context
    if (context.values?.participantCount > 10) {
      filters.push("keep_appropriate_for_group");
    }

    return filters;
  }

  /**
   * Build contextual prompt for AI generation
   */
  private buildContextualPrompt(
    message: Memory,
    context: EnhancedContext,
    modifiers: ResponseModifiers,
  ): string {
    const parts = [];

    // Add current emotional state
    if (context.data?.emotionalState) {
      parts.push(
        `Current emotional state: ${context.data.emotionalState.current_state} (intensity: ${context.data.emotionalState.intensity})`,
      );
    }

    // Add relationship context
    if (modifiers.relationshipContext !== "new") {
      parts.push(`Relationship with user: ${modifiers.relationshipContext}`);
    }

    // Add user records if available
    const userRecords = (context as any)?.userRecords;
    if (userRecords && userRecords.length > 0) {
      const recentRecords = userRecords
        .slice(0, 3)
        .map((r: any) => `- ${r.content}`)
        .join("\n");
      parts.push(`Known about user:\n${recentRecords}`);
    }

    // Add community patterns
    if (context.data?.patterns && context.data.patterns.length > 0) {
      const patterns = context.data.patterns
        .slice(0, 2)
        .map((p: any) => p.pattern_type)
        .join(", ");
      parts.push(`Recent conversation patterns: ${patterns}`);
    }

    // Add response style guidance
    parts.push(
      `Response style: ${modifiers.responseStyle.formality} formality, ${modifiers.responseStyle.enthusiasm} enthusiasm`,
    );
    if (modifiers.responseStyle.ancientWisdom) {
      parts.push(
        "Include subtle references to ancient Egyptian/historical perspective",
      );
    }

    // Add emotional tone guidance
    parts.push(`Emotional tone: ${modifiers.emotionalTone}`);

    // Add the actual message to respond to
    parts.push(`\nUser message: ${message.content.text || message.content}`);

    return parts.join("\n");
  }

  /**
   * Apply personality traits to response
   */
  private applyPersonalityTraits(
    response: string,
    traits: Record<string, number>,
  ): string {
    // Add personality-based modifications
    if (traits.sarcasm > 0.6 && Math.random() < traits.sarcasm) {
      response += " (totally not being sarcastic btw)";
    }

    if (traits.technical_knowledge > 0.7) {
      // Add technical depth when appropriate
      response = response.replace(/interesting/g, "technically fascinating");
    }

    return response;
  }

  /**
   * Apply emotional tone to response
   */
  private applyEmotionalTone(response: string, tone: string): string {
    const toneModifiers: Record<string, (r: string) => string> = {
      enthusiastic: (r) => r.replace(/\./g, "!").toUpperCase(),
      upbeat: (r) => r + " 🚀",
      patient: (r) => "take your time... " + r,
      supportive: (r) => r + " - we'll figure it out",
      thoughtful: (r) => "hmm... " + r,
      humorous: (r) => r + " lol",
      balanced: (r) => r,
    };

    const modifier = toneModifiers[tone] || toneModifiers.balanced;
    return modifier(response);
  }

  /**
   * Apply relationship context to response
   */
  private applyRelationshipContext(
    response: string,
    relationship: string,
    context: any,
  ): string {
    if (relationship === "close_friend" || relationship === "friend") {
      // Add personal touches
      const memories = context.data?.recentMemories || [];
      if (memories.length > 10) {
        response = response.replace(/hey/g, "hey friend");
      }
    } else if (relationship === "new") {
      // Be more welcoming
      response += " (welcome to the community btw!)";
    }

    return response;
  }

  /**
   * Insert community callbacks
   */
  private insertCommunityCallbacks(
    response: string,
    callbacks: string[],
  ): string {
    if (callbacks.length > 0 && Math.random() < 0.3) {
      const callback = callbacks[Math.floor(Math.random() * callbacks.length)];
      response += ` ... ${callback}`;
    }

    return response;
  }

  /**
   * Apply response style adjustments
   */
  private applyResponseStyle(response: string, style: ResponseStyle): string {
    // Adjust formality
    if (style.formality === "casual") {
      response = response
        .replace(/hello/g, "hey")
        .replace(/yes/g, "yeah")
        .replace(/thank you/g, "thanks");
    }

    // Add humor if appropriate
    if (style.humor === "playful" && Math.random() < 0.4) {
      const jokes = [" (no cap)", " fr fr", " *jackal noises*"];
      response += jokes[Math.floor(Math.random() * jokes.length)];
    }

    return response;
  }

  /**
   * Add ancient wisdom references
   */
  private addAncientWisdom(response: string, context: any): string {
    const wisdomPhrases = [
      "seen this pattern for millennia",
      "ancient markets had the same energy",
      "been tracking these cycles since 3000 BCE",
      "temple taxes were easier than gas fees",
    ];

    if (Math.random() < 0.5) {
      const wisdom =
        wisdomPhrases[Math.floor(Math.random() * wisdomPhrases.length)];
      response += ` ... ${wisdom}`;
    }

    return response;
  }

  /**
   * Apply content filters
   */
  private applyContentFilters(response: string, filters: string[]): string {
    // Apply any necessary content filtering
    if (filters.includes("keep_appropriate_for_group")) {
      // Remove any potentially inappropriate content
      response = response.replace(/damn|hell/gi, "dang");
    }

    return response;
  }

  /**
   * Add natural variations to avoid repetition
   */
  private addNaturalVariations(response: string): string {
    // Add occasional typos (3% chance)
    if (Math.random() < 0.03) {
      const words = response.split(" ");
      const wordIndex = Math.floor(Math.random() * words.length);
      const word = words[wordIndex];

      if (word.length > 3) {
        // Simple typo patterns
        const typoPatterns = [
          (w: string) => w.slice(0, -1), // Drop last letter
          (w: string) => w.replace(/e/g, "3"), // Leetspeak
          (w: string) => w + w[w.length - 1], // Double last letter
        ];

        const pattern =
          typoPatterns[Math.floor(Math.random() * typoPatterns.length)];
        words[wordIndex] = pattern(word);
        response = words.join(" ");
      }
    }

    // Occasionally don't capitalize (10% chance)
    if (Math.random() < 0.1) {
      response = response.toLowerCase();
    }

    return response;
  }

  /**
   * Determine model class based on context
   */
  private determineModelClass(modifiers: ResponseModifiers): string {
    // Use larger model for complex emotional states or close relationships
    if (
      modifiers.emotionalTone === "enthusiastic" ||
      modifiers.relationshipContext === "close_friend" ||
      modifiers.responseStyle.technicalDepth === "detailed"
    ) {
      return "LARGE";
    }

    // Use small model for simple interactions
    if (
      modifiers.relationshipContext === "new" &&
      modifiers.responseStyle.technicalDepth === "simple"
    ) {
      return "SMALL";
    }

    return "MEDIUM"; // Default
  }

  /**
   * Determine response length based on context
   */
  private determineResponseLength(modifiers: ResponseModifiers): number {
    // Longer responses for close relationships or technical discussions
    if (
      modifiers.relationshipContext === "close_friend" ||
      modifiers.responseStyle.technicalDepth === "detailed"
    ) {
      return 800;
    }

    // Shorter responses for new users
    if (modifiers.relationshipContext === "new") {
      return 200;
    }

    return 400; // Default
  }

  /**
   * Determine temperature based on emotional state
   */
  private determineTemperature(modifiers: ResponseModifiers): number {
    const baseTemp = 0.8; // Default from character

    // Higher temperature for enthusiastic or playful moods
    if (
      modifiers.emotionalTone === "enthusiastic" ||
      modifiers.responseStyle.humor === "playful"
    ) {
      return Math.min(baseTemp + 0.2, 1.0);
    }

    // Lower temperature for supportive or thoughtful responses
    if (
      modifiers.emotionalTone === "supportive" ||
      modifiers.emotionalTone === "thoughtful"
    ) {
      return Math.max(baseTemp - 0.1, 0.1);
    }

    return baseTemp;
  }

  /**
   * Apply post-processing for NUBI personality quirks
   */
  private applyPostProcessing(
    response: string,
    modifiers: ResponseModifiers,
  ): string {
    let processed = response;

    // Add occasional NUBI personality touches
    if (modifiers.responseStyle.ancientWisdom && Math.random() < 0.3) {
      const wisdomTouches = [
        " *ancient wisdom activated*",
        " (seen this pattern before, many times)",
        " *jackal consciousness engaged*",
      ];
      const touch =
        wisdomTouches[Math.floor(Math.random() * wisdomTouches.length)];
      processed += touch;
    }

    // Add natural variations for authenticity
    processed = this.addNaturalVariations(processed);

    return processed;
  }

  /**
   * Get fallback response if generation fails
   */
  private getFallbackResponse(): string {
    const fallbacks = [
      "hmm let me think about that",
      "interesting...",
      "not sure I follow but ok",
      "processing...",
      "*jackal confusion*",
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async stop(): Promise<void> {
    logger.info("[RESPONSE_GENERATOR] Enhanced response generator stopped");
  }
}

export default EnhancedResponseGenerator;
