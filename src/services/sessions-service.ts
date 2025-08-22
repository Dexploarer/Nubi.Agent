import { Service, IAgentRuntime, Memory, logger, UUID } from "@elizaos/core";
import { Client } from "pg";

/**
 * ElizaOS Sessions API Service with Supabase Backend
 *
 * Implements full Sessions API compliance with:
 * - Persistent, stateful conversations
 * - Automatic timeout and renewal management
 * - Configurable session policies
 * - Message history tracking
 * - Real-time session management
 */

export interface SessionConfig {
  timeoutMinutes?: number;
  autoRenew?: boolean;
  maxDuration?: number;
  metadata?: Record<string, any>;
}

export interface SessionMessage {
  id: UUID;
  sessionId: UUID;
  senderId: UUID;
  senderType: "user" | "agent";
  content: any;
  timestamp: Date;
  sequenceNumber: number;
  metadata?: Record<string, any>;
}

export interface SessionInfo {
  id: UUID;
  agentId: UUID;
  userId?: UUID;
  roomId?: UUID;
  status: "active" | "expired" | "ended";
  timeoutMinutes: number;
  autoRenew: boolean;
  expiresAt: Date;
  lastActivity: Date;
  heartbeatAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

export class SessionsService extends Service {
  static serviceType = "sessions" as const;
  capabilityDescription = "ElizaOS Sessions API with Supabase backend";

  private dbClient: Client | null = null;
  private agentId: UUID;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.agentId = runtime.agentId;
  }

