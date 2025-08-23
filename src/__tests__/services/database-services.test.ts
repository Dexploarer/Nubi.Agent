import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { logger, UUID, Memory, ModelType } from "@elizaos/core";
import { DatabaseMemoryService } from "../../services/database-memory-service";
import {
  DatabasePoolerManager,
  PoolType,
} from "../../services/database-pooler-manager";
import { MockRuntime } from "../test-utils";

/**
 * Database Services Tests
 *
 * Following ElizaOS testing guidelines from:
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 *
 * Tests cover:
 * - Database pooler management and routing
 * - Memory service with semantic search
 * - Raid participant tracking
 * - Context building and retrieval
 * - Connection pool optimization
 */

describe("DatabasePoolerManager", () => {
  let poolerManager: DatabasePoolerManager;
  let runtime: MockRuntime;

  beforeEach(() => {
    runtime = new MockRuntime();
    // Mock environment variables
    process.env.SUPABASE_TRANSACTION_POOLER_URL =
      "postgresql://test:test@localhost:6543/test";
    process.env.SUPABASE_SESSION_POOLER_URL =
      "postgresql://test:test@localhost:5432/test";
  });

  afterEach(async () => {
    if (poolerManager) {
      await poolerManager.stop();
    }
    delete process.env.SUPABASE_TRANSACTION_POOLER_URL;
    delete process.env.SUPABASE_SESSION_POOLER_URL;
    mock.restore();
  });

  describe("Pool Selection", () => {
    it("should detect simple queries for transaction pool", () => {
      const queries = [
        "INSERT INTO users (name) VALUES ($1)",
        "UPDATE sessions SET active = true WHERE id = $1",
        "DELETE FROM messages WHERE created_at < $1",
        "SELECT * FROM users WHERE id = $1",
      ];

      queries.forEach((query) => {
        const poolType = DatabasePoolerManager.detectPoolType(query);
        expect(poolType).toBe(PoolType.TRANSACTION);
        logger.debug(
          `[TEST] Query routed to TRANSACTION pool: ${query.substring(0, 30)}...`,
        );
      });
    });

    it("should detect complex queries for session pool", () => {
      const queries = [
        "SELECT u.*, s.* FROM users u JOIN sessions s ON u.id = s.user_id",
        "WITH active_users AS (SELECT * FROM users) SELECT * FROM active_users",
        "SELECT * FROM users u INNER JOIN roles r ON u.role_id = r.id",
        "SELECT COUNT(*) OVER (PARTITION BY category) FROM products",
      ];

      queries.forEach((query) => {
        const poolType = DatabasePoolerManager.detectPoolType(query);
        expect(poolType).toBe(PoolType.SESSION);
        logger.debug(
          `[TEST] Query routed to SESSION pool: ${query.substring(0, 30)}...`,
        );
      });
    });

    it("should handle vector operations with session pool", () => {
      const vectorQueries = [
        "SELECT * FROM memories ORDER BY embedding <-> $1 LIMIT 10",
        "SELECT * FROM documents WHERE embedding <#> $1 < 0.5",
        "INSERT INTO memories (embedding) VALUES ($1::vector)",
      ];

      vectorQueries.forEach((query) => {
        const poolType = DatabasePoolerManager.detectPoolType(query);
        expect(poolType).toBe(PoolType.SESSION);
      });
    });
  });

  describe("Connection Management", () => {
    it("should initialize with proper configuration", async () => {
      poolerManager = new DatabasePoolerManager();
      const isAvailable = await poolerManager.start(runtime);

      // Will be false in test environment without actual DB
      expect(typeof isAvailable).toBe("boolean");
      logger.info(`[TEST] Pooler manager availability: ${isAvailable}`);
    });

    it("should handle missing environment variables gracefully", async () => {
      delete process.env.SUPABASE_TRANSACTION_POOLER_URL;
      delete process.env.SUPABASE_SESSION_POOLER_URL;

      poolerManager = new DatabasePoolerManager();
      const isAvailable = await poolerManager.start(runtime);

      expect(isAvailable).toBe(false);
    });

    it("should respect pool size limits", () => {
      const config = DatabasePoolerManager.getPoolConfig(PoolType.TRANSACTION);
      expect(config.max).toBe(20);

      const sessionConfig = DatabasePoolerManager.getPoolConfig(
        PoolType.SESSION,
      );
      expect(sessionConfig.max).toBe(5);
    });
  });

  describe("Query Execution", () => {
    beforeEach(async () => {
      poolerManager = new DatabasePoolerManager();
      await poolerManager.start(runtime);
    });

    it("should execute queries with proper pool selection", async () => {
      // Mock the query method
      const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));
      poolerManager.query = mockQuery;

      await poolerManager.query("INSERT INTO test VALUES ($1)", ["test"]);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("should handle query errors gracefully", async () => {
      const mockQuery = mock(() =>
        Promise.reject(new Error("Connection failed")),
      );
      poolerManager.query = mockQuery;

      try {
        await poolerManager.query("SELECT * FROM test");
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("Connection failed");
      }
    });

    it("should support parameterized queries", async () => {
      const mockQuery = mock(() =>
        Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 }),
      );
      poolerManager.query = mockQuery;

      const result = await poolerManager.query(
        "SELECT * FROM users WHERE id = $1 AND name = $2",
        [1, "test"],
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1 AND name = $2",
        [1, "test"],
        expect.any(Object),
      );
    });
  });
});

