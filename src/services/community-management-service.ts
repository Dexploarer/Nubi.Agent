import {
  Service,
  IAgentRuntime,
  Memory,
  logger,
  ServiceType,
} from "@elizaos/core";

/**
 * Community Management Service
 *
 * Background service for community engagement tracking and analytics.
 * Implements proper ElizaOS Service pattern.
 *
 * Tracks conversation patterns, user relationships, and community health.
 */

interface CommunityMetrics {
  activeUsers: Set<string>;
  dailyMessages: number;
  engagementScore: number;
  topTopics: Map<string, number>;
  averageResponseTime: number;
  communityMood: string;
  lastUpdated: number;
}

interface UserEngagement {
  userId: string;
  messageCount: number;
  lastSeen: number;
  topics: string[];
  sentiment: number;
  relationshipLevel: "new" | "regular" | "community_member" | "valued_member";
}

export class CommunityManagementService extends Service {
  static serviceType = "community_management" as const;
  capabilityDescription =
    "Community engagement tracking and relationship management";

  private analyticsInterval: NodeJS.Timeout | null = null;
  protected runtime: IAgentRuntime;
  private communityMetrics: CommunityMetrics;
  private userEngagements: Map<string, UserEngagement> = new Map();

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.communityMetrics = this.getDefaultMetrics();
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<CommunityManagementService> {
    const service = new CommunityManagementService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    logger.info("[COMMUNITY_MANAGEMENT_SERVICE] Starting community analytics");

    // Run analytics every hour
    this.analyticsInterval = setInterval(
      async () => {
        await this.updateCommunityMetrics();
      },
      60 * 60 * 1000,
    ); // Every hour

    // Initialize metrics
    await this.updateCommunityMetrics();
  }

