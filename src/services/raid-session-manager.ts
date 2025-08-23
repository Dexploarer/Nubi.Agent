import {
  Service,
  IAgentRuntime,
  logger,
  UUID,
  Memory,
} from "@elizaos/core";
import { NUBISessionsService, RaidSession, RaidParticipant } from "./nubi-sessions-service";
import { DatabaseMemoryService } from "./database-memory-service";
import { DatabasePoolerManager, PoolType } from "./database-pooler-manager";

/**
 * Raid Session Manager
 * 
 * Specialized service for managing raid session lifecycle:
 * - Real-time raid progress tracking
 * - Participant action verification
 * - Automatic raid completion handling
 * - Integration with XMCPX MCP tools
 * - Performance analytics and leaderboards
 */

export interface RaidAction {
  participantId: string;
  actionType: 'like' | 'retweet' | 'reply' | 'quote' | 'follow';
  targetId: string;
  timestamp: Date;
  verified: boolean;
  points: number;
}

export interface RaidMetrics {
  totalActions: number;
  uniqueParticipants: number;
  completionRate: number;
  averageResponseTime: number;
  successRate: number;
  engagementScore: number;
  timeRemaining: number;
}

export interface RaidLeaderboardEntry {
  rank: number;
  telegramUsername: string;
  twitterUsername?: string;
  actionsCompleted: number;
  pointsEarned: number;
  successRate: number;
  joinedAt: Date;
}

export interface RaidCompletionReport {
  raidId: string;
  sessionId: string;
  status: 'completed' | 'failed' | 'timeout';
  metrics: RaidMetrics;
  leaderboard: RaidLeaderboardEntry[];
  objectives: Array<{
    type: string;
    target: string;
    required: number;
    achieved: number;
    success: boolean;
  }>;
  duration: number;
  participantCount: number;
}

export class RaidSessionManager extends Service {
  static serviceType = "raid_session_manager" as const;
  capabilityDescription = "Advanced raid session management with real-time tracking and analytics";

  protected runtime: IAgentRuntime | undefined;
  private sessionsService: NUBISessionsService;
  private memoryService: DatabaseMemoryService;
  private poolerManager?: DatabasePoolerManager;
  private activeRaids: Map<string, NodeJS.Timeout> = new Map();
  private raidMetrics: Map<string, RaidMetrics> = new Map();

  constructor(
    runtime?: IAgentRuntime,
    sessionsService?: NUBISessionsService,
    memoryService?: DatabaseMemoryService
  ) {
    super(runtime);
    if (runtime) {
      this.runtime = runtime;
    }
    if (sessionsService) {
      this.sessionsService = sessionsService;
    }
    if (memoryService) {
      this.memoryService = memoryService;
    }
  }

  async start(): Promise<void> {
    try {
      logger.info("[RAID_MANAGER] Starting Raid Session Manager...");

      if (!this.runtime) {
        logger.warn("[RAID_MANAGER] No runtime available, service will operate in limited mode");
        return;
      }

      // Get database pooler manager
      try {
        this.poolerManager = this.runtime.getService<DatabasePoolerManager>("database-pooler-manager");
        if (this.poolerManager) {
          logger.info("[RAID_MANAGER] Connected to database pooler manager");
        }
      } catch (error) {
        logger.warn("[RAID_MANAGER] Database pooler manager not available");
      }

      // Initialize raid analytics tables
      await this.initializeAnalyticsTables();

      // Load active raids
      await this.loadActiveRaids();

      // Start metrics collection timer
      this.startMetricsCollection();

      logger.info("[RAID_MANAGER] Raid Session Manager started successfully");
    } catch (error) {
      logger.error("[RAID_MANAGER] Failed to start:", error);
      throw error;
    }
  }