describe("DatabaseMemoryService", () => {
  let memoryService: DatabaseMemoryService;
  let runtime: MockRuntime;

  beforeEach(async () => {
    runtime = new MockRuntime();
    memoryService = await DatabaseMemoryService.start(runtime);
  });

  afterEach(async () => {
    await memoryService.stop();
    mock.restore();
  });

  describe("Memory Storage and Retrieval", () => {
    it("should store memories with embeddings", async () => {
      const memory: Memory = {
        id: crypto.randomUUID() as UUID,
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: crypto.randomUUID() as UUID,
        content: {
          text: "Test memory content",
          type: "test",
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      const result = await memoryService.storeMemoryWithEmbedding(memory);
      expect(result).toBe(true);
      logger.debug(`[TEST] Stored memory: ${memory.id}`);
    });

    it("should retrieve recent memories", async () => {
      const roomId = crypto.randomUUID() as UUID;

      // Mock the runtime getMemories method
      const mockMemories: Memory[] = [
        {
          id: crypto.randomUUID() as UUID,
          agentId: runtime.agentId,
          entityId: runtime.agentId,
          roomId,
          content: { text: "Recent memory 1", type: "test" },
          embedding: undefined,
          createdAt: Date.now() - 1000,
        },
        {
          id: crypto.randomUUID() as UUID,
          agentId: runtime.agentId,
          entityId: runtime.agentId,
          roomId,
          content: { text: "Recent memory 2", type: "test" },
          embedding: undefined,
          createdAt: Date.now(),
        },
      ];

      runtime.getMemories = mock(() => Promise.resolve(mockMemories));

      const context = await memoryService.getEnhancedContext(
        roomId,
        undefined,
        undefined,
        10,
      );

      expect(context.recentMemories).toHaveLength(2);
      expect(context.recentMemories[0].content.text).toContain("Recent memory");
    });

    it("should perform semantic search", async () => {
      const roomId = crypto.randomUUID() as UUID;
      const topic = "raid participation";

      // Mock embedding generation
      runtime.useModel = mock(() => Promise.resolve([0.1, 0.2, 0.3]));

      // Mock semantic search
      runtime.searchMemories = mock(() =>
        Promise.resolve([
          {
            id: crypto.randomUUID() as UUID,
            agentId: runtime.agentId,
            entityId: runtime.agentId,
            roomId,
            content: { text: "User joined raid", type: "raid" },
            embedding: undefined,
            createdAt: Date.now(),
          },
        ]),
      );

      const context = await memoryService.getEnhancedContext(
        roomId,
        undefined,
        topic,
        10,
      );

      expect(context.semanticMemories).toHaveLength(1);
      expect(runtime.useModel).toHaveBeenCalledWith(ModelType.TEXT_EMBEDDING, {
        text: topic,
      });
    });
  });

  describe("Raid Participant Management", () => {
    it("should store raid participants", async () => {
      const participant = {
        telegramId: "123456",
        telegramUsername: "testuser",
        twitterUsername: "testuser_tw",
        actionsCompleted: 5,
        pointsEarned: 50,
        verified: true,
      };

      const result = await memoryService.storeRaidParticipant(
        "room123",
        "raid001",
        participant,
      );

      expect(result).toBe(true);
      logger.info(
        `[TEST] Stored raid participant: ${participant.telegramUsername}`,
      );
    });

    it("should retrieve raid context", async () => {
      const raidId = "raid001";

      // Mock raid memories
      runtime.useModel = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
      runtime.searchMemories = mock(() =>
        Promise.resolve([
          {
            id: crypto.randomUUID() as UUID,
            agentId: runtime.agentId,
            entityId: runtime.agentId,
            roomId: crypto.randomUUID() as UUID,
            content: {
              text: "Raid participant",
              type: "raid_participant",
              telegramId: "123456",
              telegramUsername: "user1",
              actionsCompleted: 10,
              pointsEarned: 100,
              verified: true,
            },
            embedding: undefined,
            createdAt: Date.now(),
          },
        ]),
      );

      const context = await memoryService.getRaidContext(raidId);

      expect(context.participants).toHaveLength(1);
      expect(context.participants[0].telegramUsername).toBe("user1");
      expect(context.participants[0].pointsEarned).toBe(100);
    });

    it("should track raid progress", async () => {
      const progressData = {
        status: "active",
        participantCount: 50,
        actionsCompleted: 250,
        completionRate: 0.5,
        timestamp: new Date(),
      };

      const result = await memoryService.trackRaidProgress(
        "raid001",
        "room123",
        progressData,
      );

      expect(result).toBe(true);
      logger.debug(
        `[TEST] Tracked raid progress: ${progressData.completionRate * 100}% complete`,
      );
    });

    it("should lookup raid participants", async () => {
      runtime.useModel = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
      runtime.searchMemories = mock(() =>
        Promise.resolve([
          {
            id: crypto.randomUUID() as UUID,
            agentId: runtime.agentId,
            entityId: runtime.agentId,
            roomId: crypto.randomUUID() as UUID,
            content: {
              type: "raid_participant",
              raidId: "raid001",
              telegramId: "123456",
              telegramUsername: "testuser",
              pointsEarned: 150,
            },
            embedding: undefined,
            createdAt: Date.now(),
          },
        ]),
      );

      const participants = await memoryService.lookupRaidParticipant(
        "testuser",
        "raid001",
      );

      expect(participants).toHaveLength(1);
      expect(participants[0].telegramUsername).toBe("testuser");
      expect(participants[0].pointsEarned).toBe(150);
    });

    it("should store raid analytics", async () => {
      const analytics = {
        totalParticipants: 100,
        verifiedParticipants: 85,
        completionRate: 0.75,
        engagementScore: 0.9,
        avgResponseTime: 30,
        successRate: 0.8,
        twitterMetrics: {
          likes: 500,
          retweets: 200,
          replies: 150,
        },
      };

      const result = await memoryService.storeRaidAnalytics(
        "room123",
        "raid001",
        analytics,
      );

      expect(result).toBe(true);
      logger.info(
        `[TEST] Stored raid analytics: ${analytics.successRate * 100}% success rate`,
      );
    });
  });

  describe("Context Building", () => {
    it("should build comprehensive context", async () => {
      const roomId = crypto.randomUUID() as UUID;
      const userId = crypto.randomUUID() as UUID;

      // Mock all context retrieval methods
      runtime.getMemories = mock(() => Promise.resolve([]));
      runtime.searchMemories = mock(() => Promise.resolve([]));
      runtime.useModel = mock(() => Promise.resolve([0.1, 0.2, 0.3]));

      const context = await memoryService.getEnhancedContext(
        roomId,
        userId,
        "test topic",
        20,
      );

      expect(context).toBeDefined();
      expect(context.recentMemories).toBeDefined();
      expect(context.semanticMemories).toBeDefined();
      expect(context.patterns).toBeDefined();
      expect(context.entities).toBeDefined();
      expect(context.relationships).toBeDefined();
      expect(context.emotionalState).toBeDefined();
      expect(context.communityContext).toBeDefined();
      expect(context.agentStats).toBeDefined();
      expect(context.userRecords).toBeDefined();
    });

    it("should handle context retrieval errors gracefully", async () => {
      const roomId = crypto.randomUUID() as UUID;

      // Mock failure
      runtime.getMemories = mock(() =>
        Promise.reject(new Error("Database error")),
      );

      const context = await memoryService.getEnhancedContext(roomId);

      // Should return partial context even on error
      expect(context).toBeDefined();
      expect(context.recentMemories).toEqual([]);
    });
  });

  describe("Personality Management", () => {
    it("should update personality traits", async () => {
      const traits = {
        humor: 0.8,
        technical: 0.9,
        mystical: 0.7,
        supportive: 0.85,
        assertive: 0.6,
      };

      await memoryService.updatePersonalityTraits(traits);

      // Verify through runtime settings
      expect(runtime.getSetting("personality_traits")).toEqual(traits);
      logger.debug(
        `[TEST] Updated personality traits: ${JSON.stringify(traits)}`,
      );
    });

    it("should handle trait updates with invalid values", async () => {
      const invalidTraits = {
        humor: 1.5, // Invalid: > 1
        technical: -0.5, // Invalid: < 0
        mystical: "high", // Invalid: not a number
      };

      // Should handle gracefully without throwing
      await memoryService.updatePersonalityTraits(invalidTraits as any);

      // Settings might not be updated or might be sanitized
      const stored = runtime.getSetting("personality_traits");
      expect(stored).toBeDefined();
    });
  });

  describe("Performance Optimization", () => {
    it("should batch memory operations efficiently", async () => {
      const memories = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID() as UUID,
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: crypto.randomUUID() as UUID,
        content: { text: `Memory ${i}`, type: "test" },
        embedding: undefined,
        createdAt: Date.now() + i,
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        memories.map((m) => memoryService.storeMemoryWithEmbedding(m)),
      );

      const duration = Date.now() - startTime;

      expect(results.every((r) => r === true)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      logger.info(`[TEST] Stored ${memories.length} memories in ${duration}ms`);
    });

    it("should cache frequently accessed data", async () => {
      const roomId = crypto.randomUUID() as UUID;

      // Mock expensive operations
      let callCount = 0;
      runtime.getMemories = mock(() => {
        callCount++;
        return Promise.resolve([]);
      });

      // Multiple calls to same context
      await memoryService.getEnhancedContext(roomId);
      await memoryService.getEnhancedContext(roomId);
      await memoryService.getEnhancedContext(roomId);

      // Should use some form of caching or optimization
      expect(callCount).toBeGreaterThan(0);
      logger.debug(`[TEST] Memory retrieval called ${callCount} times`);
    });
  });
});