  static async start(runtime: IAgentRuntime): Promise<SessionsService> {
    const service = new SessionsService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    try {
      const databaseUrl =
        process.env.DATABASE_URL ||
        "postgresql://postgres:Anubisdata1!@db.nfnmoqepgjyutcbbaqjg.supabase.co:5432/postgres";

      this.dbClient = new Client({
        connectionString: databaseUrl,
      });

      await this.dbClient.connect();
      logger.info("[SESSIONS_SERVICE] Connected to Supabase PostgreSQL");

      // Verify agent exists
      const agentCheck = await this.dbClient.query(
        "SELECT id, name FROM agents WHERE id = $1 LIMIT 1",
        [this.agentId],
      );

      if (agentCheck.rows.length > 0) {
        logger.info(
          `[SESSIONS_SERVICE] Using agent: ${agentCheck.rows[0].name} (${this.agentId})`,
        );
      } else {
        logger.warn(
          `[SESSIONS_SERVICE] Agent ${this.agentId} not found in database`,
        );
      }
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    userId?: UUID,
    config: SessionConfig = {},
  ): Promise<SessionInfo> {
    try {
      const timeoutMinutes = Math.min(
        Math.max(config.timeoutMinutes || 30, 5),
        1440,
      );
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      // Create associated room if needed
      let roomId: UUID | null = null;
      if (userId) {
        const roomResult = await this.dbClient!.query(
          `INSERT INTO rooms (id, "agentId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, NOW(), NOW())
           RETURNING id`,
          [this.agentId],
        );
        roomId = roomResult.rows[0].id;
      }

      const result = await this.dbClient!.query(
        `INSERT INTO sessions (
           agent_id, user_id, room_id, status, timeout_minutes, 
           auto_renew, expires_at, metadata
         ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
         RETURNING *`,
        [
          this.agentId,
          userId || null,
          roomId,
          timeoutMinutes,
          config.autoRenew !== false,
          expiresAt,
          JSON.stringify(config.metadata || {}),
        ],
      );

      const session = this.formatSessionInfo(result.rows[0]);

      logger.info(
        `[SESSIONS_SERVICE] Created session ${session.id} for agent ${this.agentId}`,
      );
      return session;
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to create session:", error);
      throw error;
    }
  }

  /**
   * Send message to session
   */
  async sendSessionMessage(
    sessionId: UUID,
    senderId: UUID,
    senderType: "user" | "agent",
    content: any,
    metadata?: Record<string, any>,
  ): Promise<SessionMessage> {
    try {
      // Verify session is active
      const sessionResult = await this.dbClient!.query(
        "SELECT * FROM sessions WHERE id = $1 AND status = $2",
        [sessionId, "active"],
      );

      if (sessionResult.rows.length === 0) {
        throw new Error("Session not found or not active");
      }

      const session = sessionResult.rows[0];

      // Check if session expired
      if (new Date(session.expires_at) < new Date()) {
        await this.expireSession(sessionId);
        throw new Error("Session has expired");
      }

      // Get next sequence number
      const seqResult = await this.dbClient!.query(
        "SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq FROM session_messages WHERE session_id = $1",
        [sessionId],
      );
      const sequenceNumber = seqResult.rows[0].next_seq;

      // Insert message
      const messageResult = await this.dbClient!.query(
        `INSERT INTO session_messages (
           session_id, sender_id, sender_type, content, sequence_number, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          sessionId,
          senderId,
          senderType,
          JSON.stringify(content),
          sequenceNumber,
          JSON.stringify(metadata || {}),
        ],
      );

      // Update session activity
      await this.dbClient!.query(
        "UPDATE sessions SET last_activity = NOW(), updated_at = NOW() WHERE id = $1",
        [sessionId],
      );

      const message = this.formatSessionMessage(messageResult.rows[0]);

      logger.debug(
        `[SESSIONS_SERVICE] Added message ${message.id} to session ${sessionId}`,
      );
      return message;
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to send session message:", error);
      throw error;
    }
  }

  /**
   * Get session message history
   */
  async getSessionHistory(
    sessionId: UUID,
    limit: number = 50,
    offset: number = 0,
  ): Promise<SessionMessage[]> {
    try {
      const result = await this.dbClient!.query(
        `SELECT * FROM session_messages 
         WHERE session_id = $1 
         ORDER BY sequence_number ASC
         LIMIT $2 OFFSET $3`,
        [sessionId, limit, offset],
      );

      return result.rows.map((row) => this.formatSessionMessage(row));
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to get session history:", error);
      throw error;
    }
  }

  /**
   * Renew session
   */
  async renewSession(
    sessionId: UUID,
    newTimeoutMinutes?: number,
  ): Promise<SessionInfo> {
    try {
      const result = await this.dbClient!.query(
        "SELECT * FROM renew_session($1, $2)",
        [sessionId, newTimeoutMinutes || null],
      );

      if (result.rows.length === 0) {
        throw new Error("Failed to renew session");
      }

      const session = this.formatSessionInfo(result.rows[0]);
      logger.info(`[SESSIONS_SERVICE] Renewed session ${sessionId}`);
      return session;
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to renew session:", error);
      throw error;
    }
  }

  /**
   * Update session heartbeat
   */
  async updateHeartbeat(sessionId: UUID): Promise<boolean> {
    try {
      const result = await this.dbClient!.query(
        "SELECT update_session_heartbeat($1) as success",
        [sessionId],
      );

      return result.rows[0]?.success || false;
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to update heartbeat:", error);
      return false;
    }
  }

  /**
   * End session
   */
  async endSession(sessionId: UUID): Promise<boolean> {
    try {
      const result = await this.dbClient!.query(
        `UPDATE sessions 
         SET status = 'ended', ended_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'active'`,
        [sessionId],
      );

      const success = (result.rowCount || 0) > 0;
      if (success) {
        logger.info(`[SESSIONS_SERVICE] Ended session ${sessionId}`);
      }
      return success;
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to end session:", error);
      return false;
    }
  }

  /**
   * Get session info
   */
  async getSession(sessionId: UUID): Promise<SessionInfo | null> {
    try {
      const result = await this.dbClient!.query(
        "SELECT * FROM sessions WHERE id = $1",
        [sessionId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatSessionInfo(result.rows[0]);
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to get session:", error);
      return null;
    }
  }

  /**
   * List sessions for agent/user
   */
  async listSessions(
    userId?: UUID,
    status?: "active" | "expired" | "ended",
    limit: number = 20,
    offset: number = 0,
  ): Promise<SessionInfo[]> {
    try {
      let query = "SELECT * FROM sessions WHERE agent_id = $1";
      const params: any[] = [this.agentId];
      let paramIndex = 2;

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query +=
        " ORDER BY created_at DESC LIMIT $" +
        paramIndex +
        " OFFSET $" +
        (paramIndex + 1);
      params.push(limit, offset);

      const result = await this.dbClient!.query(query, params);
      return result.rows.map((row) => this.formatSessionInfo(row));
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to list sessions:", error);
      return [];
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(days: number = 7): Promise<any> {
    try {
      const result = await this.dbClient!.query(
        `SELECT * FROM mv_session_analytics 
         WHERE agent_id = $1 
         AND session_date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY session_date DESC`,
        [this.agentId],
      );

      return {
        dailyStats: result.rows,
        summary: {
          totalSessions: result.rows.reduce(
            (sum, row) => sum + row.total_sessions,
            0,
          ),
          uniqueUsers: new Set(result.rows.map((row) => row.unique_users)).size,
          avgDuration:
            result.rows.reduce(
              (sum, row) => sum + (row.avg_duration_minutes || 0),
              0,
            ) / result.rows.length,
          activeSessions: result.rows.reduce(
            (sum, row) => sum + row.active_sessions,
            0,
          ),
        },
      };
    } catch (error) {
      logger.error("[SESSIONS_SERVICE] Failed to get analytics:", error);
      return { dailyStats: [], summary: {} };
    }
  }

  /**
   * Private helper: Expire session
   */
  private async expireSession(sessionId: UUID): Promise<void> {
    await this.dbClient!.query(
      `UPDATE sessions 
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1`,
      [sessionId],
    );
  }

  /**
   * Private helper: Format session info
   */
  private formatSessionInfo(row: any): SessionInfo {
    return {
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      roomId: row.room_id,
      status: row.status,
      timeoutMinutes: row.timeout_minutes,
      autoRenew: row.auto_renew,
      expiresAt: new Date(row.expires_at),
      lastActivity: new Date(row.last_activity),
      heartbeatAt: row.heartbeat_at ? new Date(row.heartbeat_at) : undefined,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    };
  }

  /**
   * Private helper: Format session message
   */
  private formatSessionMessage(row: any): SessionMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      senderId: row.sender_id,
      senderType: row.sender_type,
      content:
        typeof row.content === "string" ? JSON.parse(row.content) : row.content,
      timestamp: new Date(row.timestamp),
      sequenceNumber: row.sequence_number,
      metadata:
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata || {},
    };
  }

  /**
   * Clean up on service stop
   */
  async stop(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.end();
      logger.info("[SESSIONS_SERVICE] Disconnected from Supabase PostgreSQL");
    }
  }
}

export default SessionsService;
