import { IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";

export interface EngagementData {
  tweetId: string;
  userId: string;
  username: string;
  engagementType: "like" | "retweet" | "reply" | "quote_tweet";
  timestamp: Date;
  verified: boolean;
  points: number;
  multiplier: number;
}

export interface TweetStats {
  tweetId: string;
  url: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  lastUpdated: Date;
}

export interface UserEngagementHistory {
  userId: string;
  username: string;
  totalEngagements: number;
  totalPoints: number;
  recentEngagements: EngagementData[];
  rateLimitStatus: {
    likesRemaining: number;
    retweetsRemaining: number;
    repliesRemaining: number;
    resetTime: Date;
  };
}

export class EngagementVerifier {
  private runtime: IAgentRuntime;
  private userHistory: Map<string, UserEngagementHistory> = new Map();
  private tweetCache: Map<string, TweetStats> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private rateLimits = {
    likes: { limit: 5, window: 15 * 60 * 1000 }, // 5 likes per 15 minutes
    retweets: { limit: 5, window: 15 * 60 * 1000 }, // 5 retweets per 15 minutes
    replies: { limit: 3, window: 15 * 60 * 1000 }, // 3 replies per 15 minutes
  };

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    try {
      // Load user history from database
      await this.loadUserHistoryFromDatabase();

      // Set up periodic cache cleanup with proper interval tracking
      this.cleanupIntervalId = setInterval(() => this.cleanupCache(), 60 * 60 * 1000); // Every hour

      logger.info("Engagement Verifier initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize Engagement Verifier:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async verifyEngagement(
    tweetId: string,
    userId: string,
    username: string,
    engagementType: EngagementData["engagementType"],
  ): Promise<{
    verified: boolean;
    points: number;
    reason?: string;
    engagements?: number;
  }> {
    try {
      // Check rate limits first
      const rateLimitCheck = await this.checkRateLimit(userId, engagementType);
      if (!rateLimitCheck.allowed) {
        return {
          verified: false,
          points: 0,
          reason: `Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.timeUntilReset / 60000)} minutes`,
        };
      }

      // Execute verification and points calculation in parallel
      const [isVerified, points] = await Promise.all([
        this.performEngagementVerification(tweetId, userId, engagementType),
        this.calculatePoints(tweetId, userId, engagementType),
      ]);

      if (!isVerified) {
        return {
          verified: false,
          points: 0,
          reason:
            "Engagement not found on X. Please ensure you completed the action.",
        };
      }

      // Record the engagement
      await this.recordEngagement({
        tweetId,
        userId,
        username,
        engagementType,
        timestamp: new Date(),
        verified: true,
        points: points.total,
        multiplier: points.multiplier,
      });

      // Update rate limits
      await this.updateRateLimit(userId, engagementType);

      return {
        verified: true,
        points: points.total,
        engagements: 1,
      };
    } catch (error) {
      logger.error(
        "Failed to verify engagement:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        verified: false,
        points: 0,
        engagements: 0,
        reason: "Verification service temporarily unavailable",
      };
    }
  }

  private async performEngagementVerification(
    tweetId: string,
    userId: string,
    engagementType: string,
  ): Promise<boolean> {
    // This is where you would integrate with X/Twitter API
    // For now, we'll simulate verification with 85% success rate

    // Simulate API call delay
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000),
    );

    // Simulate verification logic
    const random = Math.random();

    // Higher success rate for likes, lower for complex engagements
    const successRates = {
      like: 0.9,
      retweet: 0.85,
      reply: 0.8,
      quote_tweet: 0.75,
    };

    const successRate =
      successRates[engagementType as keyof typeof successRates] || 0.8;

    // Simulate some users having issues (banned, private accounts, etc.)
    const userReliability = this.getUserReliability(userId);

    return random < successRate * userReliability;
  }

  private getUserReliability(userId: string): number {
    // Simulate user reliability based on history
    const history = this.userHistory.get(userId);
    if (!history) return 0.95; // New users get benefit of doubt

    // Users with good history get higher reliability
    if (history.totalEngagements > 50) return 0.98;
    if (history.totalEngagements > 20) return 0.95;
    if (history.totalEngagements > 5) return 0.9;

    return 0.85; // Lower for very new users
  }

  private async calculatePoints(
    tweetId: string,
    userId: string,
    engagementType: EngagementData["engagementType"],
  ): Promise<{ base: number; multiplier: number; total: number }> {
    // Base points for engagement types
    const basePoints = {
      like: 1,
      retweet: 2,
      reply: 3,
      quote_tweet: 5,
    };

    const base = basePoints[engagementType];
    let multiplier = 1.0;

    // Speed bonus - check if user is in first N participants
    const participantPosition = await this.getParticipantPosition(
      tweetId,
      userId,
    );

    if (participantPosition <= 5) {
      multiplier = 3.0; // First 5 get 3x
    } else if (participantPosition <= 10) {
      multiplier = 2.0; // First 10 get 2x
    } else if (participantPosition <= 25) {
      multiplier = 1.5; // First 25 get 1.5x
    }

    // Additional multipliers for active users
    const userHistory = this.userHistory.get(userId);
    if (userHistory) {
      if (userHistory.totalEngagements > 100) {
        multiplier *= 1.2; // Active raider bonus
      }
    }

    return {
      base,
      multiplier,
      total: Math.round(base * multiplier),
    };
  }

  private async getParticipantPosition(
    tweetId: string,
    userId: string,
  ): Promise<number> {
    // Get all participants for this tweet ordered by timestamp
    const allEngagements = Array.from(this.userHistory.values())
      .flatMap((user) => user.recentEngagements)
      .filter((engagement) => engagement.tweetId === tweetId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Find user's position (1-indexed)
    const position = allEngagements.findIndex(
      (engagement) => engagement.userId === userId,
    );
    return position >= 0 ? position + 1 : allEngagements.length + 1;
  }

  private async checkRateLimit(
    userId: string,
    engagementType: EngagementData["engagementType"],
  ): Promise<{ allowed: boolean; timeUntilReset: number }> {
    const user = this.userHistory.get(userId);
    if (!user) return { allowed: true, timeUntilReset: 0 };

    const now = new Date();
    const { rateLimitStatus } = user;

    // Check if reset time has passed
    if (now >= rateLimitStatus.resetTime) {
      // Reset limits
      rateLimitStatus.likesRemaining = this.rateLimits.likes.limit;
      rateLimitStatus.retweetsRemaining = this.rateLimits.retweets.limit;
      rateLimitStatus.repliesRemaining = this.rateLimits.replies.limit;
      rateLimitStatus.resetTime = new Date(
        now.getTime() + this.rateLimits.likes.window,
      );
    }

    // Check specific limits
    let remaining = 0;
    switch (engagementType) {
      case "like":
        remaining = rateLimitStatus.likesRemaining;
        break;
      case "retweet":
        remaining = rateLimitStatus.retweetsRemaining;
        break;
      case "reply":
      case "quote_tweet":
        remaining = rateLimitStatus.repliesRemaining;
        break;
    }

    return {
      allowed: remaining > 0,
      timeUntilReset: Math.max(
        0,
        rateLimitStatus.resetTime.getTime() - now.getTime(),
      ),
    };
  }

  private async updateRateLimit(
    userId: string,
    engagementType: EngagementData["engagementType"],
  ): Promise<void> {
    let user = this.userHistory.get(userId);
    if (!user) {
      user = this.createNewUserHistory(userId, "Unknown");
      this.userHistory.set(userId, user);
    }

    // Decrement appropriate counter
    switch (engagementType) {
      case "like":
        user.rateLimitStatus.likesRemaining = Math.max(
          0,
          user.rateLimitStatus.likesRemaining - 1,
        );
        break;
      case "retweet":
        user.rateLimitStatus.retweetsRemaining = Math.max(
          0,
          user.rateLimitStatus.retweetsRemaining - 1,
        );
        break;
      case "reply":
      case "quote_tweet":
        user.rateLimitStatus.repliesRemaining = Math.max(
          0,
          user.rateLimitStatus.repliesRemaining - 1,
        );
        break;
    }
  }

  private createNewUserHistory(
    userId: string,
    username: string,
  ): UserEngagementHistory {
    const now = new Date();
    return {
      userId,
      username,
      totalEngagements: 0,
      totalPoints: 0,
      recentEngagements: [],
      rateLimitStatus: {
        likesRemaining: this.rateLimits.likes.limit,
        retweetsRemaining: this.rateLimits.retweets.limit,
        repliesRemaining: this.rateLimits.replies.limit,
        resetTime: new Date(now.getTime() + this.rateLimits.likes.window),
      },
    };
  }

  private async recordEngagement(engagement: EngagementData): Promise<void> {
    let user = this.userHistory.get(engagement.userId);
    if (!user) {
      user = this.createNewUserHistory(engagement.userId, engagement.username);
      this.userHistory.set(engagement.userId, user);
    }

    // Add to recent engagements (keep last 100)
    user.recentEngagements.push(engagement);
    if (user.recentEngagements.length > 100) {
      user.recentEngagements = user.recentEngagements.slice(-100);
    }

    // Update totals
    user.totalEngagements++;
    user.totalPoints += engagement.points;

    // Save to database
    await this.saveUserHistoryToDatabase(user);
  }

  async getTweetStats(tweetId: string): Promise<TweetStats | undefined> {
    // Check cache first
    let stats = this.tweetCache.get(tweetId);

    if (!stats || Date.now() - stats.lastUpdated.getTime() > 60000) {
      // 1 minute cache
      // Fetch fresh stats (in real implementation, this would be from X API)
      stats = await this.fetchTweetStatsFromAPI(tweetId);
      if (stats) {
        this.tweetCache.set(tweetId, stats);
      }
    }

    return stats;
  }

  private async fetchTweetStatsFromAPI(
    tweetId: string,
  ): Promise<TweetStats | undefined> {
    // This would integrate with X/Twitter API
    // For now, simulate some stats
    return {
      tweetId,
      url: `https://x.com/user/status/${tweetId}`,
      likes: Math.floor(Math.random() * 100),
      retweets: Math.floor(Math.random() * 50),
      replies: Math.floor(Math.random() * 30),
      quotes: Math.floor(Math.random() * 20),
      lastUpdated: new Date(),
    };
  }

  async getUserEngagementSummary(
    userId: string,
  ): Promise<UserEngagementHistory | null> {
    return this.userHistory.get(userId) || null;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean tweet cache
    for (const [tweetId, stats] of this.tweetCache) {
      if (now - stats.lastUpdated.getTime() > maxAge) {
        this.tweetCache.delete(tweetId);
      }
    }

    // Clean old engagements from user history
    for (const user of this.userHistory.values()) {
      user.recentEngagements = user.recentEngagements.filter(
        (engagement) =>
          now - engagement.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000, // 7 days
      );
    }

    logger.info("Engagement cache cleanup completed");
  }

  // Database methods (placeholder implementations)
  private async loadUserHistoryFromDatabase(): Promise<void> {
    // Implementation depends on your database setup
    logger.info("Loading user engagement history from database");
  }

  private async saveUserHistoryToDatabase(
    user: UserEngagementHistory,
  ): Promise<void> {
    // Implementation depends on your database setup
    logger.debug(`Saving engagement history for user ${user.userId}`);
  }

  async cleanup(): Promise<void> {
    // Clear the cleanup interval to prevent memory leaks
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Save all user histories
    for (const user of this.userHistory.values()) {
      try {
        await this.saveUserHistoryToDatabase(user);
      } catch (error) {
        logger.error(
          `Failed to save user history for ${user.userId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Clear caches
    this.userHistory.clear();
    this.tweetCache.clear();

    logger.info("Engagement Verifier cleaned up");
  }

  // Destructor method to ensure cleanup is called
  destroy(): void {
    this.cleanup().catch((error) => {
      logger.error(
        "Error during Engagement Verifier destruction:",
        error instanceof Error ? error.message : String(error),
      );
    });
  }
}
