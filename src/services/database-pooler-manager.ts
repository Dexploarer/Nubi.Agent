import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { Pool } from "pg";
import { loadEnvironmentConfig } from "../config/environment";

/**
 * Database Pooler Manager Service
 *
 * Manages multiple database connection pools:
 * - Transaction Pooler: For high-frequency, short transactions (port 6543)
 * - Session Pooler: For long-running connections and complex queries (port 5432)
 *
 * Automatically routes queries to the appropriate pool based on operation type.
 */

export interface DatabasePoolerConfig {
  transactionPooler: {
    connectionString: string;
    maxConnections: number;
    idleTimeoutMillis: number;
  };
  sessionPooler: {
    connectionString: string;
    maxConnections: number;
    idleTimeoutMillis: number;
  };
}

export enum PoolType {
  TRANSACTION = "transaction",
  SESSION = "session",
}

export interface QueryOptions {
  poolType?: PoolType;
  timeout?: number;
  retries?: number;
}

export class DatabasePoolerManager extends Service {
  static serviceType = "database-pooler-manager";

  private transactionPool?: Pool;
  private sessionPool?: Pool;
  public poolerConfig: DatabasePoolerConfig;
  private isInitialized = false;

  get capabilityDescription(): string {
    return "Multi-pool database connection manager with transaction and session poolers";
  }

