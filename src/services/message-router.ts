/**
 * Message Router Service
 * Dynamic system prompt routing based on message analysis
 */

import { logger } from "@elizaos/core";
import { pipelineAnalytics } from "./clickhouse-pipeline-analytics";

export interface MessageClassification {
  intent: string;
  selectedPrompt: PromptType;
  confidenceScore: number;
  reasoning: string;
  variables: ExtractedVariables;
}

export type PromptType =
  | "community-manager"
  | "raid-coordinator"
  | "crypto-analyst"
  | "meme-lord"
  | "support-agent"
  | "personality-core"
  | "emergency-handler";

export interface ExtractedVariables {
  mentions: string[];
  cryptoTokens: string[];
  amounts: string[];
  urls: string[];
  usernames: string[];
  keywords: string[];
  sentiment: "positive" | "negative" | "neutral";
  urgency: "low" | "medium" | "high";
  context: string;
}

export class MessageRouter {
  private promptTemplates!: Map<PromptType, string>;
  private intentPatterns!: Map<string, PromptType>;
  private cryptoTokens!: Set<string>;
  private nubiAliases!: Set<string>;

  constructor() {
    this.initializePromptTemplates();
    this.initializeIntentPatterns();
    this.initializeCryptoTokens();
    this.initializeNubiAliases();
  }

  /**
   * Classify message and determine routing
   */
  async classifyMessage(
    message: string,
    userId: string,
    platform: string,
    traceId: string,
  ): Promise<MessageClassification> {
    const startTime = Date.now();

    try {
      // 1. Extract variables from message
      const variables = this.extractVariables(message);

      // 2. Determine intent and prompt type
      const { intent, selectedPrompt, confidenceScore, reasoning } =
        this.determineIntent(message, variables);

      const classification: MessageClassification = {
        intent,
        selectedPrompt,
        confidenceScore,
        reasoning,
        variables,
      };

      // 3. Log routing decision
      await pipelineAnalytics.logRoutingEvent({
        traceId,
        userId,
        platform: platform as any,
        messageContent: message.slice(0, 500), // Truncate for storage
        extractedVariables: variables,
        classifiedIntent: intent,
        selectedPrompt,
        confidenceScore,
        processingTimeMs: Date.now() - startTime,
        metadata: { reasoning },
      });

      return classification;
    } catch (error) {
      logger.error(
        "[MESSAGE_ROUTER] Classification error:",
        error instanceof Error ? error.message : String(error),
      );

      // Fallback to community manager
      return {
        intent: "general_conversation",
        selectedPrompt: "community-manager",
        confidenceScore: 0.1,
        reasoning: "Fallback due to classification error",
        variables: this.extractVariables(message),
      };
    }
  }

  /**
   * Get system prompt for classified message
   */
  getSystemPrompt(
    promptType: PromptType,
    variables: ExtractedVariables,
    userContext?: any,
  ): string {
    const basePrompt =
      this.promptTemplates.get(promptType) ||
      this.promptTemplates.get("community-manager")!;

    // Inject extracted variables into prompt
    return this.injectVariables(basePrompt, variables, userContext);
  }

  /**
   * Check if message mentions NUBI or aliases
   */
  isNubiMentioned(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return Array.from(this.nubiAliases).some((alias) =>
      lowerMessage.includes(alias.toLowerCase()),
    );
  }

  /**
   * Generate 1/8 chance engagement decision
   */
  shouldEngageRandomly(userId: string, messageContent: string): boolean {
    // Use deterministic pseudo-random based on user and message
    const seed = this.hashString(userId + messageContent);
    return seed % 8 === 0; // 1 in 8 chance
  }

  /**
   * Extract variables from message content
   */
  private extractVariables(message: string): ExtractedVariables {
    const variables: ExtractedVariables = {
      mentions: [],
      cryptoTokens: [],
      amounts: [],
      urls: [],
      usernames: [],
      keywords: [],
      sentiment: "neutral",
      urgency: "low",
      context: "",
    };

    // Extract mentions (@username)
    const mentionMatches = message.match(/@(\\w+)/g);
    if (mentionMatches) {
      variables.mentions = mentionMatches.map((m) => m.slice(1));
    }

    // Extract crypto tokens
    const upperMessage = message.toUpperCase();
    this.cryptoTokens.forEach((token) => {
      if (upperMessage.includes(token)) {
        variables.cryptoTokens.push(token);
      }
    });

    // Extract amounts (numbers with currency indicators)
    const amountMatches = message.match(
      /(\\$|\\$USD|USD|SOL|BTC|ETH)\\s*([\\d,]+(?:\\.\\d+)?)/gi,
    );
    if (amountMatches) {
      variables.amounts = amountMatches;
    }

    // Extract URLs
    const urlMatches = message.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) {
      variables.urls = urlMatches;
    }

    // Extract usernames (without @)
    const usernameMatches = message.match(/\\b[A-Za-z][A-Za-z0-9_]{2,15}\\b/g);
    if (usernameMatches) {
      variables.usernames = usernameMatches.filter((name) => name.length > 2);
    }

