/**
 * Twitter Monitor Service
 *
 * Read-only Twitter monitoring service using official Twitter API v2
 * Handles streaming, search, and user tracking without write operations
 */

import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { LRUCache } from "lru-cache";
import {
  TwitterMention,
  TwitterUser,
  TwitterStreamEvent,
  TwitterStreamRule,
  TwitterSearchResult,
  TwitterTimelineEntry,
  TwitterMonitorConfig,
  TwitterAnalytics,
  TwitterMonitorError,
  TwitterMonitorEvent,
  TwitterMonitorEventType,
  EngagementMetrics,
  TrendingTopic,
} from "./twitter-data-types";

export class TwitterMonitorService extends Service {
  static serviceType = "twitter_monitor" as const;
  capabilityDescription = "Read-only Twitter monitoring and analytics";

  protected runtime: IAgentRuntime;
  public config: TwitterMonitorConfig;
  private cache: LRUCache<string, any>;
  private rateLimiter: Map<string, number[]>;
  private streamConnection: any = null;
  private isStreaming: boolean = false;
  private eventListeners: Map<TwitterMonitorEventType, Function[]> = new Map();

  // Analytics and metrics
  private metrics = {
    totalMentions: 0,
    totalSearches: 0,
    apiCalls: 0,
    rateLimitHits: 0,
    streamReconnects: 0,
    lastStreamConnect: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;

    this.config = this.initializeConfig();

    // Initialize cache with 1-hour TTL
    this.cache = new LRUCache<string, any>({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
    });

    this.rateLimiter = new Map();

    // Initialize event listeners map
    this.initializeEventListeners();
  }

  /**
   * Initialize configuration from environment and defaults
   */
  private initializeConfig(): TwitterMonitorConfig {
    return {
      enabled: process.env.TWITTER_MONITOR_ENABLED === "true",
      // Use same auth variables as MCP configuration
      bearerToken: process.env.TWITTER_BEARER_TOKEN || "",
      authToken: process.env.TWITTER_AUTH_TOKEN || "",
      csrfToken: process.env.TWITTER_CSRF_TOKEN || "",
      ct0: process.env.TWITTER_CT0 || "",
      username: process.env.TWITTER_USERNAME || "",
      password: process.env.TWITTER_PASSWORD || "",
      email: process.env.TWITTER_EMAIL || "",
      streamRules: (
        process.env.TWITTER_STREAM_RULES ||
        "@UnderworldAgent,#AnubisChat,#Solana"
      ).split(","),
      monitoredUsers: (
        process.env.TWITTER_MONITORED_USERS || "UnderworldAgent"
      ).split(","),
      monitoredHashtags: (
        process.env.TWITTER_MONITORED_HASHTAGS || "#AnubisChat,#Solana,#DeFi"
      ).split(","),
      rateLimits: {
        tweetsPerWindow: 300, // Twitter API v2 limit
        usersPerWindow: 300,
        searchesPerWindow: 300,
        windowMinutes: 15,
      },
      filters: {
        minFollowerCount: parseInt(process.env.TWITTER_MIN_FOLLOWERS || "0"),
        excludeRetweets: process.env.TWITTER_EXCLUDE_RETWEETS === "true",
        excludeReplies: process.env.TWITTER_EXCLUDE_REPLIES === "true",
        languages: (process.env.TWITTER_LANGUAGES || "en").split(","),
      },
    };
  }

  /**
   * Initialize event listener categories
   */
  private initializeEventListeners(): void {
    const eventTypes: TwitterMonitorEventType[] = [
      "new_mention",
      "trending_topic",
      "engagement_milestone",
      "rate_limit_warning",
      "connection_error",
      "stream_reconnect",
    ];

    eventTypes.forEach((type) => {
      this.eventListeners.set(type, []);
    });
  }

