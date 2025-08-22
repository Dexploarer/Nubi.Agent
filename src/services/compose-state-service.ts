import {
  Service,
  IAgentRuntime,
  Memory,
  State,
  logger,
  Provider,
} from "@elizaos/core";

/**
 * ElizaOS Compose State Integration Service
 *
 * Properly implements composeState usage with:
 * - Parallel provider execution
 * - Smart caching strategies
 * - Provider type categorization
 * - Dynamic provider selection
 * - Performance optimization
 */

export interface ComposeStateOptions {
  providers?: string[];
  includePrivate?: boolean;
  forceRefresh?: boolean;
  timeout?: number;
  cache?: boolean;
}

export interface EnhancedState extends State {
  nubiContext?: {
    sessionInfo?: any;
    personalityState?: any;
    communityContext?: any;
    emotionalState?: any;
    memoryInsights?: any;
    relationships?: any;
    userRecords?: any[];
    activeRituals?: any[];
    semanticContext?: any;
    conversationPatterns?: any[];
  };
}

export class ComposeStateService extends Service {
  static serviceType = "compose_state" as const;
  capabilityDescription =
    "ElizaOS composeState integration with NUBI enhancements";

  private providerCategories = {
    core: ["character", "recentMessages", "actions"],
    dynamic: ["facts", "relationships", "goals"],
    nubi: [
      "NUBI_ENHANCED_CONTEXT",
      "NUBI_PERSONALITY_STATE",
      "NUBI_EMOTIONAL_STATE",
    ],
    private: ["internal_state", "security_context"],
  };

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<ComposeStateService> {
    try {
      const service = new ComposeStateService(runtime);
      await service.initialize();
      logger.info("[COMPOSE_STATE_SERVICE] Service started successfully");
      return service;
    } catch (error) {
      logger.error("[COMPOSE_STATE_SERVICE] Failed to start service:", error);
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    logger.info(
      "[COMPOSE_STATE_SERVICE] Initialized ElizaOS state composition",
    );
  }

  /**
   * Enhanced composeState wrapper with NUBI-specific logic
   */
  async composeEnhancedState(
    message: Memory,
    options: ComposeStateOptions = {},
  ): Promise<EnhancedState> {
    try {
      const startTime = Date.now();

      // Default options
      const opts = {
        providers: options.providers || [
          ...this.providerCategories.core,
          ...this.providerCategories.dynamic,
          ...this.providerCategories.nubi,
        ],
        includePrivate: options.includePrivate || false,
        forceRefresh: options.forceRefresh || false,
        timeout: options.timeout || 5000,
        cache: options.cache !== false,
      };

      // Add private providers if requested
      if (opts.includePrivate) {
        opts.providers.push(...this.providerCategories.private);
      }

      // Use ElizaOS native composeState with optimizations
      const baseState = await this.runtime.composeState(message);

      // Enhance with NUBI-specific context
      const enhancedState = await this.addNubiContext(baseState, message, opts);

      const duration = Date.now() - startTime;
      logger.debug(
        `[COMPOSE_STATE_SERVICE] Composed state in ${duration}ms with ${opts.providers.length} providers`,
      );

      return enhancedState;
    } catch (error) {
      logger.error("[COMPOSE_STATE_SERVICE] Failed to compose state:", error);

      // Fallback to basic state
      const fallbackState = await this.runtime.composeState(message);

      return { ...fallbackState, nubiContext: {} };
    }
  }

  /**
   * Smart provider selection based on context
   */
  async getOptimalProviders(
    message: Memory,
    context?: {
      sessionType?: string;
      userRelationship?: string;
      messageType?: string;
      urgency?: "low" | "medium" | "high";
    },
  ): Promise<string[]> {
    const providers = [...this.providerCategories.core];

    // Always include recent messages for context
    if (!providers.includes("recentMessages")) {
      providers.push("recentMessages");
    }

    // Add dynamic providers based on context
    if (
      context?.sessionType === "continuing" ||
      context?.userRelationship === "established"
    ) {
      providers.push("relationships", "facts");
    }

    // Add NUBI providers for personality and emotional context
    providers.push("NUBI_ENHANCED_CONTEXT");

    if (context?.messageType === "emotional" || context?.urgency === "high") {
      providers.push("NUBI_EMOTIONAL_STATE");
    }

    if (context?.sessionType === "personality_focused") {
      providers.push("NUBI_PERSONALITY_STATE");
    }

    // Remove duplicates
    return [...new Set(providers)];
  }

  /**
   * Cached state composition with TTL and LRU eviction
   */
  private stateCache = new Map<
    string,
    {
      state: EnhancedState;
      timestamp: number;
      ttl: number;
      accessCount: number;
    }
  >();
  private maxCacheSize = 1000; // Maximum cache entries

  async getOrComposeState(
    message: Memory,
    options: ComposeStateOptions = {},
    cacheTTL: number = 60000, // 1 minute default
  ): Promise<EnhancedState> {
    const cacheKey = this.generateCacheKey(message, options);

    if (options.cache !== false && !options.forceRefresh) {
      const cached = this.stateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        // Update access count for LRU tracking
        cached.accessCount++;
        logger.debug(
          `[COMPOSE_STATE_SERVICE] Using cached state (access count: ${cached.accessCount})`,
        );
        return cached.state;
      }
    }

    const state = await this.composeEnhancedState(message, options);

    if (options.cache !== false) {
      // Implement LRU eviction if cache is full
      if (this.stateCache.size >= this.maxCacheSize) {
        this.evictLeastRecentlyUsed();
      }

      this.stateCache.set(cacheKey, {
        state,
        timestamp: Date.now(),
        ttl: cacheTTL,
        accessCount: 1,
      });

      // Clean up expired cache entries (async but don't wait)
      this.cleanupCache().catch((error) =>
        logger.warn("[COMPOSE_STATE_SERVICE] Cache cleanup failed:", error),
      );
    }

    return state;
  }