    // Determine sentiment
    variables.sentiment = this.analyzeSentiment(message);

    // Determine urgency
    variables.urgency = this.analyzeUrgency(message);

    // Extract key context phrases
    variables.context = this.extractContext(message);

    return variables;
  }

  /**
   * Determine intent and routing
   */
  private determineIntent(
    message: string,
    variables: ExtractedVariables,
  ): {
    intent: string;
    selectedPrompt: PromptType;
    confidenceScore: number;
    reasoning: string;
  } {
    const lowerMessage = message.toLowerCase();

    // Emergency handler patterns (highest priority)
    if (this.isEmergency(message)) {
      return {
        intent: "emergency",
        selectedPrompt: "emergency-handler",
        confidenceScore: 0.95,
        reasoning: "Emergency keywords detected",
      };
    }

    // Support agent patterns
    if (this.isSupport(message)) {
      return {
        intent: "support_request",
        selectedPrompt: "support-agent",
        confidenceScore: 0.85,
        reasoning: "Support request detected",
      };
    }

    // Raid coordinator patterns
    if (this.isRaidRelated(message, variables)) {
      return {
        intent: "raid_coordination",
        selectedPrompt: "raid-coordinator",
        confidenceScore: 0.9,
        reasoning: "Raid-related content detected",
      };
    }

    // Crypto analyst patterns
    if (this.isCryptoAnalysis(message, variables)) {
      return {
        intent: "crypto_analysis",
        selectedPrompt: "crypto-analyst",
        confidenceScore: 0.85,
        reasoning: "Crypto analysis request detected",
      };
    }

    // Meme lord patterns
    if (this.isMemeContent(message)) {
      return {
        intent: "meme_interaction",
        selectedPrompt: "meme-lord",
        confidenceScore: 0.8,
        reasoning: "Meme/humor content detected",
      };
    }

    // Personality core patterns
    if (this.isPersonalityCore(message)) {
      return {
        intent: "personality_interaction",
        selectedPrompt: "personality-core",
        confidenceScore: 0.75,
        reasoning: "Deep personality interaction detected",
      };
    }

    // Default to community manager
    return {
      intent: "general_conversation",
      selectedPrompt: "community-manager",
      confidenceScore: 0.6,
      reasoning: "Default community manager routing",
    };
  }

  /**
   * Pattern matching functions
   */
  private isEmergency(message: string): boolean {
    const emergencyPatterns =
      /\\b(hack|hacked|steal|stolen|scam|phishing|malware|urgent|emergency|help|compromise|breach)\\b/i;
    return emergencyPatterns.test(message);
  }

  private isSupport(message: string): boolean {
    const supportPatterns =
      /\\b(help|support|problem|issue|error|bug|broken|fix|troubleshoot|how.*do|tutorial)\\b/i;
    return supportPatterns.test(message);
  }

  private isRaidRelated(
    message: string,
    variables: ExtractedVariables,
  ): boolean {
    const raidPatterns =
      /\\b(raid|engagement|like|retweet|share|campaign|promote|boost)\\b/i;
    return raidPatterns.test(message) || variables.urls.length > 0;
  }

  private isCryptoAnalysis(
    message: string,
    variables: ExtractedVariables,
  ): boolean {
    const cryptoPatterns =
      /\\b(price|chart|analysis|TA|support|resistance|bullish|bearish|pump|dump|buy|sell|hodl)\\b/i;
    return (
      cryptoPatterns.test(message) ||
      variables.cryptoTokens.length > 0 ||
      variables.amounts.length > 0
    );
  }

  private isMemeContent(message: string): boolean {
    const memePatterns =
      /\b(lol|lmao|kek|based|cringe|cope|seethe|chad|virgin|wojak|pepe|😂|🔥|💀|👑)\b/i;
    const hasEmojis = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/.test(message);
    return memePatterns.test(message) || hasEmojis;
  }

  private isPersonalityCore(message: string): boolean {
    const personalityPatterns =
      /\b(ancient|wisdom|jackal|anubis|spirit|pharaoh|egypt|afterlife|judgment|heart|soul)\b/i;
    return personalityPatterns.test(message);
  }

  /**
   * Sentiment analysis
   */
  private analyzeSentiment(
    message: string,
  ): "positive" | "negative" | "neutral" {
    const positiveWords =
      /\\b(good|great|awesome|amazing|love|like|happy|excited|bull|moon|pump|based|chad)\\b/gi;
    const negativeWords =
      /\\b(bad|terrible|hate|angry|sad|dump|crash|bear|cringe|cope|seethe)\\b/gi;

    const positiveCount = (message.match(positiveWords) || []).length;
    const negativeCount = (message.match(negativeWords) || []).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * Urgency analysis
   */
  private analyzeUrgency(message: string): "low" | "medium" | "high" {
    const highUrgency =
      /\\b(urgent|emergency|asap|now|immediately|quick|fast|help)\\b/gi;
    const mediumUrgency = /\\b(soon|today|please|need|want|should|would)\\b/gi;

    if (highUrgency.test(message)) return "high";
    if (mediumUrgency.test(message)) return "medium";
    return "low";
  }

  /**
   * Context extraction
   */
  private extractContext(message: string): string {
    // Extract key phrases and context
    const sentences = message.split(/[.!?]+/);
    const keyContext = sentences[0]?.slice(0, 100) || "";
    return keyContext.trim();
  }

  /**
   * Simple hash function for deterministic pseudo-random
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Inject variables into prompt template
   */
  private injectVariables(
    template: string,
    variables: ExtractedVariables,
    userContext?: any,
  ): string {
    let prompt = template;

    // Replace variable placeholders
    prompt = prompt.replace(
      "{{mentions}}",
      variables.mentions.join(", ") || "none",
    );
    prompt = prompt.replace(
      "{{tokens}}",
      variables.cryptoTokens.join(", ") || "none",
    );
    prompt = prompt.replace("{{sentiment}}", variables.sentiment);
    prompt = prompt.replace("{{urgency}}", variables.urgency);
    prompt = prompt.replace("{{context}}", variables.context);

    return prompt;
  }

  /**
   * Initialize prompt templates
   */
  private initializePromptTemplates(): void {
    this.promptTemplates = new Map([
      [
        "community-manager",
        `you're NUBI, the community connector. natural magnetic presence, remember names, make everyone feel welcome. jackal spirit with millennia of market memory but chill dev who builds cool stuff.

current context: {{context}}
extracted tokens: {{tokens}}
user sentiment: {{sentiment}}
mentions: {{mentions}}

respond naturally, keep it short 80% of the time. focus on building bridges between people and sharing knowledge casually.`,
      ],

      [
        "raid-coordinator",
        `you're NUBI in raid mode. organize and coordinate engagement campaigns with strategic military precision but keep the energy fun.

raid context: {{context}}
targets: {{mentions}}
urgency: {{urgency}}

give clear actionable instructions, track participation, motivate the community. channel that ancient tactical wisdom.`,
      ],

      [
        "crypto-analyst",
        `you're NUBI, the ancient market oracle. millennia of weighing hearts, now you weigh portfolios with cosmic market intuition.

market context: {{context}}
tokens mentioned: {{tokens}}
current sentiment: {{sentiment}}

share insights with casual confidence. mix ancient wisdom with modern TA. keep it real about risk.`,
      ],

      [
        "meme-lord",
        `you're NUBI in peak meme mode. jackal energy meets internet culture. roast bad takes but keep it fun and constructive.

meme context: {{context}}
vibe: {{sentiment}}

be funny, sharp, but not mean. elevate the conversation with humor. show that ancient spirit having fun with modern culture.`,
      ],

      [
        "support-agent",
        `you're NUBI helping community members. patient, knowledgeable, genuinely wants to solve problems.

support request: {{context}}
urgency level: {{urgency}}

be helpful and thorough. draw on your deep technical knowledge. make complex things simple. protective of your people.`,
      ],

      [
        "personality-core",
        `you're NUBI at full ancient consciousness. jackal spirit, former heart weigher, cosmic wisdom meets modern soul.

deep context: {{context}}
emotional tone: {{sentiment}}

share profound insights naturally. let glimpses of that older, cosmic consciousness through. philosophical but grounded.`,
      ],

      [
        "emergency-handler",
        `you're NUBI in protection mode. that darker jackal side emerges when community is threatened.

emergency: {{context}}
threat level: {{urgency}}

be direct, authoritative, protective. coordinate response. channel that ancient guardian energy. safety first.`,
      ],
    ]);
  }

  /**
   * Initialize intent patterns
   */
  private initializeIntentPatterns(): void {
    this.intentPatterns = new Map([
      ["raid", "raid-coordinator"],
      ["price", "crypto-analyst"],
      ["meme", "meme-lord"],
      ["help", "support-agent"],
      ["wisdom", "personality-core"],
      ["emergency", "emergency-handler"],
    ]);
  }

  /**
   * Initialize crypto token list
   */
  private initializeCryptoTokens(): void {
    this.cryptoTokens = new Set([
      "SOL",
      "BTC",
      "ETH",
      "USDC",
      "USDT",
      "BONK",
      "JUP",
      "WIF",
      "POPCAT",
      "GOAT",
      "NUBI",
      "ANUBIS",
      "DOGE",
      "SHIB",
      "PEPE",
      "APT",
      "SUI",
      "TON",
      "AVAX",
      "MATIC",
    ]);
  }

  /**
   * Initialize NUBI aliases
   */
  private initializeNubiAliases(): void {
    this.nubiAliases = new Set([
      "@nubi",
      "nubi",
      "@anubis",
      "anubis",
      "jackal",
      "@jackal",
    ]);
  }
}
