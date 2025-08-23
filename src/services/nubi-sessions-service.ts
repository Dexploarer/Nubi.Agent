import {
  Service,
  IAgentRuntime,
  logger,
  UUID,
  Memory,
  State,
} from "@elizaos/core";
import { DatabasePoolerManager, PoolType } from "./database-pooler-manager";
import { DatabaseMemoryService } from "./database-memory-service";

/**
 * NUBI Sessions Service
 *
 * Implements ElizaOS Sessions API patterns for NUBI with:
 * - Session lifecycle management
 * - Real-time raid coordination sessions
 * - Community engagement tracking
 * - Integration with existing database pooler architecture
 */

export interface SessionConfig {
  agentId: UUID;
  userId?: UUID;
  roomId?: UUID;
  metadata?: Record<string, any>;
  timeout?: number;
  autoRenewal?: boolean;
  sessionType?: "conversation" | "raid" | "community";
}

export interface Session {
  id: UUID;
  agentId: UUID;
  userId?: UUID;
  roomId?: UUID;
  state: SessionState;
  config: SessionConfig;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export interface SessionState {
  status: "active" | "idle" | "expiring" | "expired";
  context: Record<string, any>;
  messages: number;
  lastInteraction: Date;
}

export interface RaidSessionConfig extends SessionConfig {
  raidId: string;
  targetUrl: string;
  objectives: RaidObjective[];
  maxParticipants: number;
  duration: number;
}

export interface RaidObjective {
  type: "like" | "retweet" | "reply" | "quote" | "follow";
  target: string;
  count: number;
  points: number;
}

export interface RaidSession extends Session {
  raidId: string;
  targetUrl: string;
  objectives: RaidObjective[];
  participants: RaidParticipant[];
  progress: RaidProgress;
}

export interface RaidParticipant {
  telegramId: string;
  telegramUsername: string;
  twitterUsername?: string;
  joinedAt: Date;
  actionsCompleted: number;
  pointsEarned: number;
  verified: boolean;
}

export interface RaidProgress {
  status: "active" | "paused" | "completed" | "failed";
  participantCount: number;
  totalActions: number;
  completionRate: number;
  timeRemaining: number;
}

export class NUBISessionsService extends Service {
  static serviceType = "nubi_sessions" as const;
  capabilityDescription =
    "ElizaOS Sessions API implementation with NUBI-specific extensions";

  declare protected runtime: IAgentRuntime;
  private poolerManager?: DatabasePoolerManager;
  private memoryService?: DatabaseMemoryService;
  private sessions: Map<string, Session> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.runtime = runtime;
  }

