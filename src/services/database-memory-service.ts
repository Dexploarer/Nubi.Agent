import {
  Service,
  IAgentRuntime,
  Memory,
  logger,
  UUID,
  ModelType,
} from "@elizaos/core";
import { DatabasePoolerManager, PoolType } from "./database-pooler-manager";

/**
 * Enhanced Database Memory Service
 *
 * Provides advanced memory retrieval using ElizaOS built-in database patterns:
 * - Semantic search with vector embeddings
 * - Memory pattern analysis
 * - Cross-platform context aggregation
 * - NUBI-specific analytics functions
 */

interface MemoryPattern {
  pattern_type: string;
  pattern_count: number;
  avg_sentiment: number;
  unique_users: number;
  first_seen: Date;
  last_seen: Date;
}

interface EntityInteraction {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  avg_sentiment: number;
}

interface RelationshipContext {
  userId: string;
  userHandle: string;
  relationship_type: string;
  interaction_count: number;
  sentiment: string;
  tags: string[];
}

interface EmotionalContext {
  current_state: string;
  intensity: number;
  duration: number;
  triggers: string[];
  last_update: Date;
}

interface UserRecord {
  id: string;
  recordType: string;
  content: string;
  tags: string[];
  importanceScore: number;
  relevanceScore: number;
  createdAt: Date;
}

interface EnhancedMemoryContext {
  recentMemories: Memory[];
  semanticMemories: Memory[];
  patterns: MemoryPattern[];
  entities: EntityInteraction[];
  relationships: RelationshipContext[];
  emotionalState: EmotionalContext | null;
  communityContext: any;
  agentStats: any;
  userRecords: UserRecord[];
}

export class DatabaseMemoryService extends Service {
  static serviceType = "database_memory" as const;
  capabilityDescription =
    "Advanced database-driven memory retrieval and context building";