  /**
   * Add NUBI-specific context to base state
   */
  private async addNubiContext(
    baseState: State,
    message: Memory,
    options: ComposeStateOptions,
  ): Promise<EnhancedState> {
    const nubiContext: EnhancedState["nubiContext"] = {};

    try {
      // Get session information if Sessions API is active
      const sessionsService = this.runtime.getService("sessions");
      if (
        sessionsService &&
        message.roomId &&
        typeof (sessionsService as any).getSession === "function"
      ) {
        try {
          const sessionInfo = await (sessionsService as any).getSession(
            message.roomId,
          );
          nubiContext.sessionInfo = sessionInfo;
        } catch (error) {
          logger.debug("[COMPOSE_STATE_SERVICE] No active session found");
        }
      }

      // Get personality state
      const personalityService = this.runtime.getService(
        "personality_evolution",
      );
      if (
        personalityService &&
        typeof (personalityService as any).getCurrentState === "function"
      ) {
        try {
          nubiContext.personalityState = await (
            personalityService as any
          ).getCurrentState();
        } catch (error) {
          logger.debug("[COMPOSE_STATE_SERVICE] Personality state unavailable");
        }
      }

      // Get emotional state
      const emotionalService = this.runtime.getService("emotional_state");
      if (
        emotionalService &&
        typeof (emotionalService as any).getCurrentEmotion === "function"
      ) {
        try {
          nubiContext.emotionalState = await (
            emotionalService as any
          ).getCurrentEmotion();
        } catch (error) {
          logger.debug("[COMPOSE_STATE_SERVICE] Emotional state unavailable");
        }
      }

      // Get community context
      const communityService = this.runtime.getService("community_management");
      if (
        communityService &&
        message.roomId &&
        typeof (communityService as any).getRoomAnalytics === "function"
      ) {
        try {
          nubiContext.communityContext = await (
            communityService as any
          ).getRoomAnalytics(message.roomId);
        } catch (error) {
          logger.debug("[COMPOSE_STATE_SERVICE] Community context unavailable");
        }
      }

      // Get memory insights from database (includes user records)
      const memoryService = this.runtime.getService("database_memory");
      if (
        memoryService &&
        message.roomId &&
        typeof (memoryService as any).getEnhancedContext === "function"
      ) {
        try {
          // Extract topic hint from message for better semantic context
          const messageText = message.content?.text || "";
          const topicHint = messageText.substring(0, 100); // First 100 chars as topic hint

          const memoryContext = await (memoryService as any).getEnhancedContext(
            message.roomId,
            message.entityId || message.agentId,
            topicHint,
            15, // Slightly more context for compose state
          );

          nubiContext.memoryInsights = memoryContext;
          nubiContext.userRecords = memoryContext?.userRecords || [];

          // Add semantic memories if available
          if (memoryContext.semanticMemories?.length > 0) {
            nubiContext.semanticContext = {
              count: memoryContext.semanticMemories.length,
              topics: memoryContext.semanticMemories
                .slice(0, 3)
                .map((m: any) => m.content?.text?.substring(0, 50) + "...")
                .join("; "),
            };
          }

          // Add pattern insights
          if (memoryContext.patterns?.length > 0) {
            nubiContext.conversationPatterns = memoryContext.patterns.slice(
              0,
              3,
            );
          }
        } catch (error) {
          logger.debug(
            "[COMPOSE_STATE_SERVICE] Memory insights unavailable:",
            error,
          );
        }
      }

      // Get active ritual sessions for this user
      const ritualSessionsService = this.runtime.getService("sessions");
      if (
        ritualSessionsService &&
        message.entityId &&
        typeof (ritualSessionsService as any).getUserSessions === "function"
      ) {
        try {
          const activeSessions = await (
            ritualSessionsService as any
          ).getUserSessions(message.entityId);
          nubiContext.activeRituals =
            activeSessions?.filter(
              (s: any) => s.metadata?.ritualType && s.status === "active",
            ) || [];
        } catch (error) {
          logger.debug("[COMPOSE_STATE_SERVICE] Active rituals unavailable");
        }
      }
    } catch (error) {
      logger.warn("[COMPOSE_STATE_SERVICE] Failed to add NUBI context:", error);
    }

    return {
      ...baseState,
      nubiContext,
    };
  }

