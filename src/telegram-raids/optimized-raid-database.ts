/**
 * Optimized Raid Database Service
 *
 * Lightweight database optimization for telegram raids
 * Integrates with existing DatabaseConnectionManager
 */

import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { DatabasePoolerManager, PoolType } from "../services/database-pooler-manager";

export interface OptimizedRaidQueries {
  createRaid: string;
  updateRaidStats: string;
  addParticipant: string;
  updateParticipant: string;
  getRaidStats: string;
  getLeaderboard: string;
}

export class OptimizedRaidDatabase extends Service {
  static serviceType = "optimized_raid_database" as const;
  capabilityDescription = "Optimized database operations for telegram raids";

  protected runtime: IAgentRuntime;
  private poolerManager?: DatabasePoolerManager;
  private queries: OptimizedRaidQueries;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.queries = this.initializeQueries();
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    // Get the database pooler manager if available
    try {
      this.poolerManager = runtime.getService<DatabasePoolerManager>("database-pooler-manager");
      if (this.poolerManager) {
        logger.info("[OPTIMIZED_RAID_DB] Connected to database pooler manager");
      }
    } catch (error) {
      logger.debug("[OPTIMIZED_RAID_DB] Database pooler manager not available, using fallback");
    }
  }

  private initializeQueries(): OptimizedRaidQueries {
    return {
      createRaid: `
        INSERT INTO telegram_raids 
        (id, post_url, start_time, end_time, status, participant_count, total_engagements, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      updateRaidStats: `
        UPDATE telegram_raids 
        SET participant_count = $2, total_engagements = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      addParticipant: `
        INSERT INTO raid_participants 
        (raid_id, user_id, username, joined_at, points_earned, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (raid_id, user_id) DO UPDATE SET
        points_earned = EXCLUDED.points_earned,
        is_active = EXCLUDED.is_active,
        last_action_at = NOW()
        RETURNING *
      `,
      updateParticipant: `
        UPDATE raid_participants 
        SET points_earned = $3, is_active = $4, last_action_at = NOW()
        WHERE raid_id = $1 AND user_id = $2
        RETURNING *
      `,
      getRaidStats: `
        SELECT 
          r.*,
          COALESCE(COUNT(p.id), 0) as participant_count,
          COALESCE(SUM(p.points_earned), 0) as total_points,
          COALESCE(COUNT(*) FILTER (WHERE p.is_active = true), 0) as active_count
        FROM telegram_raids r
        LEFT JOIN raid_participants p ON r.id = p.raid_id
        WHERE r.id = $1
        GROUP BY r.id
      `,
      getLeaderboard: `
        SELECT 
          user_id,
          username,
          SUM(points_earned) as total_points,
          COUNT(*) as total_raids,
          COUNT(*) FILTER (WHERE is_active = true) as successful_raids,
          ROUND(AVG(points_earned), 2) as avg_points_per_raid,
          MAX(last_action_at) as last_activity,
          ROW_NUMBER() OVER (ORDER BY SUM(points_earned) DESC) as rank
        FROM raid_participants 
        WHERE created_at >= $1
        GROUP BY user_id, username
        ORDER BY total_points DESC
        LIMIT $2
      `,
    };
  }

  /**
   * Execute multiple queries in parallel
   */
  async batchExecute(
    operations: Array<{
      query: keyof OptimizedRaidQueries | string;
      params: any[];
    }>,
  ): Promise<any[]> {
    try {
      if (this.poolerManager) {
        // Use transaction pool for batch operations
        const promises = operations.map(async ({ query, params }) => {
          const sql = typeof query === "string" ? query : this.queries[query];
          const result = await this.poolerManager!.query(sql, params, { poolType: PoolType.TRANSACTION });
          return result.rows;
        });
        return await Promise.all(promises);
      } else {
        // Fallback: use ElizaOS runtime connection methods
        throw new Error("Database pooler manager not available - cannot perform batch operations");
      }
    } catch (error) {
      logger.error("Batch query execution failed:", error);
      throw error;
    }
  }

  /**
   * Create raid and initialize tracking
   */
  async createRaidWithTracking(raidData: {
    id: string;
    postUrl: string;
    startTime: Date;
    endTime: Date;
  }): Promise<any> {
    const operations = [
      {
        query: "createRaid" as const,
        params: [
          raidData.id,
          raidData.postUrl,
          raidData.startTime,
          raidData.endTime,
          "active",
          0,
          0,
          new Date(),
        ],
      },
      {
        query: `
          CREATE TABLE IF NOT EXISTS raid_participants_${raidData.id.replace(/[^a-zA-Z0-9]/g, "_")} (
            user_id TEXT,
            action_type TEXT,
            timestamp TIMESTAMP,
            verified BOOLEAN DEFAULT false
          )
        `,
        params: [],
      },
    ];

    const results = await this.batchExecute(operations);
    return results[0][0];
  }

  /**
   * Batch update participants
   */
  async batchUpdateParticipants(
    updates: Array<{
      raidId: string;
      userId: string;
      pointsEarned: number;
      isActive: boolean;
    }>,
  ): Promise<any[]> {
    const operations = updates.map((update) => ({
      query: "updateParticipant" as const,
      params: [
        update.raidId,
        update.userId,
        update.pointsEarned,
        update.isActive,
      ],
    }));

    return this.batchExecute(operations);
  }

  /**
   * Get comprehensive raid analytics
   */
  async getRaidAnalytics(raidId: string): Promise<{
    raid: any;
    participants: any[];
    stats: any;
  }> {
    if (this.poolerManager) {
      // Use session pool for complex analytics queries
      const operations = [
        { sql: this.queries.getRaidStats, params: [raidId] },
        { sql: `SELECT * FROM raid_participants WHERE raid_id = $1 ORDER BY points_earned DESC`, params: [raidId] },
        { 
          sql: `
            SELECT 
              AVG(points_earned) as avg_points,
              MAX(points_earned) as max_points,
              MIN(points_earned) as min_points
            FROM raid_participants 
            WHERE raid_id = $1
          `, 
          params: [raidId] 
        },
      ];

      const results = await this.poolerManager.transaction<any>(operations, { poolType: PoolType.SESSION });

      return {
        raid: results[0][0],
        participants: results[1],
        stats: results[2][0],
      };
    } else {
      // Fallback to original batch execute method
      const operations = [
        {
          query: "getRaidStats" as const,
          params: [raidId],
        },
        {
          query: `SELECT * FROM raid_participants WHERE raid_id = $1 ORDER BY points_earned DESC`,
          params: [raidId],
        },
        {
          query: `
            SELECT 
              AVG(points_earned) as avg_points,
              MAX(points_earned) as max_points,
              MIN(points_earned) as min_points
            FROM raid_participants 
            WHERE raid_id = $1
          `,
          params: [raidId],
        },
      ];

      const [raidData, participants, stats] = await this.batchExecute(operations);

      return {
        raid: raidData[0],
        participants,
        stats: stats[0],
      };
    }
  }

  /**
   * Get leaderboard with caching consideration
   */
  async getLeaderboard(
    period: "daily" | "weekly" | "monthly" = "weekly",
    limit: number = 50,
  ): Promise<any[]> {
    const dateFilter = this.getDateFilter(period);
    
    if (this.poolerManager) {
      // Use session pool for complex leaderboard queries
      const result = await this.poolerManager.query(
        this.queries.getLeaderboard,
        [dateFilter, limit],
        { poolType: PoolType.SESSION }
      );
      return result.rows;
    } else {
      // Fallback: use ElizaOS runtime connection methods
      throw new Error("Database pooler manager not available - cannot get leaderboard");
    }
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case "daily":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "weekly":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "monthly":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }

  async stop(): Promise<void> {
    logger.info("OptimizedRaidDatabase stopped");
  }
}

export default OptimizedRaidDatabase;