  private async initializeAnalyticsTables(): Promise<void> {
    if (!this.poolerManager) return;

    const createTablesSQL = `
      -- Raid actions tracking
      CREATE TABLE IF NOT EXISTS raid_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        raid_id VARCHAR(255) NOT NULL,
        session_id UUID NOT NULL,
        participant_id VARCHAR(255) NOT NULL,
        telegram_username VARCHAR(255) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        points_earned INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT valid_action_type CHECK (action_type IN ('like', 'retweet', 'reply', 'quote', 'follow'))
      );

      -- Raid metrics snapshots
      CREATE TABLE IF NOT EXISTS raid_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        raid_id VARCHAR(255) NOT NULL,
        session_id UUID NOT NULL,
        snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        total_actions INTEGER DEFAULT 0,
        unique_participants INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,4) DEFAULT 0,
        average_response_time INTEGER DEFAULT 0,
        success_rate DECIMAL(5,4) DEFAULT 0,
        engagement_score DECIMAL(8,2) DEFAULT 0,
        time_remaining INTEGER DEFAULT 0
      );

      -- Raid completion reports
      CREATE TABLE IF NOT EXISTS raid_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        raid_id VARCHAR(255) NOT NULL UNIQUE,
        session_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL,
        final_metrics JSONB NOT NULL,
        leaderboard JSONB NOT NULL,
        objectives_report JSONB NOT NULL,
        duration INTEGER NOT NULL,
        participant_count INTEGER NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT valid_raid_status CHECK (status IN ('completed', 'failed', 'timeout'))
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_raid_actions_raid_id ON raid_actions(raid_id);
      CREATE INDEX IF NOT EXISTS idx_raid_actions_participant ON raid_actions(participant_id);
      CREATE INDEX IF NOT EXISTS idx_raid_actions_timestamp ON raid_actions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_raid_metrics_raid_id ON raid_metrics(raid_id);
      CREATE INDEX IF NOT EXISTS idx_raid_metrics_timestamp ON raid_metrics(snapshot_time);
      CREATE INDEX IF NOT EXISTS idx_raid_reports_raid_id ON raid_reports(raid_id);
    `;

    try {
      await this.poolerManager.query(createTablesSQL, [], { poolType: PoolType.SESSION });
      logger.info("[RAID_MANAGER] Analytics tables initialized successfully");
    } catch (error) {
      logger.error("[RAID_MANAGER] Failed to initialize analytics tables:", error);
      throw error;
    }
  }

  /**
   * Start monitoring a raid session
   */
  async startRaidMonitoring(raidSession: RaidSession): Promise<void> {
    try {
      logger.info(`[RAID_MANAGER] Starting monitoring for raid: ${raidSession.raidId}`);

      // Initialize metrics
      const initialMetrics: RaidMetrics = {
        totalActions: 0,
        uniqueParticipants: raidSession.participants.length,
        completionRate: 0,
        averageResponseTime: 0,
        successRate: 0,
        engagementScore: 0,
        timeRemaining: raidSession.config.duration || 3600,
      };

      this.raidMetrics.set(raidSession.raidId, initialMetrics);

      // Set up monitoring interval
      const monitoringInterval = setInterval(async () => {
        await this.updateRaidMetrics(raidSession.raidId);
        await this.checkRaidCompletion(raidSession);
      }, 30000); // Update every 30 seconds

      this.activeRaids.set(raidSession.raidId, monitoringInterval);

      // Set completion timer
      const completionTimer = setTimeout(async () => {
        await this.completeRaid(raidSession.raidId, 'timeout');
      }, (raidSession.config.duration || 3600) * 1000);

      // Store in ElizaOS memory for context
      await this.runtime.createMemory({
        id: crypto.randomUUID() as UUID,
        agentId: raidSession.agentId,
        entityId: raidSession.agentId,
        roomId: raidSession.roomId,
        content: {
          text: `Started monitoring raid: ${raidSession.raidId}`,
          type: 'raid_monitoring_started',
          raidId: raidSession.raidId,
          sessionId: raidSession.id,
          targetUrl: raidSession.targetUrl,
          objectives: raidSession.objectives,
          participants: raidSession.participants.length,
        },
        embedding: undefined,
        createdAt: Date.now(),
      }, "memories", false);

      logger.info(`[RAID_MANAGER] Monitoring started for raid: ${raidSession.raidId}`);
    } catch (error) {
      logger.error(`[RAID_MANAGER] Failed to start monitoring for raid ${raidSession.raidId}:`, error);
      throw error;
    }
  }