  async start(): Promise<void> {
    try {
      logger.info("[NUBI_SESSIONS] Starting NUBI Sessions Service...");
      this.isRunning = true;

      if (!this.runtime) {
        logger.warn(
          "[NUBI_SESSIONS] No runtime available, service will operate in limited mode",
        );
        return;
      }

      // Get database pooler manager
      try {
        this.poolerManager =
          this.runtime.getService<DatabasePoolerManager>(
            "database-pooler-manager",
          ) ?? undefined;
        if (this.poolerManager) {
          logger.info("[NUBI_SESSIONS] Connected to database pooler manager");
        }
      } catch (error) {
        logger.warn(
          "[NUBI_SESSIONS] Database pooler manager not available, using ElizaOS built-in database",
        );
      }

      // Get memory service
      try {
        this.memoryService =
          this.runtime.getService<DatabaseMemoryService>("database_memory") ??
          undefined;
        if (this.memoryService) {
          logger.info("[NUBI_SESSIONS] Connected to database memory service");
        }
      } catch (error) {
        logger.warn("[NUBI_SESSIONS] Database memory service not available");
      }

      // Initialize database tables
      await this.initializeTables();

      // Load existing sessions
      await this.loadExistingSessions();

      // Start cleanup timer
      this.startCleanupTimer();

      logger.info("[NUBI_SESSIONS] NUBI Sessions Service started successfully");
    } catch (error) {
      logger.error("[NUBI_SESSIONS] Failed to start:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async initializeTables(): Promise<void> {
    if (!this.poolerManager) return;

    const createTablesSQL = `
      -- Sessions table
      CREATE TABLE IF NOT EXISTS nubi_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        user_id UUID,
        room_id UUID,
        session_type VARCHAR(50) DEFAULT 'conversation',
        status VARCHAR(20) DEFAULT 'active',
        config JSONB NOT NULL,
        state JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT valid_status CHECK (status IN ('active', 'idle', 'expiring', 'expired'))
      );

      -- Raid sessions extension
      CREATE TABLE IF NOT EXISTS raid_sessions (
        session_id UUID PRIMARY KEY REFERENCES nubi_sessions(id) ON DELETE CASCADE,
        raid_id VARCHAR(255) NOT NULL UNIQUE,
        target_url TEXT NOT NULL,
        objectives JSONB NOT NULL,
        max_participants INTEGER DEFAULT 500,
        duration INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Raid participants
      CREATE TABLE IF NOT EXISTS raid_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES nubi_sessions(id) ON DELETE CASCADE,
        raid_id VARCHAR(255) NOT NULL,
        telegram_id VARCHAR(255) NOT NULL,
        telegram_username VARCHAR(255) NOT NULL,
        twitter_username VARCHAR(255),
        actions_completed INTEGER DEFAULT 0,
        points_earned INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(raid_id, telegram_id)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON nubi_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON nubi_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON nubi_sessions(room_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON nubi_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON nubi_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_raid_sessions_raid_id ON raid_sessions(raid_id);
      CREATE INDEX IF NOT EXISTS idx_raid_participants_raid_id ON raid_participants(raid_id);
    `;

    try {
      await this.poolerManager.query(createTablesSQL, [], {
        poolType: PoolType.SESSION,
      });
      logger.info("[NUBI_SESSIONS] Database tables initialized successfully");
    } catch (error) {
      logger.error("[NUBI_SESSIONS] Failed to initialize tables:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Create a new session
   */
  async createSession(config: SessionConfig): Promise<Session> {
    if (!this.isRunning) {
      throw new Error("Sessions service is not running");
    }

    const sessionId = crypto.randomUUID() as UUID;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (config.timeout || 3600000)); // 1 hour default

    const session: Session = {
      id: sessionId,
      agentId: config.agentId,
      userId: config.userId,
      roomId: config.roomId || (crypto.randomUUID() as UUID),
      state: {
        status: "active",
        context: {},
        messages: 0,
        lastInteraction: now,
      },
      config,
      createdAt: now,
      lastActivity: now,
      expiresAt,
      metadata: config.metadata || {},
    };

    // Store in database
    if (this.poolerManager) {
      const insertSQL = `
        INSERT INTO nubi_sessions 
        (id, agent_id, user_id, room_id, session_type, status, config, state, metadata, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await this.poolerManager.query(
        insertSQL,
        [
          session.id,
          session.agentId,
          session.userId,
          session.roomId,
          config.sessionType || "conversation",
          session.state.status,
          JSON.stringify(session.config),
          JSON.stringify(session.state),
          JSON.stringify(session.metadata),
          session.expiresAt,
        ],
        { poolType: PoolType.TRANSACTION },
      );
    }

    // Store in memory
    this.sessions.set(sessionId, session);

    // Set expiration timer
    this.setSessionTimer(sessionId, expiresAt);

    // Store in ElizaOS memory for context
    if (this.memoryService) {
      const sessionMemory: Memory = {
        id: crypto.randomUUID() as UUID,
        agentId: session.agentId,
        entityId: session.userId || session.agentId,
        roomId: session.roomId || (crypto.randomUUID() as UUID),
        content: {
          text: `Session created: ${session.id}`,
          type: "session_created",
          sessionId: session.id,
          sessionType: config.sessionType || "conversation",
          metadata: session.metadata,
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(sessionMemory, "memories", false);
    }

    logger.info(`[NUBI_SESSIONS] Created session: ${sessionId}`);
    return session;
  }

  /**
   * Create a raid session
   */
  async createRaidSession(config: RaidSessionConfig): Promise<RaidSession> {
    const session = (await this.createSession({
      ...config,
      sessionType: "raid",
    })) as RaidSession;

    // Add raid-specific properties
    session.raidId = config.raidId;
    session.targetUrl = config.targetUrl;
    session.objectives = config.objectives;
    session.participants = [];
    session.progress = {
      status: "active",
      participantCount: 0,
      totalActions: 0,
      completionRate: 0,
      timeRemaining: config.duration,
    };

    // Store raid-specific data
    if (this.poolerManager) {
      const insertRaidSQL = `
        INSERT INTO raid_sessions 
        (session_id, raid_id, target_url, objectives, max_participants, duration)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      await this.poolerManager.query(
        insertRaidSQL,
        [
          session.id,
          config.raidId,
          config.targetUrl,
          JSON.stringify(config.objectives),
          config.maxParticipants,
          config.duration,
        ],
        { poolType: PoolType.TRANSACTION },
      );
    }

    // Update memory cache
    this.sessions.set(session.id, session);

    logger.info(
      `[NUBI_SESSIONS] Created raid session: ${session.id} for raid: ${config.raidId}`,
    );
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Check memory cache first
    const cachedSession = this.sessions.get(sessionId);
    if (cachedSession) {
      return cachedSession;
    }

    // Query database
    if (this.poolerManager) {
      const selectSQL = `
        SELECT s.*, rs.raid_id, rs.target_url, rs.objectives, rs.max_participants, rs.duration
        FROM nubi_sessions s
        LEFT JOIN raid_sessions rs ON s.id = rs.session_id
        WHERE s.id = $1
      `;

      const result = await this.poolerManager.query(selectSQL, [sessionId], {
        poolType: PoolType.TRANSACTION,
      });

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const session = this.rowToSession(row);
        this.sessions.set(sessionId, session);
        return session;
      }
    }

    return null;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(
    sessionId: string,
    context?: Record<string, any>,
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const now = new Date();
    session.lastActivity = now;
    session.state.lastInteraction = now;
    session.state.messages += 1;

    if (context) {
      session.state.context = { ...session.state.context, ...context };
    }

    // Update database
    if (this.poolerManager) {
      const updateSQL = `
        UPDATE nubi_sessions 
        SET last_activity = $1, state = $2
        WHERE id = $3
      `;

      await this.poolerManager.query(
        updateSQL,
        [now, JSON.stringify(session.state), sessionId],
        { poolType: PoolType.TRANSACTION },
      );
    }

    // Update memory cache
    this.sessions.set(sessionId, session);

    return true;
  }

  /**
   * Add participant to raid session
   */
  async joinRaidSession(
    sessionId: string,
    participant: Omit<
      RaidParticipant,
      "joinedAt" | "actionsCompleted" | "pointsEarned" | "verified"
    >,
  ): Promise<boolean> {
    const session = (await this.getSession(sessionId)) as RaidSession;
    if (!session || !session.raidId) return false;

    const raidParticipant: RaidParticipant = {
      ...participant,
      joinedAt: new Date(),
      actionsCompleted: 0,
      pointsEarned: 0,
      verified: false,
    };

    // Store in database
    if (this.poolerManager) {
      const insertSQL = `
        INSERT INTO raid_participants 
        (session_id, raid_id, telegram_id, telegram_username, twitter_username)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (raid_id, telegram_id) DO NOTHING
      `;

      await this.poolerManager.query(
        insertSQL,
        [
          sessionId,
          session.raidId,
          participant.telegramId,
          participant.telegramUsername,
          participant.twitterUsername,
        ],
        { poolType: PoolType.TRANSACTION },
      );
    }

    // Store in ElizaOS memory for raid context
    if (this.memoryService) {
      await this.memoryService.storeRaidParticipant(
        session.roomId || "default-room",
        session.raidId,
        {
          telegramId: raidParticipant.telegramId,
          telegramUsername: raidParticipant.telegramUsername,
          twitterUsername: raidParticipant.twitterUsername,
          actionsCompleted: 0,
          pointsEarned: 0,
          verified: false,
        },
      );
    }

    // Update session cache
    if (!session.participants) session.participants = [];
    session.participants.push(raidParticipant);
    session.progress.participantCount = session.participants.length;
    this.sessions.set(sessionId, session);

    logger.info(
      `[NUBI_SESSIONS] Participant ${participant.telegramUsername} joined raid session: ${sessionId}`,
    );
    return true;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    total: number;
    active: number;
    raids: number;
    community: number;
  }> {
    let stats = {
      total: this.sessions.size,
      active: 0,
      raids: 0,
      community: 0,
    };

    for (const session of this.sessions.values()) {
      if (session.state.status === "active") stats.active++;
      if (session.config.sessionType === "raid") stats.raids++;
      if (session.config.sessionType === "community") stats.community++;
    }

    return stats;
  }

  private rowToSession(row: any): Session {
    const baseSession: Session = {
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      roomId: row.room_id,
      state: JSON.parse(row.state),
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      expiresAt: new Date(row.expires_at),
      metadata: JSON.parse(row.metadata || "{}"),
    };

    // If it's a raid session, add raid properties
    if (row.raid_id) {
      const raidSession = baseSession as RaidSession;
      raidSession.raidId = row.raid_id;
      raidSession.targetUrl = row.target_url;
      raidSession.objectives = JSON.parse(row.objectives);
      raidSession.participants = [];
      raidSession.progress = {
        status: "active",
        participantCount: 0,
        totalActions: 0,
        completionRate: 0,
        timeRemaining: row.duration,
      };
      return raidSession;
    }

    return baseSession;
  }

  private setSessionTimer(sessionId: string, expiresAt: Date): void {
    const timeout = expiresAt.getTime() - Date.now();
    if (timeout > 0) {
      const timer = setTimeout(() => {
        this.expireSession(sessionId);
      }, timeout);

      this.sessionTimers.set(sessionId, timer);
    }
  }

  private async expireSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state.status = "expired";

    // Update database
    if (this.poolerManager) {
      const updateSQL = `UPDATE nubi_sessions SET status = 'expired' WHERE id = $1`;
      await this.poolerManager.query(updateSQL, [sessionId], {
        poolType: PoolType.TRANSACTION,
      });
    }

    // Clean up
    this.sessions.delete(sessionId);
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }

    logger.info(`[NUBI_SESSIONS] Session expired: ${sessionId}`);
  }

  private async loadExistingSessions(): Promise<void> {
    if (!this.poolerManager) return;

    const selectSQL = `
      SELECT s.*, rs.raid_id, rs.target_url, rs.objectives, rs.max_participants, rs.duration
      FROM nubi_sessions s
      LEFT JOIN raid_sessions rs ON s.id = rs.session_id
      WHERE s.status IN ('active', 'idle') AND s.expires_at > NOW()
    `;

    const result = await this.poolerManager.query(selectSQL, [], {
      poolType: PoolType.SESSION,
    });

    for (const row of result.rows) {
      const session = this.rowToSession(row);
      this.sessions.set(session.id, session);
      this.setSessionTimer(session.id, session.expiresAt);
    }

    logger.info(
      `[NUBI_SESSIONS] Loaded ${result.rows.length} existing sessions`,
    );
  }

  private startCleanupTimer(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      const expired = [];
      const now = new Date();

      for (const [sessionId, session] of this.sessions) {
        if (session.expiresAt <= now && session.state.status !== "expired") {
          expired.push(sessionId);
        }
      }

      for (const sessionId of expired) {
        await this.expireSession(sessionId);
      }

      if (expired.length > 0) {
        logger.info(
          `[NUBI_SESSIONS] Cleaned up ${expired.length} expired sessions`,
        );
      }
    }, 300000); // 5 minutes
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Clear all timers
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }
    this.sessionTimers.clear();
    this.sessions.clear();

    logger.info("[NUBI_SESSIONS] NUBI Sessions Service stopped");
  }
}

export default NUBISessionsService;