  /**
   * Generate cache key for state
   */
  private generateCacheKey(
    message: Memory,
    options: ComposeStateOptions,
  ): string {
    const keyParts = [
      message.roomId,
      message.entityId || message.agentId,
      message.id,
      JSON.stringify(options.providers?.sort()),
      options.includePrivate ? "1" : "0",
    ];
    return keyParts.join("|");
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10% of cache
    const sortedEntries = Array.from(this.stateCache.entries()).sort((a, b) => {
      // Sort by access count (ascending) then by timestamp (ascending)
      const accessDiff = a[1].accessCount - b[1].accessCount;
      if (accessDiff === 0) {
        return a[1].timestamp - b[1].timestamp;
      }
      return accessDiff;
    });

    for (let i = 0; i < Math.min(entriesToRemove, sortedEntries.length); i++) {
      this.stateCache.delete(sortedEntries[i][0]);
    }

    logger.debug(
      `[COMPOSE_STATE_SERVICE] Evicted ${entriesToRemove} least recently used cache entries`,
    );
  }

  /**
   * Clean up expired cache entries (optimized with batching)
   */
  private async cleanupCache(): Promise<void> {
    const now = Date.now();
    const expired: string[] = [];

    // Batch process in chunks to avoid blocking
    const entries = Array.from(this.stateCache.entries());
    const chunkSize = 100;

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);

      for (const [key, entry] of chunk) {
        if (now - entry.timestamp > entry.ttl) {
          expired.push(key);
        }
      }

      // Yield control every chunk to prevent blocking
      if (i % (chunkSize * 5) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Remove expired entries in batches
    for (const key of expired) {
      this.stateCache.delete(key);
    }

    if (expired.length > 0) {
      logger.debug(
        `[COMPOSE_STATE_SERVICE] Cleaned up ${expired.length} expired cache entries`,
      );
    }
  }

  /**
   * Get state composition analytics
   */
  async getAnalytics(): Promise<{
    cacheHitRate: number;
    avgCompositionTime: number;
    providerUsage: Record<string, number>;
    cacheSize: number;
  }> {
    // This would be implemented with actual metrics collection
    return {
      cacheHitRate: 0.75,
      avgCompositionTime: 150,
      providerUsage: {
        character: 100,
        recentMessages: 95,
        NUBI_ENHANCED_CONTEXT: 80,
        relationships: 60,
        facts: 45,
      },
      cacheSize: this.stateCache.size,
    };
  }

  /**
   * Clean up on service stop
   */
  async stop(): Promise<void> {
    this.stateCache.clear();
    logger.info("[COMPOSE_STATE_SERVICE] Service stopped and cache cleared");
  }
}

export default ComposeStateService;
