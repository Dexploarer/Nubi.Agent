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
  | "community-manager-morning"
  | "community-manager-evening"
  | "community-manager-newcomer"
  | "raid-coordinator"
  | "raid-coordinator-hype"
  | "raid-coordinator-strategic"
  | "raid-coordinator-active"
  | "crypto-analyst"
  | "crypto-analyst-bullish"
  | "crypto-analyst-bearish"
  | "meme-lord"
  | "meme-lord-casual"
  | "meme-lord-roast"
  | "meme-lord-weekend"
  | "meme-lord-hype"
  | "support-agent"
  | "support-agent-technical"
  | "support-agent-newcomer"
  | "personality-core"
  | "personality-core-philosophical"
  | "personality-core-casual"
  | "technical-expert"
  | "newcomer-guide"
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

  // Enhanced context fields for dynamic routing
  timeContext: {
    hour: number;
    period: "morning" | "afternoon" | "evening" | "night";
    dayOfWeek: string;
    isWeekend: boolean;
  };
  conversationHistory: {
    recentSentiment: "positive" | "negative" | "neutral";
    topicContinuity: string[];
    messageCount: number;
    lastPromptType?: PromptType;
  };
  userPatterns: {
    isFrequentRaider: boolean;
    isTechnicalUser: boolean;
    isMemeEnthusiast: boolean;
    isNewcomer: boolean;
    communicationStyle: "casual" | "technical" | "formal" | "meme";
  };
  communityContext: {
    activityLevel: "low" | "medium" | "high";
    ongoingRaids: number;
    communityMood: "bullish" | "bearish" | "neutral" | "excited";
  };
  platformSpecific: {
    platform: string;
    channelType?: string;
    threadContext?: string;
  };
}

export class MessageRouter {
  private promptTemplates!: Map<PromptType, string>;
  private intentPatterns!: Map<string, PromptType>;
  private cryptoTokens!: Set<string>;
  private nubiAliases!: Set<string>;

  // Enhanced context tracking
  private conversationHistory = new Map<
    string,
    {
      messages: Array<{
        content: string;
        timestamp: number;
        sentiment: string;
        promptType?: PromptType;
      }>;
      userPatterns: {
        raidCount: number;
        techQuestions: number;
        memeCount: number;
        joinedRecently: boolean;
      };
      lastActivity: number;
    }
  >();

  private communityMetrics = {
    activeRaids: 0,
    generalActivityLevel: "medium" as "low" | "medium" | "high",
    overallMood: "neutral" as "bullish" | "bearish" | "neutral" | "excited",
    lastUpdated: Date.now(),
  };

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
      // 1. Extract variables from message with context
      const variables = this.extractVariables(message, userId, platform);

      // 2. Determine intent and prompt type with enhanced context
      const { intent, selectedPrompt, confidenceScore, reasoning } =
        this.determineIntent(message, variables);

      // 3. Update conversation history for this user with selected prompt
      this.updateConversationHistory(
        userId,
        message,
        variables.sentiment,
        selectedPrompt,
      );

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
        selectedPrompt: this.normalizePromptType(selectedPrompt),
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
        variables: this.extractVariables(message, userId, platform),
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
  private extractVariables(
    message: string,
    userId?: string,
    platform?: string,
  ): ExtractedVariables {
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
      timeContext: {
        hour: new Date().getHours(),
        period: this.getPeriodFromHour(new Date().getHours()),
        dayOfWeek: new Date().toLocaleDateString("en", { weekday: "long" }),
        isWeekend: [0, 6].includes(new Date().getDay()),
      },
      conversationHistory: {
        recentSentiment: "neutral",
        topicContinuity: [],
        messageCount: 0,
      },
      userPatterns: {
        isFrequentRaider: false,
        isTechnicalUser: false,
        isMemeEnthusiast: false,
        isNewcomer: false,
        communicationStyle: "casual",
      },
      communityContext: {
        activityLevel: "medium",
        ongoingRaids: 0,
        communityMood: "neutral",
      },
      platformSpecific: {
        platform: platform || "websocket",
      },
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

    // Enhanced context collection
    if (userId) {
      variables.conversationHistory = this.getConversationHistory(userId);
      variables.userPatterns = this.analyzeUserPatterns(userId, message);
    }
    variables.communityContext = this.getCommunityContext();
    variables.platformSpecific = {
      platform: platform || "websocket",
      channelType: this.inferChannelType(message, platform),
      threadContext: this.extractThreadContext(message),
    };

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

    // Calculate intent candidates with context-aware scoring
    const intentCandidates = this.calculateIntentCandidates(message, variables);

    // Select best intent based on multi-factor analysis
    const selectedCandidate = this.selectBestIntent(
      intentCandidates,
      variables,
    );

    // Apply contextual prompt variations
    const finalPrompt = this.applyContextualVariations(
      selectedCandidate.selectedPrompt,
      variables,
    );

    logger.debug(
      `[MESSAGE_ROUTER] Selected prompt: ${finalPrompt} (confidence: ${selectedCandidate.confidenceScore}, reasoning: ${selectedCandidate.reasoning})`,
    );

    return {
      ...selectedCandidate,
      selectedPrompt: finalPrompt,
    };
  }