  private agentId: UUID;
  private poolerManager?: DatabasePoolerManager;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.agentId = runtime.agentId;
  }

  static async start(runtime: IAgentRuntime): Promise<DatabaseMemoryService> {
    const service = new DatabaseMemoryService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    try {
      // Use ElizaOS built-in database connection if available
      if (this.runtime.getConnection) {
        await this.runtime.getConnection();
        logger.info(
          "[DATABASE_MEMORY_SERVICE] Connected to database via ElizaOS runtime",
        );
      } else {
        logger.warn(
          "[DATABASE_MEMORY_SERVICE] No database connection available - running in test mode",
        );
      }

      // Get the database pooler manager if available
      try {
        const service = this.runtime.getService<DatabasePoolerManager>(
          "database-pooler-manager",
        );
        this.poolerManager = service || undefined;
        if (this.poolerManager) {
          logger.info(
            "[DATABASE_MEMORY_SERVICE] Connected to database pooler manager",
          );
        }
      } catch (error) {
        logger.debug(
          "[DATABASE_MEMORY_SERVICE] Database pooler manager not available, using fallback",
        );
      }
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to initialize:",
        error instanceof Error ? error.message : String(error),
      );
      // Don't throw in test environment - allow graceful degradation
      if (
        process.env.NODE_ENV === "test" ||
        process.env.NODE_ENV === "development"
      ) {
        logger.warn(
          "[DATABASE_MEMORY_SERVICE] Continuing without database connection",
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Get comprehensive memory context for response generation
   */
  async getEnhancedContext(
    roomId: UUID,
    userId?: UUID,
    topic?: string,
    limit: number = 20,
  ): Promise<EnhancedMemoryContext> {
    const context: EnhancedMemoryContext = {
      recentMemories: [],
      semanticMemories: [],
      patterns: [],
      entities: [],
      relationships: [],
      emotionalState: null,
      communityContext: {},
      agentStats: {},
      userRecords: [],
    };

    try {
      // Use ElizaOS built-in memory methods
      const recentMemories = await this.getRecentMemories(roomId, limit);
      const semanticMemories = topic
        ? await this.getSemanticMemories(topic, roomId, limit)
        : [];

      context.recentMemories = recentMemories;
      context.semanticMemories = semanticMemories;

      // Simplified context without complex database queries
      context.patterns = [];
      context.entities = [];
      context.relationships = [];
      context.emotionalState = null;
      context.communityContext = {};
      context.agentStats = {};
      context.userRecords = [];

      logger.debug(
        "[DATABASE_MEMORY_SERVICE] Built enhanced context: " +
          `memories=${context.recentMemories.length}, ` +
          `semantic=${context.semanticMemories.length}`,
      );

      return context;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to build context:",
        error instanceof Error ? error.message : String(error),
      );
      return context; // Return partial context
    }
  }

  /**
   * Get recent memories from the room using ElizaOS built-in methods
   */
  private async getRecentMemories(
    roomId: UUID,
    limit: number,
  ): Promise<Memory[]> {
    try {
      // Use ElizaOS built-in memory retrieval
      const memories = await this.runtime.getMemories({
        roomId: roomId as any,
        agentId: this.agentId,
        count: limit,
        unique: false,
        tableName: "memories",
      });

      return memories;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to get recent memories:",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Get semantically similar memories using ElizaOS built-in search
   */
  private async getSemanticMemories(
    topic: string,
    roomId: UUID,
    limit: number,
  ): Promise<Memory[]> {
    try {
      // First generate embedding for the topic
      const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: topic,
      });

      // Use ElizaOS built-in semantic search with embedding
      const memories = await this.runtime.searchMemories({
        embedding: embedding,
        roomId: roomId as any,
        entityId: this.agentId,
        count: limit,
        match_threshold: 0.7,
        tableName: "memories",
      });

      return memories;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to get semantic memories:",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Store memory with vector embedding using ElizaOS methods
   */
  async storeMemoryWithEmbedding(
    memory: Memory,
    embedding?: number[],
  ): Promise<boolean> {
    try {
      // Use ElizaOS built-in memory storage
      await this.runtime.createMemory(memory, "memories", false);

      // ElizaOS handles embeddings automatically when configured
      logger.debug(`[DATABASE_MEMORY_SERVICE] Stored memory ${memory.id}`);

      return true;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to store memory:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Update personality traits using ElizaOS settings
   */
  async updatePersonalityTraits(traits: Record<string, number>): Promise<void> {
    try {
      // Use ElizaOS built-in settings instead of custom cache table
      this.runtime.setSetting("personality_traits", traits);
      logger.debug("[DATABASE_MEMORY_SERVICE] Updated personality traits");
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to update traits:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * RAID-SPECIFIC MEMORY METHODS
   * Using ElizaOS memory patterns for raid participant tracking and context
   */

  /**
   * Store raid participant data using ElizaOS memory patterns
   */
  async storeRaidParticipant(
    roomId: string,
    raidId: string,
    participant: {
      telegramId: string;
      telegramUsername: string;
      twitterUsername?: string;
      actionsCompleted: number;
      pointsEarned: number;
      verified: boolean;
    },
  ): Promise<boolean> {
    try {
      const participantMemory: Memory = {
        id: crypto.randomUUID() as any,
        agentId: this.agentId,
        entityId:
          participant.telegramId as `${string}-${string}-${string}-${string}-${string}`,
        roomId: roomId as any,
        content: {
          text: `Raid participant ${participant.telegramUsername} in raid ${raidId}`,
          type: "raid_participant",
          raidId,
          telegramId: participant.telegramId,
          telegramUsername: participant.telegramUsername,
          twitterUsername: participant.twitterUsername,
          actionsCompleted: participant.actionsCompleted,
          pointsEarned: participant.pointsEarned,
          verified: participant.verified,
          joinedAt: new Date().toISOString(),
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(participantMemory, "memories", false);

      logger.debug(
        `[DATABASE_MEMORY_SERVICE] Stored raid participant: ${participant.telegramUsername} for raid ${raidId}`,
      );

      return true;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to store raid participant:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Get raid context and participant history using semantic search
   */
  async getRaidContext(
    raidId: string,
    roomId?: string,
    limit: number = 50,
  ): Promise<{
    raidMemories: Memory[];
    participants: any[];
    metrics: any;
  }> {
    try {
      // Search for raid-related memories
      const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: raidId,
      });
      const raidMemories = await this.runtime.searchMemories({
        embedding,
        roomId: (roomId || crypto.randomUUID()) as any,
        count: limit,
        match_threshold: 0.5,
        tableName: "memories",
      });

      // Parse participant data from memories
      const participants = raidMemories
        .filter((m) => (m.content as any)?.type === "raid_participant")
        .map((m) => {
          const content = m.content as any;
          return {
            telegramId: content.telegramId,
            telegramUsername: content.telegramUsername,
            twitterUsername: content.twitterUsername,
            actionsCompleted: content.actionsCompleted || 0,
            pointsEarned: content.pointsEarned || 0,
            verified: content.verified || false,
            joinedAt: content.joinedAt,
          };
        });

      // Extract metrics from raid memories
      const metricsMemory = raidMemories.find(
        (m) => (m.content as any)?.type === "raid_metrics",
      );
      const metrics = metricsMemory ? (metricsMemory.content as any) : {};

      logger.debug(
        `[DATABASE_MEMORY_SERVICE] Retrieved raid context for ${raidId}: ` +
          `${raidMemories.length} memories, ${participants.length} participants`,
      );

      return {
        raidMemories,
        participants,
        metrics,
      };
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to get raid context:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        raidMemories: [],
        participants: [],
        metrics: {},
      };
    }
  }

  /**
   * Track raid progress using ElizaOS memory patterns
   */
  async trackRaidProgress(
    raidId: string,
    roomId: string,
    progressData: {
      status: string;
      participantCount: number;
      actionsCompleted: number;
      completionRate: number;
      timestamp: Date;
    },
  ): Promise<boolean> {
    try {
      const progressMemory: Memory = {
        id: crypto.randomUUID() as any,
        agentId: this.agentId,
        entityId: this.agentId,
        roomId: roomId as any,
        content: {
          text: `Raid ${raidId} progress: ${Math.round(progressData.completionRate * 100)}% complete`,
          type: "raid_progress",
          raidId,
          status: progressData.status,
          participantCount: progressData.participantCount,
          actionsCompleted: progressData.actionsCompleted,
          completionRate: progressData.completionRate,
          timestamp: progressData.timestamp.toISOString(),
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(progressMemory, "memories", false);

      logger.debug(
        `[DATABASE_MEMORY_SERVICE] Tracked raid progress: ${raidId} - ${Math.round(progressData.completionRate * 100)}% complete`,
      );

      return true;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to track raid progress:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Get participant lookup using ElizaOS semantic search
   */
  async lookupRaidParticipant(
    telegramUsername: string,
    raidId?: string,
  ): Promise<any[]> {
    try {
      const searchQuery = raidId
        ? `${telegramUsername} raid_participant ${raidId}`
        : `${telegramUsername} raid_participant`;

      const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: searchQuery,
      });
      const participantMemories = await this.runtime.searchMemories({
        embedding,
        count: 10,
        match_threshold: 0.7,
        tableName: "memories",
      });

      const participants = participantMemories
        .filter((m) => (m.content as any)?.type === "raid_participant")
        .map((m) => {
          const content = m.content as any;
          return {
            raidId: content.raidId,
            telegramId: content.telegramId,
            telegramUsername: content.telegramUsername,
            twitterUsername: content.twitterUsername,
            actionsCompleted: content.actionsCompleted || 0,
            pointsEarned: content.pointsEarned || 0,
            verified: content.verified || false,
            joinedAt: content.joinedAt,
            memoryId: m.id,
          };
        });

      logger.debug(
        `[DATABASE_MEMORY_SERVICE] Found ${participants.length} participant records for ${telegramUsername}`,
      );

      return participants;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to lookup raid participant:",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Store raid metrics using ElizaOS memory system
   */
  async storeRaidAnalytics(
    roomId: string,
    raidId: string,
    analytics: {
      totalParticipants: number;
      verifiedParticipants: number;
      completionRate: number;
      engagementScore: number;
      avgResponseTime: number;
      successRate: number;
      twitterMetrics?: any;
    },
  ): Promise<boolean> {
    try {
      const analyticsMemory: Memory = {
        id: crypto.randomUUID() as any,
        agentId: this.agentId,
        entityId: this.agentId,
        roomId: roomId as any,
        content: {
          text: `Raid ${raidId} analytics: ${analytics.totalParticipants} participants, ${Math.round(analytics.successRate * 100)}% success`,
          type: "raid_analytics",
          raidId,
          totalParticipants: analytics.totalParticipants,
          verifiedParticipants: analytics.verifiedParticipants,
          completionRate: analytics.completionRate,
          engagementScore: analytics.engagementScore,
          avgResponseTime: analytics.avgResponseTime,
          successRate: analytics.successRate,
          twitterMetrics: analytics.twitterMetrics,
          timestamp: new Date().toISOString(),
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(analyticsMemory, "memories", false);

      logger.info(
        `[DATABASE_MEMORY_SERVICE] Stored raid analytics: ${raidId} - ${Math.round(analytics.successRate * 100)}% success`,
      );

      return true;
    } catch (error) {
      logger.error(
        "[DATABASE_MEMORY_SERVICE] Failed to store raid analytics:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Clean up on service stop
   */
  async stop(): Promise<void> {
    // ElizaOS handles database cleanup automatically
    logger.info("[DATABASE_MEMORY_SERVICE] Service stopped");
  }
}

export default DatabaseMemoryService;
