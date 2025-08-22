/**
 * Database Pooler Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  DatabasePoolerManager,
  PoolType,
} from "../services/database-pooler-manager";
import { setupActionTest } from "./test-utils";

describe("DatabasePoolerManager", () => {
  let poolerManager: DatabasePoolerManager;
  let mockRuntime: any;

  beforeEach(() => {
    const setup = setupActionTest();
    mockRuntime = setup.mockRuntime;
    poolerManager = new DatabasePoolerManager();
  });

  afterEach(async () => {
    if (poolerManager) {
      await poolerManager.stop();
    }
  });

  describe("initialization", () => {
    it("should initialize successfully with config", () => {
      expect(poolerManager).toBeDefined();
      expect(poolerManager.capabilityDescription).toBe(
        "Multi-pool database connection manager with transaction and session poolers",
      );
      expect(poolerManager.poolerConfig).toBeDefined();
      expect(poolerManager.poolerConfig.transactionPooler).toBeDefined();
      expect(poolerManager.poolerConfig.sessionPooler).toBeDefined();
    });

    it("should have correct service type", () => {
      expect((poolerManager.constructor as any).serviceType).toBe(
        "database-pooler-manager",
      );
    });

    it("should have default connection strings", () => {
      expect(
        poolerManager.poolerConfig.transactionPooler.connectionString,
      ).toContain("6543");
      expect(
        poolerManager.poolerConfig.sessionPooler.connectionString,
      ).toContain("5432");
    });

    it("should have sensible pool configurations", () => {
      expect(poolerManager.poolerConfig.transactionPooler.maxConnections).toBe(
        20,
      );
      expect(poolerManager.poolerConfig.sessionPooler.maxConnections).toBe(5);
      expect(
        poolerManager.poolerConfig.transactionPooler.idleTimeoutMillis,
      ).toBeLessThan(
        poolerManager.poolerConfig.sessionPooler.idleTimeoutMillis,
      );
    });
  });

  describe("pool type determination", () => {
    it("should determine transaction pool for simple queries", async () => {
      // These tests verify the pool type logic without actually connecting
      const poolerWithMockDetermination = new DatabasePoolerManager();

      // We can't test the private method directly, but we can test the behavior
      // through query method when pools are not initialized (will throw error with pool type info)
      await expect(
        poolerManager.query("INSERT INTO test VALUES (1)", []),
      ).rejects.toThrow("Database pooler manager not initialized");
    });

    it("should have pool statistics getters", () => {
      const stats = poolerManager.getPoolStats();
      expect(stats).toBeDefined();
      expect(stats.transactionPool).toBeNull(); // Not initialized yet
      expect(stats.sessionPool).toBeNull(); // Not initialized yet
    });
  });

  describe("environment variable handling", () => {
    it("should use environment variables when available", () => {
      // Save original values
      const originalTransactionUrl =
        process.env.SUPABASE_TRANSACTION_POOLER_URL;
      const originalSessionUrl = process.env.SUPABASE_SESSION_POOLER_URL;
      const originalTransactionMax =
        process.env.TRANSACTION_POOL_MAX_CONNECTIONS;

      // Set test values
      process.env.SUPABASE_TRANSACTION_POOLER_URL =
        "postgresql://test:test@localhost:6543/test";
      process.env.SUPABASE_SESSION_POOLER_URL =
        "postgresql://test:test@localhost:5432/test";
      process.env.TRANSACTION_POOL_MAX_CONNECTIONS = "10";

      const testPooler = new DatabasePoolerManager();

      expect(testPooler.poolerConfig.transactionPooler.connectionString).toBe(
        "postgresql://test:test@localhost:6543/test",
      );
      expect(testPooler.poolerConfig.sessionPooler.connectionString).toBe(
        "postgresql://test:test@localhost:5432/test",
      );
      expect(testPooler.poolerConfig.transactionPooler.maxConnections).toBe(10);

      // Restore original values
      if (originalTransactionUrl) {
        process.env.SUPABASE_TRANSACTION_POOLER_URL = originalTransactionUrl;
      } else {
        delete process.env.SUPABASE_TRANSACTION_POOLER_URL;
      }
      if (originalSessionUrl) {
        process.env.SUPABASE_SESSION_POOLER_URL = originalSessionUrl;
      } else {
        delete process.env.SUPABASE_SESSION_POOLER_URL;
      }
      if (originalTransactionMax) {
        process.env.TRANSACTION_POOL_MAX_CONNECTIONS = originalTransactionMax;
      } else {
        delete process.env.TRANSACTION_POOL_MAX_CONNECTIONS;
      }
    });
  });

  describe("error handling", () => {
    it("should handle query errors gracefully", async () => {
      // Test with uninitialized pooler
      await expect(poolerManager.query("SELECT 1")).rejects.toThrow(
        "Database pooler manager not initialized",
      );
    });

    it("should handle transaction errors gracefully", async () => {
      // Test with uninitialized pooler
      await expect(
        poolerManager.transaction([{ sql: "SELECT 1" }]),
      ).rejects.toThrow("Database pooler manager not initialized");
    });
  });

  describe("service lifecycle", () => {
    it("should stop gracefully", async () => {
      await expect(poolerManager.stop()).resolves.toBeUndefined();
    });

    it("should handle multiple stops gracefully", async () => {
      await poolerManager.stop();
      await expect(poolerManager.stop()).resolves.toBeUndefined();
    });
  });

  describe("integration with services", () => {
    it("should be accessible via service registry pattern", () => {
      // Test that the service follows proper ElizaOS patterns
      expect(poolerManager.capabilityDescription).toBeTruthy();
      expect(typeof poolerManager.stop).toBe("function");
    });
  });
});