  /**
   * Record a raid action
   */
  async recordRaidAction(
    raidId: string,
    sessionId: string,
    action: Omit<RaidAction, 'timestamp' | 'verified'>
  ): Promise<boolean> {
    try {
      const raidAction: RaidAction = {
        ...action,
        timestamp: new Date(),
        verified: false, // Will be verified by XMCPX
      };

      // Store in database
      if (this.poolerManager) {
        const insertSQL = `
          INSERT INTO raid_actions 
          (raid_id, session_id, participant_id, telegram_username, action_type, target_id, points_earned)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        // Get participant username from session
        const session = await this.sessionsService.getSession(sessionId) as RaidSession;
        const participant = session?.participants.find(p => p.telegramId === action.participantId);
        const telegramUsername = participant?.telegramUsername || 'unknown';

        await this.poolerManager.query(insertSQL, [
          raidId,
          sessionId,
          action.participantId,
          telegramUsername,
          action.actionType,
          action.targetId,
          action.points,
        ], { poolType: PoolType.TRANSACTION });
      }

      // Store in ElizaOS memory
      await this.runtime.createMemory({
        id: crypto.randomUUID() as UUID,
        agentId: this.runtime.agentId,
        entityId: action.participantId as UUID,
        roomId: crypto.randomUUID() as UUID,
        content: {
          text: `Raid action: ${action.actionType} by ${action.participantId}`,
          type: 'raid_action',
          raidId,
          sessionId,
          participantId: action.participantId,
          actionType: action.actionType,
          targetId: action.targetId,
          points: action.points,
          timestamp: raidAction.timestamp.toISOString(),
        },
        embedding: undefined,
        createdAt: Date.now(),
      }, "memories", false);

      // Update participant progress in sessions service
      await this.updateParticipantProgress(sessionId, action.participantId, action.points);

      logger.debug(`[RAID_MANAGER] Recorded action: ${action.actionType} for raid ${raidId}`);
      return true;
    } catch (error) {
      logger.error(`[RAID_MANAGER] Failed to record action for raid ${raidId}:`, error);
      return false;
    }
  }

  /**
   * Update raid metrics
   */
  private async updateRaidMetrics(raidId: string): Promise<void> {
    if (!this.poolerManager) return;

    try {
      // Get current metrics from database
      const metricsSQL = `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT participant_id) as unique_participants,
          AVG(CASE WHEN verified THEN 1 ELSE 0 END) as success_rate,
          SUM(points_earned) as total_points
        FROM raid_actions 
        WHERE raid_id = $1 
        AND timestamp > NOW() - INTERVAL '1 hour'
      `;

      const result = await this.poolerManager.query(metricsSQL, [raidId], {
        poolType: PoolType.SESSION,
      });

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const metrics: RaidMetrics = {
          totalActions: parseInt(row.total_actions) || 0,
          uniqueParticipants: parseInt(row.unique_participants) || 0,
          completionRate: this.calculateCompletionRate(raidId, row.total_actions),
          averageResponseTime: 0, // Would need additional tracking
          successRate: parseFloat(row.success_rate) || 0,
          engagementScore: parseFloat(row.total_points) || 0,
          timeRemaining: this.calculateTimeRemaining(raidId),
        };

        this.raidMetrics.set(raidId, metrics);

        // Store metrics snapshot
        const insertMetricsSQL = `
          INSERT INTO raid_metrics 
          (raid_id, session_id, total_actions, unique_participants, completion_rate, 
           success_rate, engagement_score, time_remaining)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await this.poolerManager.query(insertMetricsSQL, [
          raidId,
          crypto.randomUUID(), // Would need to get actual session ID
          metrics.totalActions,
          metrics.uniqueParticipants,
          metrics.completionRate,
          metrics.successRate,
          metrics.engagementScore,
          metrics.timeRemaining,
        ], { poolType: PoolType.TRANSACTION });
      }
    } catch (error) {
      logger.error(`[RAID_MANAGER] Failed to update metrics for raid ${raidId}:`, error);
    }
  }

  /**
   * Check if raid should be completed
   */
  private async checkRaidCompletion(raidSession: RaidSession): Promise<void> {
    const metrics = this.raidMetrics.get(raidSession.raidId);
    if (!metrics) return;

    // Check completion criteria
    let shouldComplete = false;
    let completionStatus: 'completed' | 'failed' | 'timeout' = 'completed';

    // Check if all objectives are met
    if (metrics.completionRate >= 1.0) {
      shouldComplete = true;
      completionStatus = 'completed';
    }
    // Check if time is up
    else if (metrics.timeRemaining <= 0) {
      shouldComplete = true;
      completionStatus = 'timeout';
    }
    // Check if raid has failed (low participation)
    else if (metrics.uniqueParticipants === 0 && Date.now() - raidSession.createdAt.getTime() > 300000) {
      shouldComplete = true;
      completionStatus = 'failed';
    }

    if (shouldComplete) {
      await this.completeRaid(raidSession.raidId, completionStatus);
    }
  }

  /**
   * Complete a raid and generate report
   */
  async completeRaid(raidId: string, status: 'completed' | 'failed' | 'timeout'): Promise<RaidCompletionReport | null> {
    try {
      logger.info(`[RAID_MANAGER] Completing raid: ${raidId} with status: ${status}`);

      // Stop monitoring
      const timer = this.activeRaids.get(raidId);
      if (timer) {
        clearInterval(timer);
        this.activeRaids.delete(raidId);
      }

      // Generate final metrics
      await this.updateRaidMetrics(raidId);
      const finalMetrics = this.raidMetrics.get(raidId);
      if (!finalMetrics) return null;

      // Generate leaderboard
      const leaderboard = await this.generateLeaderboard(raidId);

      // Get objectives report
      const objectivesReport = await this.generateObjectivesReport(raidId);

      const completionReport: RaidCompletionReport = {
        raidId,
        sessionId: crypto.randomUUID(), // Would need to get actual session ID
        status,
        metrics: finalMetrics,
        leaderboard,
        objectives: objectivesReport,
        duration: 0, // Would need to calculate from session
        participantCount: finalMetrics.uniqueParticipants,
      };

      // Store completion report
      if (this.poolerManager) {
        const insertReportSQL = `
          INSERT INTO raid_reports 
          (raid_id, session_id, status, final_metrics, leaderboard, objectives_report, 
           duration, participant_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await this.poolerManager.query(insertReportSQL, [
          raidId,
          completionReport.sessionId,
          status,
          JSON.stringify(finalMetrics),
          JSON.stringify(leaderboard),
          JSON.stringify(objectivesReport),
          completionReport.duration,
          completionReport.participantCount,
        ], { poolType: PoolType.TRANSACTION });
      }

      // Store in ElizaOS memory
      await this.runtime.createMemory({
        id: crypto.randomUUID() as UUID,
        agentId: this.runtime.agentId,
        entityId: this.runtime.agentId,
        roomId: crypto.randomUUID() as UUID,
        content: {
          text: `Raid completed: ${raidId} - Status: ${status}`,
          type: 'raid_completed',
          raidId,
          status,
          metrics: finalMetrics,
          participantCount: completionReport.participantCount,
          leaderboard: leaderboard.slice(0, 5), // Top 5 for memory
        },
        embedding: undefined,
        createdAt: Date.now(),
      }, "memories", false);

      // Clean up metrics cache
      this.raidMetrics.delete(raidId);

      logger.info(`[RAID_MANAGER] Raid ${raidId} completed successfully with status: ${status}`);
      return completionReport;
    } catch (error) {
      logger.error(`[RAID_MANAGER] Failed to complete raid ${raidId}:`, error);
      return null;
    }
  }

  private async generateLeaderboard(raidId: string): Promise<RaidLeaderboardEntry[]> {
    if (!this.poolerManager) return [];

    const leaderboardSQL = `
      SELECT 
        ra.telegram_username,
        rp.twitter_username,
        COUNT(*) as actions_completed,
        SUM(ra.points_earned) as points_earned,
        AVG(CASE WHEN ra.verified THEN 1 ELSE 0 END) as success_rate,
        MIN(rp.joined_at) as joined_at
      FROM raid_actions ra
      LEFT JOIN raid_participants rp ON ra.participant_id = rp.telegram_id AND ra.raid_id = rp.raid_id
      WHERE ra.raid_id = $1
      GROUP BY ra.telegram_username, rp.twitter_username, rp.joined_at
      ORDER BY points_earned DESC, actions_completed DESC
      LIMIT 50
    `;

    try {
      const result = await this.poolerManager.query(leaderboardSQL, [raidId], {
        poolType: PoolType.SESSION,
      });

      return result.rows.map((row, index) => ({
        rank: index + 1,
        telegramUsername: row.telegram_username,
        twitterUsername: row.twitter_username,
        actionsCompleted: parseInt(row.actions_completed),
        pointsEarned: parseInt(row.points_earned),
        successRate: parseFloat(row.success_rate),
        joinedAt: new Date(row.joined_at),
      }));
    } catch (error) {
      logger.error(`[RAID_MANAGER] Failed to generate leaderboard for raid ${raidId}:`, error);
      return [];
    }
  }

  private async generateObjectivesReport(raidId: string): Promise<any[]> {
    // Simplified objectives report - would need to match actions to objectives
    return [];
  }

  private calculateCompletionRate(raidId: string, totalActions: number): number {
    // Simplified calculation - would need to compare against objectives
    return Math.min(totalActions / 100, 1.0); // Assume 100 actions needed
  }

  private calculateTimeRemaining(raidId: string): number {
    // Would need to get raid start time and duration
    return 3600; // 1 hour default
  }

  private async updateParticipantProgress(sessionId: string, participantId: string, points: number): Promise<void> {
    // Update participant in session - would integrate with sessions service
    logger.debug(`[RAID_MANAGER] Updated progress for participant ${participantId}: +${points} points`);
  }

  private async loadActiveRaids(): Promise<void> {
    // Load any raids that were running when service stopped
    logger.info("[RAID_MANAGER] Loading active raids...");
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute for all active raids
    setInterval(async () => {
      for (const raidId of this.activeRaids.keys()) {
        await this.updateRaidMetrics(raidId);
      }
    }, 60000); // 1 minute
  }

  async stop(): Promise<void> {
    // Clear all monitoring timers
    for (const timer of this.activeRaids.values()) {
      clearInterval(timer);
    }
    this.activeRaids.clear();
    this.raidMetrics.clear();

    logger.info("[RAID_MANAGER] Raid Session Manager stopped");
  }
}

export default RaidSessionManager;