  constructor() {
    super();

    this.poolerConfig = {
      transactionPooler: {
        connectionString:
          process.env.SUPABASE_TRANSACTION_POOLER_URL ||
          "postgresql://postgres.nfnmoqepgjyutcbbaqjg:[Anubisdata1!]@aws-1-us-east-2.pooler.supabase.com:6543/postgres",
        maxConnections: parseInt(
          process.env.TRANSACTION_POOL_MAX_CONNECTIONS || "20",
        ),
        idleTimeoutMillis: parseInt(
          process.env.TRANSACTION_POOL_IDLE_TIMEOUT || "10000",
        ),
      },
      sessionPooler: {
        connectionString:
          process.env.SUPABASE_SESSION_POOLER_URL ||
          "postgresql://postgres.nfnmoqepgjyutcbbaqjg:[Anubisdata1!]@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
        maxConnections: parseInt(
          process.env.SESSION_POOL_MAX_CONNECTIONS || "5",
        ),
        idleTimeoutMillis: parseInt(
          process.env.SESSION_POOL_IDLE_TIMEOUT || "30000",
        ),
      },
    };
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    if (this.isInitialized) {
      logger.warn("[DATABASE_POOLER] Already initialized, skipping");
      return;
    }

    try {
      logger.info(
        "[DATABASE_POOLER] Initializing database connection pools...",
      );

      // Initialize Transaction Pool (for fast, short queries)
      this.transactionPool = new Pool({
        connectionString: this.poolerConfig.transactionPooler.connectionString,
        max: this.poolerConfig.transactionPooler.maxConnections,
        idleTimeoutMillis:
          this.poolerConfig.transactionPooler.idleTimeoutMillis,
        connectionTimeoutMillis: 5000,
        ssl: { rejectUnauthorized: false },
        application_name: "nubi-agent-transaction-pool",
      });

      // Initialize Session Pool (for complex, long-running queries)
      this.sessionPool = new Pool({
        connectionString: this.poolerConfig.sessionPooler.connectionString,
        max: this.poolerConfig.sessionPooler.maxConnections,
        idleTimeoutMillis: this.poolerConfig.sessionPooler.idleTimeoutMillis,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
        application_name: "nubi-agent-session-pool",
      });

      // Test connections
      await this.testConnections();

      // Setup error handlers
      this.setupErrorHandlers();

      this.isInitialized = true;
      logger.info(
        "[DATABASE_POOLER] Database pooler manager initialized successfully",
      );
    } catch (error) {
      logger.error(
        "[DATABASE_POOLER] Failed to initialize:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async testConnections(): Promise<void> {
    const testQuery =
      "SELECT NOW() as current_time, version() as postgres_version";

    try {
      // Test transaction pool
      const transactionResult = await this.transactionPool!.query(testQuery);
      logger.info(
        `[DATABASE_POOLER] Transaction pool connected - PostgreSQL ${transactionResult.rows[0].postgres_version.split(" ")[1]}`,
      );

      // Test session pool
      const sessionResult = await this.sessionPool!.query(testQuery);
      logger.info(
        `[DATABASE_POOLER] Session pool connected - PostgreSQL ${sessionResult.rows[0].postgres_version.split(" ")[1]}`,
      );
    } catch (error) {
      throw new Error(
        `Database connection test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private setupErrorHandlers(): void {
    if (this.transactionPool) {
      this.transactionPool.on("error", (err) => {
        logger.error("[DATABASE_POOLER] Transaction pool error:", err.message);
      });

      this.transactionPool.on("connect", () => {
        logger.debug("[DATABASE_POOLER] New transaction pool client connected");
      });
    }

    if (this.sessionPool) {
      this.sessionPool.on("error", (err) => {
        logger.error("[DATABASE_POOLER] Session pool error:", err.message);
      });

      this.sessionPool.on("connect", () => {
        logger.debug("[DATABASE_POOLER] New session pool client connected");
      });
    }
  }

  /**
   * Execute a query using the appropriate pool
   */
  async query<T = any>(
    sql: string,
    params?: any[],
    options: QueryOptions = {},
  ): Promise<{ rows: T[]; rowCount: number }> {
    if (!this.isInitialized) {
      throw new Error("Database pooler manager not initialized");
    }

    const poolType = options.poolType || this.determinePoolType(sql);
    const pool = this.getPool(poolType);

    if (!pool) {
      throw new Error(`Pool ${poolType} is not available`);
    }

    const startTime = Date.now();
    let retries = options.retries || 0;

    while (retries >= 0) {
      try {
        const result = await pool.query(sql, params);
        const duration = Date.now() - startTime;

        logger.debug(
          `[DATABASE_POOLER] Query executed via ${poolType} pool in ${duration}ms`,
        );

        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
        };
      } catch (error) {
        if (retries > 0 && this.isRetryableError(error)) {
          retries--;
          logger.warn(
            `[DATABASE_POOLER] Query failed, retrying (${retries} attempts remaining):`,
            error instanceof Error ? error.message : String(error),
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        logger.error(
          `[DATABASE_POOLER] Query failed on ${poolType} pool:`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }

    throw new Error("Query failed after all retry attempts");
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    queries: Array<{ sql: string; params?: any[] }>,
    options: QueryOptions = {},
  ): Promise<T[]> {
    if (!this.isInitialized) {
      throw new Error("Database pooler manager not initialized");
    }

    // Transactions should always use the transaction pool
    const pool = this.transactionPool!;
    const client = await pool.connect();
    const results: T[] = [];

    try {
      await client.query("BEGIN");

      for (const { sql, params } of queries) {
        const result = await client.query(sql, params);
        results.push(result.rows as T);
      }

      await client.query("COMMIT");
      logger.debug(
        `[DATABASE_POOLER] Transaction completed with ${queries.length} queries`,
      );

      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(
        "[DATABASE_POOLER] Transaction rolled back:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      transactionPool: this.transactionPool
        ? {
            totalCount: this.transactionPool.totalCount,
            idleCount: this.transactionPool.idleCount,
            waitingCount: this.transactionPool.waitingCount,
          }
        : null,
      sessionPool: this.sessionPool
        ? {
            totalCount: this.sessionPool.totalCount,
            idleCount: this.sessionPool.idleCount,
            waitingCount: this.sessionPool.waitingCount,
          }
        : null,
    };
  }

  private getPool(type: PoolType): Pool | undefined {
    switch (type) {
      case PoolType.TRANSACTION:
        return this.transactionPool;
      case PoolType.SESSION:
        return this.sessionPool;
      default:
        return this.transactionPool; // Default to transaction pool
    }
  }

  private determinePoolType(sql: string): PoolType {
    const sqlUpper = sql.toUpperCase().trim();

    // Use session pool for complex queries
    if (
      sqlUpper.includes("JOIN") ||
      sqlUpper.includes("UNION") ||
      sqlUpper.includes("SUBQUERY") ||
      sqlUpper.includes("WITH") ||
      sqlUpper.includes("RECURSIVE") ||
      sqlUpper.includes("WINDOW") ||
      sqlUpper.includes("GROUP BY") ||
      sqlUpper.includes("ORDER BY") ||
      sqlUpper.includes("HAVING") ||
      (sqlUpper.includes("LIMIT") && sqlUpper.includes("OFFSET")) ||
      sqlUpper.includes("VECTOR") ||
      sqlUpper.includes("SIMILARITY") ||
      sqlUpper.includes("EMBEDDING")
    ) {
      return PoolType.SESSION;
    }

    // Use transaction pool for simple CRUD operations
    if (
      sqlUpper.startsWith("INSERT") ||
      sqlUpper.startsWith("UPDATE") ||
      sqlUpper.startsWith("DELETE") ||
      (sqlUpper.startsWith("SELECT") && !sqlUpper.includes("JOIN"))
    ) {
      return PoolType.TRANSACTION;
    }

    // Default to transaction pool
    return PoolType.TRANSACTION;
  }

  private isRetryableError(error: any): boolean {
    if (!error || typeof error.code !== "string") {
      return false;
    }

    // PostgreSQL connection errors that are retryable
    const retryableCodes = [
      "08000", // connection_exception
      "08003", // connection_does_not_exist
      "08006", // connection_failure
      "08001", // sqlclient_unable_to_establish_sqlconnection
      "08004", // sqlserver_rejected_establishment_of_sqlconnection
      "53300", // too_many_connections
      "53200", // out_of_memory
    ];

    return retryableCodes.includes(error.code);
  }

  async stop(): Promise<void> {
    logger.info("[DATABASE_POOLER] Shutting down database pools...");

    const promises = [];

    if (this.transactionPool) {
      promises.push(
        this.transactionPool
          .end()
          .then(() => logger.info("[DATABASE_POOLER] Transaction pool closed")),
      );
    }

    if (this.sessionPool) {
      promises.push(
        this.sessionPool
          .end()
          .then(() => logger.info("[DATABASE_POOLER] Session pool closed")),
      );
    }

    await Promise.all(promises);
    this.isInitialized = false;
    logger.info("[DATABASE_POOLER] Database pooler manager stopped");
  }
}