  /**
   * Start monitoring Twitter streams and data
   */
  async startMonitoring(): Promise<void> {
    if (!this.config.enabled || !this.config.bearerToken) {
      logger.warn(
        "[TWITTER_MONITOR] Monitoring disabled or bearer token missing",
      );
      return;
    }

    try {
      // Setup stream rules
      await this.setupStreamRules();

      // Start filtered stream
      await this.startFilteredStream();

      // Start periodic data collection
      this.startPeriodicTasks();

      logger.info("[TWITTER_MONITOR] Monitoring started successfully");
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Failed to start monitoring:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring and cleanup resources
   */
  async stopMonitoring(): Promise<void> {
    this.isStreaming = false;

    if (this.streamConnection) {
      this.streamConnection.close();
      this.streamConnection = null;
    }

    this.cache.clear();
    this.rateLimiter.clear();

    logger.info("[TWITTER_MONITOR] Monitoring stopped");
  }

  /**
   * Setup Twitter stream rules for real-time monitoring
   */
  private async setupStreamRules(): Promise<void> {
    try {
      const rules = this.config.streamRules.map((rule, index) => ({
        value: rule.trim(),
        tag: `rule_${index}`,
      }));

      const response = await this.makeApiCall(
        "/2/tweets/search/stream/rules",
        "POST",
        {
          add: rules,
        },
      );

      if (response.meta?.summary?.created > 0) {
        logger.info(
          `[TWITTER_MONITOR] Created ${response.meta.summary.created} stream rules`,
        );
      }
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Failed to setup stream rules:", error);
      throw error;
    }
  }

  /**
   * Start Twitter filtered stream for real-time mentions
   */
  private async startFilteredStream(): Promise<void> {
    try {
      this.isStreaming = true;
      this.metrics.lastStreamConnect = Date.now();

      const streamUrl = "https://api.twitter.com/2/tweets/search/stream";
      const params = new URLSearchParams({
        "tweet.fields":
          "id,text,author_id,created_at,public_metrics,context_annotations,referenced_tweets",
        "user.fields":
          "id,username,name,verified,public_metrics,description,profile_image_url",
        expansions: "author_id,referenced_tweets.id",
      });

      const response = await fetch(`${streamUrl}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.config.bearerToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stream connection failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get stream reader");
      }

      // Process stream data
      this.processStreamData(reader);
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Stream connection failed:", error);

      // Emit connection error event
      this.emitEvent("connection_error", { error, timestamp: Date.now() });

      // Attempt reconnection after delay
      if (this.isStreaming) {
        setTimeout(() => this.reconnectStream(), 30000); // 30 second delay
      }
    }
  }

  /**
   * Process streaming data from Twitter
   */
  private async processStreamData(
    reader: ReadableStreamDefaultReader,
  ): Promise<void> {
    try {
      while (this.isStreaming) {
        const { done, value } = await reader.read();

        if (done) {
          logger.info("[TWITTER_MONITOR] Stream ended");
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            await this.handleStreamEvent(data);
          } catch (parseError) {
            // Ignore malformed JSON (keep-alive heartbeats, etc.)
            continue;
          }
        }
      }
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Stream processing error:", error);
      if (this.isStreaming) {
        setTimeout(() => this.reconnectStream(), 30000);
      }
    }
  }

  /**
   * Handle individual stream events
   */
  private async handleStreamEvent(data: any): Promise<void> {
    if (!data.data) return; // Skip non-tweet events

    try {
      // Parse tweet data
      const tweet = this.parseTweetData(data);
      const user = this.parseUserData(data.includes?.users?.[0]);

      if (tweet && user) {
        // Create stream event
        const streamEvent: TwitterStreamEvent = {
          eventType: "mention",
          tweet,
          user,
          timestamp: new Date(),
          matchingRules: data.matching_rules || [],
        };

        // Update metrics
        this.metrics.totalMentions++;

        // Cache the mention
        this.cache.set(`mention_${tweet.id}`, tweet);

        // Emit new mention event
        this.emitEvent("new_mention", streamEvent);

        logger.info(
          `[TWITTER_MONITOR] New mention from @${user.username}: ${tweet.text.slice(0, 100)}...`,
        );
      }
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Error processing stream event:", error);
    }
  }

  /**
   * Reconnect to Twitter stream after connection loss
   */
  private async reconnectStream(): Promise<void> {
    if (!this.isStreaming) return;

    this.metrics.streamReconnects++;

    // Emit reconnect event
    this.emitEvent("stream_reconnect", {
      attempt: this.metrics.streamReconnects,
      timestamp: Date.now(),
    });

    logger.info(
      `[TWITTER_MONITOR] Attempting stream reconnection (${this.metrics.streamReconnects})`,
    );

    try {
      await this.startFilteredStream();
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Stream reconnection failed:", error);
    }
  }

  /**
   * Search Twitter for specific queries
   */
  async searchTweets(
    query: string,
    options: {
      maxResults?: number;
      nextToken?: string;
      startTime?: Date;
      endTime?: Date;
    } = {},
  ): Promise<TwitterSearchResult> {
    if (!(await this.checkRateLimit("search"))) {
      throw new Error("Search rate limit exceeded");
    }

    try {
      const params = new URLSearchParams({
        query,
        max_results: (options.maxResults || 10).toString(),
        "tweet.fields":
          "id,text,author_id,created_at,public_metrics,context_annotations",
        "user.fields": "id,username,name,verified,public_metrics",
        expansions: "author_id",
      });

      if (options.nextToken) params.append("next_token", options.nextToken);
      if (options.startTime)
        params.append("start_time", options.startTime.toISOString());
      if (options.endTime)
        params.append("end_time", options.endTime.toISOString());

      const response = await this.makeApiCall(
        `/2/tweets/search/recent?${params.toString()}`,
      );

      const result: TwitterSearchResult = {
        tweets:
          response.data?.map((tweet: any) =>
            this.parseTweetData({ data: tweet, includes: response.includes }),
          ) || [],
        users:
          response.includes?.users?.map((user: any) =>
            this.parseUserData(user),
          ) || [],
        meta: {
          resultCount: response.meta?.result_count || 0,
          nextToken: response.meta?.next_token,
          newestId: response.meta?.newest_id,
          oldestId: response.meta?.oldest_id,
        },
        query,
        timestamp: new Date(),
      };

      this.metrics.totalSearches++;

      // Cache the search results
      this.cache.set(`search_${query}_${Date.now()}`, result);

      return result;
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Search failed:", error);
      throw error;
    }
  }

  /**
   * Get user information by username or ID
   */
  async getUser(usernameOrId: string): Promise<TwitterUser | null> {
    const cacheKey = `user_${usernameOrId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    if (!(await this.checkRateLimit("users"))) {
      throw new Error("User lookup rate limit exceeded");
    }

    try {
      const isId = /^\d+$/.test(usernameOrId);
      const endpoint = isId
        ? `/2/users/${usernameOrId}`
        : `/2/users/by/username/${usernameOrId}`;

      const params = new URLSearchParams({
        "user.fields":
          "id,username,name,description,verified,verified_type,public_metrics,created_at,location,url,profile_image_url",
      });

      const response = await this.makeApiCall(
        `${endpoint}?${params.toString()}`,
      );

      if (!response.data) return null;

      const user = this.parseUserData(response.data);

      // Cache the user data
      this.cache.set(cacheKey, user);
      this.metrics.cacheMisses++;

      return user;
    } catch (error) {
      logger.error("[TWITTER_MONITOR] User lookup failed:", error);
      return null;
    }
  }

  /**
   * Get trending topics for monitoring
   */
  async getTrendingTopics(location: string = "1"): Promise<TrendingTopic[]> {
    const cacheKey = `trends_${location}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    try {
      // Note: Trends endpoint requires different authentication
      // This is a placeholder - would need Twitter API v1.1 for trends
      const trends: TrendingTopic[] = [];

      this.cache.set(cacheKey, trends, { ttl: 1000 * 60 * 15 }); // 15 min cache
      return trends;
    } catch (error) {
      logger.error("[TWITTER_MONITOR] Failed to get trending topics:", error);
      return [];
    }
  }

  /**
   * Get engagement metrics for a specific tweet
   */
  async getTweetEngagementMetrics(
    tweetId: string,
  ): Promise<EngagementMetrics | null> {
    const cacheKey = `metrics_${tweetId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    try {
      const params = new URLSearchParams({
        ids: tweetId,
        "tweet.fields": "public_metrics",
      });

      const response = await this.makeApiCall(`/2/tweets?${params.toString()}`);

      if (!response.data?.[0]) return null;

      const tweet = response.data[0];
      const metrics: EngagementMetrics = {
        tweetId,
        timestamp: new Date(),
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          quotes: tweet.public_metrics?.quote_count || 0,
        },
      };

      // Cache metrics for 5 minutes (they change frequently)
      this.cache.set(cacheKey, metrics, { ttl: 1000 * 60 * 5 });
      this.metrics.cacheMisses++;

      return metrics;
    } catch (error) {
      logger.error(
        "[TWITTER_MONITOR] Failed to get engagement metrics:",
        error,
      );
      return null;
    }
  }

  /**
   * Start periodic monitoring tasks
   */
  private startPeriodicTasks(): void {
    // Check monitored users every 15 minutes
    setInterval(
      async () => {
        if (this.config.monitoredUsers.length > 0) {
          await this.checkMonitoredUsers();
        }
      },
      15 * 60 * 1000,
    );

    // Clean up old cache entries every hour
    setInterval(
      () => {
        // LRU cache handles this automatically, but we can trigger manual cleanup
        this.cache.clear();
      },
      60 * 60 * 1000,
    );

    // Reset rate limit counters every 15 minutes
    setInterval(
      () => {
        this.rateLimiter.clear();
      },
      15 * 60 * 1000,
    );
  }

  /**
   * Check monitored users for new tweets
   */
  private async checkMonitoredUsers(): Promise<void> {
    for (const username of this.config.monitoredUsers) {
      try {
        const searchQuery = `from:${username} -is:retweet`;
        const results = await this.searchTweets(searchQuery, { maxResults: 5 });

        // Process any new tweets from monitored users
        for (const tweet of results.tweets) {
          const cacheKey = `processed_${tweet.id}`;
          if (!this.cache.has(cacheKey)) {
            // This is a new tweet
            this.cache.set(cacheKey, true);

            // Emit event for new tweet from monitored user
            this.emitEvent("new_mention", {
              eventType: "mention",
              tweet,
              user: results.users.find((u) => u.id === tweet.authorId),
              timestamp: new Date(),
              matchingRules: [
                {
                  id: "monitored_user",
                  value: `from:${username}`,
                  tag: "monitored",
                },
              ],
            });
          }
        }
      } catch (error) {
        logger.error(
          `[TWITTER_MONITOR] Failed to check user ${username}:`,
          error,
        );
      }
    }
  }

  /**
   * Event listener management
   */
  addEventListener(
    eventType: TwitterMonitorEventType,
    callback: Function,
  ): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(callback);
    this.eventListeners.set(eventType, listeners);
  }

  removeEventListener(
    eventType: TwitterMonitorEventType,
    callback: Function,
  ): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(eventType, listeners);
    }
  }

  private emitEvent(eventType: TwitterMonitorEventType, data: any): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const event: TwitterMonitorEvent = {
      type: eventType,
      data,
      timestamp: new Date(),
      priority: this.getEventPriority(eventType),
    };

    listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        logger.error(
          `[TWITTER_MONITOR] Event listener error for ${eventType}:`,
          error,
        );
      }
    });
  }

  private getEventPriority(
    eventType: TwitterMonitorEventType,
  ): "low" | "medium" | "high" | "critical" {
    switch (eventType) {
      case "connection_error":
        return "critical";
      case "new_mention":
        return "high";
      case "engagement_milestone":
        return "medium";
      case "trending_topic":
        return "medium";
      case "rate_limit_warning":
        return "medium";
      case "stream_reconnect":
        return "low";
      default:
        return "low";
    }
  }

  /**
   * Get monitoring analytics and metrics
   */
  getAnalytics(): TwitterAnalytics {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      period: {
        start: hourAgo,
        end: now,
      },
      metrics: {
        totalMentions: this.metrics.totalMentions,
        totalEngagements: 0, // Would be calculated from stored data
        averageEngagementRate: 0, // Would be calculated from stored data
        topMentioners: [], // Would be calculated from stored data
        popularHashtags: [], // Would be calculated from stored data
        sentimentBreakdown: {
          positive: 0,
          negative: 0,
          neutral: this.metrics.totalMentions,
        },
      },
    };
  }

  /**
   * Get current service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      isStreaming: this.isStreaming,
      configuredRules: this.config.streamRules.length,
      monitoredUsers: this.config.monitoredUsers.length,
      uptime: Date.now() - this.metrics.lastStreamConnect,
    };
  }

  // Private utility methods

  private async makeApiCall(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: any,
  ): Promise<any> {
    this.metrics.apiCalls++;

    const url = `https://api.twitter.com${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.config.bearerToken}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 429) {
        this.metrics.rateLimitHits++;
        this.emitEvent("rate_limit_warning", {
          endpoint,
          resetTime: response.headers.get("x-rate-limit-reset"),
        });
      }
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  private async checkRateLimit(operation: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = this.config.rateLimits.windowMinutes * 60 * 1000;

    const key = `${operation}_rate_limit`;
    const requests = this.rateLimiter.get(key) || [];

    // Clean old requests
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    const limit = this.config.rateLimits.tweetsPerWindow; // Use same limit for all operations

    if (validRequests.length >= limit) {
      this.metrics.rateLimitHits++;
      return false;
    }

    validRequests.push(now);
    this.rateLimiter.set(key, validRequests);
    return true;
  }

  private parseTweetData(data: any): TwitterMention | null {
    if (!data.data) return null;

    const tweet = data.data;
    const user = data.includes?.users?.find(
      (u: any) => u.id === tweet.author_id,
    );

    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      authorUsername: user?.username || "unknown",
      authorName: user?.name || "Unknown User",
      createdAt: new Date(tweet.created_at),
      publicMetrics: {
        retweetCount: tweet.public_metrics?.retweet_count || 0,
        likeCount: tweet.public_metrics?.like_count || 0,
        replyCount: tweet.public_metrics?.reply_count || 0,
        quoteCount: tweet.public_metrics?.quote_count || 0,
      },
      conversationId: tweet.conversation_id || tweet.id,
      contextAnnotations: tweet.context_annotations,
      referencedTweets: tweet.referenced_tweets,
      inReplyToTweetId: tweet.in_reply_to_user_id,
    };
  }

  private parseUserData(userData: any): TwitterUser | null {
    if (!userData) return null;

    return {
      id: userData.id,
      username: userData.username,
      name: userData.name,
      description: userData.description,
      profileImageUrl: userData.profile_image_url,
      verified: userData.verified || false,
      verifiedType: userData.verified_type,
      publicMetrics: {
        followersCount: userData.public_metrics?.followers_count || 0,
        followingCount: userData.public_metrics?.following_count || 0,
        tweetCount: userData.public_metrics?.tweet_count || 0,
        listedCount: userData.public_metrics?.listed_count || 0,
        likeCount: userData.public_metrics?.like_count || 0,
      },
      createdAt: new Date(userData.created_at),
      location: userData.location,
      website: userData.url,
    };
  }
}