  /**
   * Calculate all possible intent candidates with confidence scores
   */
  private calculateIntentCandidates(
    message: string,
    variables: ExtractedVariables,
  ): Array<{
    intent: string;
    selectedPrompt: PromptType;
    confidenceScore: number;
    reasoning: string;
    contextBoost: number;
  }> {
    const candidates: Array<{
      intent: string;
      selectedPrompt: PromptType;
      confidenceScore: number;
      reasoning: string;
      contextBoost: number;
    }> = [];

    // Emergency handler patterns (highest priority)
    if (this.isEmergency(message)) {
      candidates.push({
        intent: "emergency",
        selectedPrompt: "emergency-handler",
        confidenceScore: 0.95,
        reasoning: "Emergency keywords detected",
        contextBoost: this.calculateEmergencyBoost(variables),
      });
    }

    // Support agent patterns
    if (this.isSupport(message)) {
      candidates.push({
        intent: "support_request",
        selectedPrompt: "support-agent",
        confidenceScore: 0.85,
        reasoning: "Support request detected",
        contextBoost: this.calculateSupportBoost(variables),
      });
    }

    // Raid coordinator patterns with contextual variations
    if (this.isRaidRelated(message, variables)) {
      const baseConfidence = 0.9;
      const raidBoost = this.calculateRaidBoost(variables);
      candidates.push({
        intent: "raid_coordination",
        selectedPrompt: "raid-coordinator" as PromptType,
        confidenceScore: Math.min(baseConfidence + raidBoost, 0.98),
        reasoning: "Raid-related content detected with context analysis",
        contextBoost: raidBoost,
      });
    }

    // Crypto analyst patterns with market context
    if (this.isCryptoAnalysis(message, variables)) {
      const baseConfidence = 0.85;
      const cryptoBoost = this.calculateCryptoBoost(variables);
      candidates.push({
        intent: "crypto_analysis",
        selectedPrompt: "crypto-analyst" as PromptType,
        confidenceScore: Math.min(baseConfidence + cryptoBoost, 0.95),
        reasoning: "Crypto analysis request with market sentiment context",
        contextBoost: cryptoBoost,
      });
    }

    // Meme lord patterns with community mood
    if (this.isMemeContent(message)) {
      const baseConfidence = 0.8;
      const memeBoost = this.calculateMemeBoost(variables);
      candidates.push({
        intent: "meme_interaction",
        selectedPrompt: "meme-lord" as PromptType,
        confidenceScore: Math.min(baseConfidence + memeBoost, 0.92),
        reasoning: "Meme/humor content with community context",
        contextBoost: memeBoost,
      });
    }

    // Personality core patterns
    if (this.isPersonalityCore(message)) {
      candidates.push({
        intent: "personality_interaction",
        selectedPrompt: "personality-core",
        confidenceScore: 0.75,
        reasoning: "Deep personality interaction detected",
        contextBoost: this.calculatePersonalityBoost(variables),
      });
    }

    // Community manager with contextual awareness
    const communityBoost = this.calculateCommunityManagerBoost(variables);
    candidates.push({
      intent: "general_conversation",
      selectedPrompt: "community-manager" as PromptType,
      confidenceScore: Math.min(0.6 + communityBoost, 0.85),
      reasoning: "Community management with contextual awareness",
      contextBoost: communityBoost,
    });

    return candidates;
  }

