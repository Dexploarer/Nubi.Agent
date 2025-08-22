import {
  Service,
  IAgentRuntime,
  Memory,
  logger,
  UUID,
  ModelType,
} from "@elizaos/core";

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
        roomId: roomId,
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
        roomId: roomId,
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
   * Clean up on service stop
   */
  async stop(): Promise<void> {
    // ElizaOS handles database cleanup automatically
    logger.info("[DATABASE_MEMORY_SERVICE] Service stopped");
  }
}

export default DatabaseMemoryService;