  /**
   * Track user interaction (called by evaluators/providers)
   */
  async trackUserInteraction(
    message: Memory,
    sentiment?: number,
  ): Promise<void> {
    try {
      const userId = message.entityId;
      const messageText = message.content.text || "";

      // Update user engagement
      const existing =
        this.userEngagements.get(userId) ||
        this.createNewUserEngagement(userId);
      existing.messageCount++;
      existing.lastSeen = Date.now();
      existing.sentiment = sentiment || existing.sentiment;

      // Extract topics
      const topics = this.extractTopics(messageText);
      existing.topics = [...new Set([...existing.topics, ...topics])].slice(
        -20,
      ); // Keep last 20 topics

      // Update relationship level
      existing.relationshipLevel = this.calculateRelationshipLevel(existing);

      this.userEngagements.set(userId, existing);

      // Update daily metrics
      this.communityMetrics.dailyMessages++;
      this.communityMetrics.activeUsers.add(userId);

      // Update topic tracking
      topics.forEach((topic) => {
        const current = this.communityMetrics.topTopics.get(topic) || 0;
        this.communityMetrics.topTopics.set(topic, current + 1);
      });
    } catch (error) {
      logger.warn(
        "[COMMUNITY_MANAGEMENT_SERVICE] Failed to track user interaction:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Update community metrics
   */
  private async updateCommunityMetrics(): Promise<void> {
    try {
      // Calculate engagement score
      const totalUsers = this.userEngagements.size;
      const activeUsers = this.communityMetrics.activeUsers.size;
      const dailyMessages = this.communityMetrics.dailyMessages;

      this.communityMetrics.engagementScore =
        totalUsers > 0
          ? Math.round(
              (activeUsers / totalUsers) * 100 +
                (dailyMessages / totalUsers) * 10,
            )
          : 0;

      // Calculate community mood
      this.communityMetrics.communityMood = this.calculateCommunityMood();

      // Reset daily counters
      this.communityMetrics.activeUsers.clear();
      this.communityMetrics.dailyMessages = 0;
      this.communityMetrics.lastUpdated = Date.now();

      logger.debug(
        `[COMMUNITY_MANAGEMENT_SERVICE] Updated metrics: ${this.communityMetrics.engagementScore}% engagement, mood: ${this.communityMetrics.communityMood}`,
      );
    } catch (error) {
      logger.warn(
        "[COMMUNITY_MANAGEMENT_SERVICE] Failed to update community metrics:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Extract topics from message text
   */
  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    // Crypto topics
    if (lowerText.match(/solana|sol\b|phantom|jupiter/)) topics.push("solana");
    if (lowerText.match(/defi|yield|farming|staking/)) topics.push("defi");
    if (lowerText.match(/nft|opensea|magic eden/)) topics.push("nft");
    if (lowerText.match(/trading|price|market|pump|dump/))
      topics.push("trading");

    // Platform topics
    if (lowerText.match(/anubis\.chat|anubis chat/)) topics.push("anubis_chat");
    if (lowerText.match(/ai|model|gpt|claude/)) topics.push("ai_models");

    // Community topics
    if (lowerText.match(/community|together|help|support/))
      topics.push("community");
    if (lowerText.match(/raid|coordination|team/)) topics.push("coordination");

    return topics;
  }

  /**
   * Calculate relationship level based on engagement
   */
  private calculateRelationshipLevel(
    engagement: UserEngagement,
  ): UserEngagement["relationshipLevel"] {
    const { messageCount, lastSeen } = engagement;
    const daysSinceLastSeen = (Date.now() - lastSeen) / (24 * 60 * 60 * 1000);

    if (messageCount >= 50 && daysSinceLastSeen <= 7) return "valued_member";
    if (messageCount >= 20 && daysSinceLastSeen <= 14)
      return "community_member";
    if (messageCount >= 5 && daysSinceLastSeen <= 30) return "regular";
    return "new";
  }

  /**
   * Calculate overall community mood
   */
  private calculateCommunityMood(): string {
    const sentiments = Array.from(this.userEngagements.values()).map(
      (u) => u.sentiment,
    );
    if (sentiments.length === 0) return "neutral";

    const avgSentiment =
      sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;

    if (avgSentiment > 0.3) return "positive";
    if (avgSentiment < -0.3) return "negative";
    return "neutral";
  }

  /**
   * Create new user engagement record
   */
  private createNewUserEngagement(userId: string): UserEngagement {
    return {
      userId,
      messageCount: 0,
      lastSeen: Date.now(),
      topics: [],
      sentiment: 0,
      relationshipLevel: "new",
    };
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics(): CommunityMetrics {
    return {
      activeUsers: new Set(),
      dailyMessages: 0,
      engagementScore: 0,
      topTopics: new Map(),
      averageResponseTime: 0,
      communityMood: "neutral",
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get community insights for external access
   */
  async getCommunityInsights(): Promise<{
    totalUsers: number;
    engagementScore: number;
    communityMood: string;
    topTopics: Array<{ topic: string; count: number }>;
    valuedMembers: number;
  }> {
    const valuedMembers = Array.from(this.userEngagements.values()).filter(
      (u) => u.relationshipLevel === "valued_member",
    ).length;

    const topTopics = Array.from(this.communityMetrics.topTopics.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    return {
      totalUsers: this.userEngagements.size,
      engagementScore: this.communityMetrics.engagementScore,
      communityMood: this.communityMetrics.communityMood,
      topTopics,
      valuedMembers,
    };
  }

  /**
   * Get user relationship info
   */
  async getUserRelationship(userId: string): Promise<UserEngagement | null> {
    return this.userEngagements.get(userId) || null;
  }

  async stop(): Promise<void> {
    logger.info(
      "[COMMUNITY_MANAGEMENT_SERVICE] Stopping community management service",
    );

    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
  }
}

// Extend ServiceTypeRegistry for proper typing
declare module "@elizaos/core" {
  interface ServiceTypeRegistry {
    community_management: "community_management";
  }
}

export default CommunityManagementService;