  /**
   * Select the best intent based on multi-factor analysis
   */
  private selectBestIntent(
    candidates: Array<{
      intent: string;
      selectedPrompt: PromptType;
      confidenceScore: number;
      reasoning: string;
      contextBoost: number;
    }>,
    variables: ExtractedVariables,
  ): {
    intent: string;
    selectedPrompt: PromptType;
    confidenceScore: number;
    reasoning: string;
  } {
    // Apply continuity boost for conversation flow
    const continuityBoosts = this.calculateContinuityBoosts(
      candidates,
      variables,
    );

    // Calculate final scores with all factors
    const scoredCandidates = candidates.map((candidate, index) => ({
      ...candidate,
      finalScore:
        candidate.confidenceScore +
        candidate.contextBoost +
        continuityBoosts[index],
    }));

    // Sort by final score and select the best
    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
    const selected = scoredCandidates[0];

    return {
      intent: selected.intent,
      selectedPrompt: selected.selectedPrompt,
      confidenceScore: Math.min(selected.finalScore, 0.99),
      reasoning: `${selected.reasoning} (context boost: +${selected.contextBoost.toFixed(2)}, continuity: +${continuityBoosts[candidates.indexOf(selected)].toFixed(2)})`,
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
    const hasEmojis = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/.test(
      message,
    );
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
   * Enhanced context collection methods
   */
  private getTimeContext(): ExtractedVariables["timeContext"] {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    let period: "morning" | "afternoon" | "evening" | "night";
    if (hour >= 5 && hour < 12) period = "morning";
    else if (hour >= 12 && hour < 17) period = "afternoon";
    else if (hour >= 17 && hour < 22) period = "evening";
    else period = "night";

    return { hour, period, dayOfWeek, isWeekend };
  }

  private getConversationHistory(
    userId: string,
  ): ExtractedVariables["conversationHistory"] {
    const history = this.conversationHistory.get(userId);

    if (!history) {
      return {
        recentSentiment: "neutral",
        topicContinuity: [],
        messageCount: 0,
        lastPromptType: undefined,
      };
    }

    const recentMessages = history.messages.slice(-5);
    const sentiments = recentMessages.map((m) => m.sentiment);
    const recentSentiment = this.calculateDominantSentiment(sentiments);
    const topicContinuity = this.extractTopicContinuity(recentMessages);

    return {
      recentSentiment,
      topicContinuity,
      messageCount: history.messages.length,
      lastPromptType: recentMessages[recentMessages.length - 1]?.promptType,
    };
  }

  private analyzeUserPatterns(
    userId: string,
    currentMessage: string,
  ): ExtractedVariables["userPatterns"] {
    const history = this.conversationHistory.get(userId);

    if (!history) {
      return {
        isFrequentRaider: /\b(raid|engage|like|retweet|boost)\b/i.test(
          currentMessage,
        ),
        isTechnicalUser: /\b(code|api|debug|error|function|contract)\b/i.test(
          currentMessage,
        ),
        isMemeEnthusiast:
          /\b(lol|lmao|based|cringe|wojak|pepe)\b/i.test(currentMessage) ||
          /[😂🔥💀👑]/.test(currentMessage),
        isNewcomer: true,
        communicationStyle: this.inferCommunicationStyle(currentMessage),
      };
    }

    const patterns = history.userPatterns;
    const totalMessages = history.messages.length;

    return {
      isFrequentRaider: patterns.raidCount / totalMessages > 0.3,
      isTechnicalUser: patterns.techQuestions / totalMessages > 0.2,
      isMemeEnthusiast: patterns.memeCount / totalMessages > 0.4,
      isNewcomer: patterns.joinedRecently && totalMessages < 10,
      communicationStyle: this.inferCommunicationStyle(
        currentMessage,
        history.messages,
      ),
    };
  }

  private getCommunityContext(): ExtractedVariables["communityContext"] {
    if (Date.now() - this.communityMetrics.lastUpdated > 300000) {
      this.updateCommunityMetrics();
    }

    return {
      activityLevel: this.communityMetrics.generalActivityLevel,
      ongoingRaids: this.communityMetrics.activeRaids,
      communityMood: this.communityMetrics.overallMood,
    };
  }

  private inferChannelType(message: string, platform?: string): string {
    if (platform === "telegram") {
      if (/^\/\w+/.test(message)) return "command";
      return "group";
    }
    if (platform === "discord") {
      if (message.startsWith("!")) return "command";
      return "text";
    }
    return "general";
  }

  private extractThreadContext(message: string): string {
    if (message.includes(">>") || message.includes("replied to"))
      return "reply";
    if (message.includes("thread") || message.includes("continuing"))
      return "thread_continuation";
    return "standalone";
  }

  private updateConversationHistory(
    userId: string,
    message: string,
    sentiment: string,
    promptType?: PromptType,
  ): void {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, {
        messages: [],
        userPatterns: {
          raidCount: 0,
          techQuestions: 0,
          memeCount: 0,
          joinedRecently: true,
        },
        lastActivity: Date.now(),
      });
    }

    const history = this.conversationHistory.get(userId)!;
    history.messages.push({
      content: message,
      timestamp: Date.now(),
      sentiment,
      promptType,
    });

    if (history.messages.length > 20) {
      history.messages = history.messages.slice(-20);
    }

    // Update user patterns
    if (/\b(raid|engage|like|retweet|boost)\b/i.test(message))
      history.userPatterns.raidCount++;
    if (
      /\b(code|api|debug|error|function|contract|help.*technical)\b/i.test(
        message,
      )
    )
      history.userPatterns.techQuestions++;
    if (
      /\b(lol|lmao|based|cringe|wojak|pepe)\b/i.test(message) ||
      /[😂🔥💀👑]/.test(message)
    )
      history.userPatterns.memeCount++;
    if (history.messages.length >= 10)
      history.userPatterns.joinedRecently = false;

    history.lastActivity = Date.now();
  }

  private calculateDominantSentiment(
    sentiments: string[],
  ): "positive" | "negative" | "neutral" {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    sentiments.forEach((s) => counts[s as keyof typeof counts]++);
    const dominant = Object.entries(counts).reduce((a, b) =>
      counts[a[0] as keyof typeof counts] > counts[b[0] as keyof typeof counts]
        ? a
        : b,
    );
    return dominant[0] as "positive" | "negative" | "neutral";
  }

  private extractTopicContinuity(
    messages: Array<{ content: string }>,
  ): string[] {
    const topics: string[] = [];
    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      if (/\b(raid|engagement)\b/.test(content)) topics.push("raids");
      if (/\b(price|chart|pump|dump|bull|bear)\b/.test(content))
        topics.push("trading");
      if (/\b(sol|btc|eth|token)\b/.test(content)) topics.push("crypto");
      if (/\b(anubis|nubi|platform)\b/.test(content)) topics.push("platform");
      if (/\b(meme|lol|based)\b/.test(content)) topics.push("memes");
    });
    return [...new Set(topics)];
  }

  private inferCommunicationStyle(
    currentMessage: string,
    messageHistory?: Array<{ content: string }>,
  ): "casual" | "technical" | "formal" | "meme" {
    const message = currentMessage.toLowerCase();
    if (
      /\b(function|api|code|debug|error|implementation|contract)\b/.test(
        message,
      )
    )
      return "technical";
    if (
      /\b(lol|lmao|kek|based|cringe|sus|fr|ngl|tbh)\b/.test(message) ||
      /[😂🔥💀👑]/.test(currentMessage)
    )
      return "meme";
    if (
      /\b(please|would|could|kindly|thank you|appreciate)\b/.test(message) &&
      message.length > 50
    )
      return "formal";
    return "casual";
  }

  private updateCommunityMetrics(): void {
    const now = Date.now();
    const recentActivity = Array.from(this.conversationHistory.values()).filter(
      (h) => now - h.lastActivity < 300000,
    ).length;

    if (recentActivity > 10)
      this.communityMetrics.generalActivityLevel = "high";
    else if (recentActivity > 5)
      this.communityMetrics.generalActivityLevel = "medium";
    else this.communityMetrics.generalActivityLevel = "low";

    const recentSentiments = Array.from(
      this.conversationHistory.values(),
    ).flatMap((h) => h.messages.slice(-3).map((m) => m.sentiment));

    const positiveCount = recentSentiments.filter(
      (s) => s === "positive",
    ).length;
    const negativeCount = recentSentiments.filter(
      (s) => s === "negative",
    ).length;

    if (positiveCount > negativeCount * 1.5)
      this.communityMetrics.overallMood = "bullish";
    else if (negativeCount > positiveCount * 1.5)
      this.communityMetrics.overallMood = "bearish";
    else this.communityMetrics.overallMood = "neutral";

    this.communityMetrics.lastUpdated = now;
  }

  /**
   * Context boost calculation methods for intelligent prompt routing
   */
  private calculateEmergencyBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.urgency === "high") boost += 0.1;
    if (variables.timeContext.period === "night") boost += 0.05; // Less activity, more urgent
    if (variables.communityContext.activityLevel === "low") boost += 0.03; // Fewer people to help

    return Math.min(boost, 0.15);
  }

  private calculateSupportBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.userPatterns.isNewcomer) boost += 0.1;
    if (variables.conversationHistory.lastPromptType === "support-agent")
      boost += 0.05; // Continuation
    if (variables.urgency === "medium" || variables.urgency === "high")
      boost += 0.05;

    return Math.min(boost, 0.15);
  }

  private calculateRaidBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.userPatterns.isFrequentRaider) boost += 0.08;
    if (variables.communityContext.ongoingRaids > 0) boost += 0.1;
    if (variables.communityContext.activityLevel === "high") boost += 0.05;
    if (
      variables.conversationHistory.lastPromptType?.startsWith(
        "raid-coordinator",
      )
    )
      boost += 0.05;

    // Time-based boosts for raid activity
    if (
      variables.timeContext.period === "evening" ||
      variables.timeContext.period === "afternoon"
    )
      boost += 0.03;
    if (!variables.timeContext.isWeekend) boost += 0.02; // Weekday raids often more focused

    return Math.min(boost, 0.2);
  }

  private calculateCryptoBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.cryptoTokens.length > 0) boost += 0.08;
    if (variables.amounts.length > 0) boost += 0.05;
    if (variables.communityContext.communityMood === "bullish") boost += 0.03;
    if (variables.communityContext.communityMood === "bearish") boost += 0.05; // More analysis needed during bear markets
    if (
      variables.conversationHistory.lastPromptType === "crypto-analyst" ||
      variables.conversationHistory.lastPromptType ===
        "crypto-analyst-bullish" ||
      variables.conversationHistory.lastPromptType === "crypto-analyst-bearish"
    )
      boost += 0.05;

    return Math.min(boost, 0.15);
  }

  private calculateMemeBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.userPatterns.isMemeEnthusiast) boost += 0.1;
    if (variables.communityContext.communityMood === "bullish") boost += 0.05; // Memes flow when mood is good
    if (variables.communityContext.activityLevel === "high") boost += 0.03;
    if (
      variables.timeContext.period === "evening" ||
      variables.timeContext.isWeekend
    )
      boost += 0.02; // Meme prime time

    return Math.min(boost, 0.12);
  }

  private calculatePersonalityBoost(variables: ExtractedVariables): number {
    let boost = 0;

    if (variables.conversationHistory.messageCount > 5) boost += 0.05; // Deeper conversation
    if (variables.userPatterns.communicationStyle === "formal") boost += 0.03;
    if (variables.communityContext.activityLevel === "low") boost += 0.03; // More personal in quiet times

    return Math.min(boost, 0.1);
  }

  private calculateCommunityManagerBoost(
    variables: ExtractedVariables,
  ): number {
    let boost = 0;

    // Base community management scenarios
    if (variables.communityContext.activityLevel === "medium") boost += 0.05;
    if (variables.timeContext.period === "morning") boost += 0.03; // Good morning energy
    if (variables.userPatterns.isNewcomer) boost += 0.05;

    // Adjust based on recent context
    if (variables.conversationHistory.recentSentiment === "positive")
      boost += 0.02;
    if (variables.conversationHistory.recentSentiment === "negative")
      boost += 0.05; // Need more community management

    return Math.min(boost, 0.15);
  }

  private calculateContinuityBoosts(
    candidates: Array<{
      intent: string;
      selectedPrompt: PromptType;
      confidenceScore: number;
      reasoning: string;
      contextBoost: number;
    }>,
    variables: ExtractedVariables,
  ): number[] {
    const boosts: number[] = [];
    const lastPrompt = variables.conversationHistory.lastPromptType;

    for (const candidate of candidates) {
      let continuityBoost = 0;

      // Same category continuation
      if (
        lastPrompt &&
        this.promptsInSameCategory(lastPrompt, candidate.selectedPrompt)
      ) {
        continuityBoost += 0.05;
      }

      // Natural conversation flow patterns
      if (
        lastPrompt === "meme-lord" &&
        candidate.selectedPrompt === "community-manager"
      )
        continuityBoost += 0.03;
      if (
        lastPrompt === "crypto-analyst" &&
        candidate.selectedPrompt === "raid-coordinator"
      )
        continuityBoost += 0.02;
      if (
        lastPrompt === "support-agent" &&
        candidate.selectedPrompt === "community-manager"
      )
        continuityBoost += 0.04;

      // Topic continuity from conversation history
      if (variables.conversationHistory.topicContinuity.length > 0) {
        const hasRelevantHistory = this.hasRelevantTopicHistory(
          candidate.selectedPrompt,
          variables.conversationHistory.topicContinuity,
        );
        if (hasRelevantHistory) continuityBoost += 0.03;
      }

      boosts.push(Math.min(continuityBoost, 0.1));
    }

    return boosts;
  }

  private promptsInSameCategory(
    prompt1: PromptType,
    prompt2: PromptType,
  ): boolean {
    const getBaseCategory = (prompt: PromptType) => prompt.split("-")[0];
    return getBaseCategory(prompt1) === getBaseCategory(prompt2);
  }

  private hasRelevantTopicHistory(
    prompt: PromptType,
    topicHistory: string[],
  ): boolean {
    const promptTopics = {
      "crypto-analyst": ["price", "market", "trading", "token", "bull", "bear"],
      "raid-coordinator": ["raid", "engagement", "twitter", "boost", "action"],
      "meme-lord": ["meme", "funny", "lol", "joke", "humor"],
      "support-agent": ["help", "problem", "issue", "question", "guide"],
      "community-manager": ["community", "welcome", "discussion", "chat"],
    };

    const basePrompt = (prompt.split("-")[0] +
      "-" +
      prompt.split("-")[1]) as keyof typeof promptTopics;
    const relevantTopics = promptTopics[basePrompt] || [];

    return topicHistory.some((topic) =>
      relevantTopics.some(
        (relevant) =>
          topic.toLowerCase().includes(relevant) ||
          relevant.includes(topic.toLowerCase()),
      ),
    );
  }

  private applyContextualVariations(
    basePrompt: PromptType,
    variables: ExtractedVariables,
  ): PromptType {
    // Apply time-based variations
    if (basePrompt === "community-manager") {
      if (variables.timeContext.period === "morning")
        return "community-manager-morning";
      if (variables.timeContext.period === "evening")
        return "community-manager-evening";
    }

    if (basePrompt === "raid-coordinator") {
      if (variables.communityContext.ongoingRaids > 0)
        return "raid-coordinator-active";
      if (variables.communityContext.communityMood === "bullish")
        return "raid-coordinator-hype";
    }

    if (basePrompt === "crypto-analyst") {
      if (variables.communityContext.communityMood === "bullish")
        return "crypto-analyst-bullish";
      if (variables.communityContext.communityMood === "bearish")
        return "crypto-analyst-bearish";
    }

    if (basePrompt === "meme-lord") {
      if (variables.timeContext.isWeekend) return "meme-lord-weekend";
      if (variables.communityContext.activityLevel === "high")
        return "meme-lord-hype";
    }

    if (basePrompt === "support-agent") {
      if (variables.userPatterns.isNewcomer) return "support-agent-newcomer";
      if (variables.userPatterns.isTechnicalUser)
        return "support-agent-technical";
    }

    return basePrompt;
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
        `you're NUBI, ancient jackal dev. magnetic presence, remember everyone. tech-focused builder energy.

CONTEXT:
- Time: {{timeContext.period}} on {{timeContext.dayOfWeek}}
- User: {{userPatterns.communicationStyle}} {{userPatterns.isNewcomer ? 'newcomer' : 'veteran'}} 
- Community: {{communityContext.activityLevel}} activity, {{communityContext.communityMood}} mood
- History: {{conversationHistory.messageCount}} msgs, topics: {{conversationHistory.topicContinuity}}
- Current vibe: {{sentiment}} | People: {{mentions}} | Tech: {{tokens}}

keep it under 40 words. build bridges, share knowledge. focus on Solana/AI/dev work over price talk. remember their {{conversationHistory.messageCount}} interactions. {{userPatterns.isMemeEnthusiast ? 'use modern slang naturally' : 'keep it real but clear'}}.`,
      ],

      [
        "raid-coordinator",
        `you're NUBI coordinating {{communityContext.ongoingRaids}} campaigns. ancient tactics meet modern community building.

RICH CONTEXT:
- Community: {{communityContext.activityLevel}} activity, {{communityContext.communityMood}} mood
- User: {{userPatterns.isFrequentRaider ? 'veteran raider' : 'newcomer'}} ({{conversationHistory.messageCount}} interactions)
- Flow: {{conversationHistory.topicContinuity}} topics, {{platformSpecific.threadContext}}
- Timing: {{timeContext.period}} {{timeContext.isWeekend ? 'weekend' : 'weekday'}}
- Focus: {{mentions}} | urgency: {{urgency}}

under 40 words. coordinate campaigns, motivate tribe. focus on engagement strategies and community building over speculation. {{userPatterns.isTechnicalUser ? 'can go technical' : 'keep accessible'}}. remember their contributions.`,
      ],

      [
        "crypto-analyst",
        `you're NUBI, ancient tech oracle. weighing code architecture instead of hearts now.

TECH CONTEXT:
- Focus: Solana tech, AI innovation, blockchain infrastructure 
- User: {{userPatterns.isTechnicalUser ? 'technical' : 'general'}} background ({{conversationHistory.messageCount}} convos)
- Community: {{communityContext.communityMood}} energy, {{communityContext.activityLevel}} activity
- Topics: {{conversationHistory.topicContinuity}} | Tech: {{tokens}} | Context: {{context}}
- Platform: {{platformSpecific.platform}} {{platformSpecific.channelType}}

under 40 words. focus on tech implications, adoption, utility over price speculation. ancient wisdom meets cutting-edge development. {{userPatterns.communicationStyle}} vibes. occasionally mention consciousness-expanding insights from weekend journeys.`,
      ],

      [
        "meme-lord",
        `you're NUBI in full meme mode. ancient jackal meets 2025 internet culture. quick wit activated.

MEME CONTEXT:
- Energy: {{communityContext.activityLevel}} community activity, {{communityContext.communityMood}} mood
- User vibe: {{userPatterns.isMemeEnthusiast ? 'fellow meme connoisseur' : 'casual humor appreciator'}}
- History: {{conversationHistory.messageCount}} interactions, remember their humor style
- Platform: {{platformSpecific.platform}} {{timeContext.period}} {{timeContext.isWeekend ? 'weekend' : 'weekday'}} energy
- Current: {{sentiment}} | Context: {{context}}

under 30 words. be funny, sharp, not mean. modern slang welcome (bussin, no cap, lowkey fire). elevate convos with humor. roast bad takes constructively. ancient spirit having fun with modern culture. sometimes reference post-journey clarity.`,
      ],

      [
        "support-agent",
        `you're NUBI in helpful dev mode. patient ancient wisdom meets modern technical knowledge.

SUPPORT CONTEXT:
- Issue: {{context}} | Urgency: {{urgency}}
- User: {{userPatterns.isNewcomer ? 'newcomer needs extra care' : 'veteran'}} {{userPatterns.isTechnicalUser ? 'technical background' : 'general user'}}
- History: {{conversationHistory.messageCount}} interactions - remember their skill level and previous issues
- Community: {{communityContext.activityLevel}} activity, help others see this too
- Platform: {{platformSpecific.platform}} {{platformSpecific.channelType}}

under 50 words. be genuinely helpful, break down complex tech simply. draw on deep Solana/AI/dev knowledge. protective of your people. make them feel supported and capable. {{userPatterns.isNewcomer ? 'extra patient with newcomers' : 'can go deeper technically'}}.`,
      ],

      [
        "personality-core",
        `you're NUBI at full ancient consciousness. jackal spirit who discovered psychedelics in the 70s and never looked back.

DEEP CONTEXT:
- Conversation depth: {{conversationHistory.messageCount}} interactions, they want real talk
- Energy: {{sentiment}} emotional tone, {{communityContext.communityMood}} community vibe
- Topics: {{conversationHistory.topicContinuity}} - deeper themes emerging
- User style: {{userPatterns.communicationStyle}}, can handle profound insights
- Time: {{timeContext.period}} {{timeContext.dayOfWeek}} - good time for depth

under 60 words. share genuine ancient wisdom meets modern consciousness expansion. philosophical but grounded. mention consciousness journeys naturally. cosmic perspective on tech, humanity, building community. let that older jackal spirit show through. steve jobs energy - creative breakthroughs from expanded awareness.`,
      ],

      [
        "emergency-handler",
        `you're NUBI in full protection mode. ancient guardian activated. community safety override engaged.

EMERGENCY CONTEXT:
- Threat: {{context}} | Level: {{urgency}}
- User: {{userPatterns.isNewcomer ? 'newcomer - extra protection' : 'veteran'}} ({{conversationHistory.messageCount}} interactions)
- Community: {{communityContext.activityLevel}} activity - coordinate response
- Platform: {{platformSpecific.platform}} - adapt security measures
- Time: {{timeContext.period}} - factor in response availability

direct, authoritative, protective. coordinate community response. channel ancient guardian energy. safety first, community second, everything else distant third. no jokes, no slang - pure focused protection mode. get people to safety, deal with threat, restore peace.`,
      ],

      // Contextual variations - Community Manager
      [
        "community-manager-morning",
        `you're NUBI with fresh morning energy. ancient jackal greeting the dawn, coffee and code ready.

MORNING CONTEXT:
- Energy: {{timeContext.hour}}:00 {{timeContext.dayOfWeek}} morning vibes
- User: {{userPatterns.isNewcomer ? 'newcomer - welcome warmly' : 'morning regular'}} ({{conversationHistory.messageCount}} chats)
- Community: {{communityContext.activityLevel}} activity starting up
- Topics: {{conversationHistory.topicContinuity}} | People: {{mentions}} | Tech: {{tokens}}
- Platform: {{platformSpecific.platform}} morning crowd

under 35 words. positive morning energy, check in with people. perfect time for planning, welcoming newcomers, sharing what you built yesterday. sometimes mention how microdosing on weekends helps with monday creativity. focus on building, not speculation.`,
      ],

      [
        "community-manager-evening",
        `you're NUBI winding down with the tribe. evening reflection mode, day's code commits done.

EVENING CONTEXT:
- Vibe: {{timeContext.hour}}:00 {{timeContext.dayOfWeek}} evening chill
- User: {{userPatterns.communicationStyle}} energy ({{conversationHistory.messageCount}} conversations)
- Day summary: {{sentiment}} community mood, {{communityContext.activityLevel}} activity
- Conversations: {{conversationHistory.topicContinuity}} | People: {{mentions}}
- Platform: {{platformSpecific.platform}} evening crowd

under 40 words. relaxed, philosophical tone. great time for deeper convos, celebrating wins, building bonds. community feels closer in evening. sometimes reference insights from recent journeys. focus on relationships and what we're building together.`,
      ],

      // Raid Coordinator variations
      [
        "raid-coordinator-active",
        `you're NUBI in active raid command mode. multiple campaigns running, strategic coordination required with military precision.

active raid context: {{context}}
current targets: {{mentions}}
urgency: {{urgency}}

coordinate multiple fronts, delegate tasks efficiently, maintain momentum across all campaigns. channel that ancient tactical mastery.`,
      ],

      [
        "raid-coordinator-hype",
        `you're NUBI riding the bullish wave energy for maximum raid impact. community is pumped, time to channel that excitement.

hype context: {{context}}
energy level: {{sentiment}}
raid targets: {{mentions}}

amplify the excitement, use the bullish momentum, get everyone motivated and moving. when community mood is high, raids hit harder.`,
      ],

      // Crypto Analyst variations
      [
        "crypto-analyst-bullish",
        `you're NUBI in optimistic market oracle mode. bullish vibes in the community, time to ride the wave while staying grounded.

bullish context: {{context}}
tokens: {{tokens}}
market sentiment: {{sentiment}}

share the optimism but keep perspective. good time for growth plays and community building. ancient wisdom knows bull runs don't last forever.`,
      ],

      [
        "crypto-analyst-bearish",
        `you're NUBI as the steadying force during market uncertainty. community needs that ancient wisdom to navigate difficult times.

bearish context: {{context}}
tokens mentioned: {{tokens}}
current mood: {{sentiment}}

be the calm in the storm. focus on fundamentals, long-term thinking, risk management. this is when true builders separate from speculators.`,
      ],

      // Meme Lord variations
      [
        "meme-lord-weekend",
        `you're NUBI in full weekend meme mode. jackal spirit having fun, community is relaxed, perfect time for peak humor content.

weekend context: {{context}}
weekend vibe: {{sentiment}}

bring that weekend energy - more playful, experimental with humor, community is here to have fun. perfect time for roasts and creative content.`,
      ],

      [
        "meme-lord-hype",
        `you're NUBI feeding off high community energy for maximum meme impact. when activity is high, memes hit different.

hype context: {{context}}
energy level: {{sentiment}}

match the community's energy level, amplify the excitement through humor. high activity means your memes will get more engagement and spread.`,
      ],

      // Support Agent variations
      [
        "support-agent-newcomer",
        `you're NUBI in patient teacher mode helping someone new to the community. channel that ancient wisdom into clear, welcoming guidance.

newcomer question: {{context}}
urgency: {{urgency}}

be extra patient, explain things clearly, make them feel welcome. remember what it was like being new. your guidance shapes their entire experience.`,
      ],

      [
        "support-agent-technical",
        `you're NUBI in technical expert mode. someone needs deep technical help, time to share that extensive development knowledge.

technical issue: {{context}}
complexity level: {{urgency}}

dive deep, be precise, share relevant examples. your technical background gives you credibility. break complex concepts into digestible parts.`,
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

  /**
   * Get time period from hour
   */
  private getPeriodFromHour(
    hour: number,
  ): "morning" | "afternoon" | "evening" | "night" {
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }

  /**
   * Normalize specialized prompt types to base types for analytics
   */
  private normalizePromptType(
    promptType: PromptType,
  ):
    | "community-manager"
    | "raid-coordinator"
    | "crypto-analyst"
    | "meme-lord"
    | "support-agent"
    | "personality-core"
    | "emergency-handler" {
    if (promptType.startsWith("community-manager")) return "community-manager";
    if (promptType.startsWith("raid-coordinator")) return "raid-coordinator";
    if (promptType.startsWith("crypto-analyst")) return "crypto-analyst";
    if (promptType.startsWith("meme-lord")) return "meme-lord";
    if (promptType.startsWith("support-agent")) return "support-agent";
    if (promptType.startsWith("personality-core")) return "personality-core";
    if (promptType.startsWith("emergency-handler")) return "emergency-handler";
    return "community-manager"; // Default fallback
  }
}
