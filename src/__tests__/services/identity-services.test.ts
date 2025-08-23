import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { logger, UUID } from "@elizaos/core";
import { CrossPlatformIdentityService } from "../../services/cross-platform-identity-service";
import { MockRuntime } from "../test-utils";

/**
 * Cross-Platform Identity Service Tests
 *
 * Following ElizaOS testing guidelines from:
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 *
 * Tests cover:
 * - Identity linking across platforms
 * - User profile management
 * - Platform verification
 * - Identity resolution
 * - Security and privacy
 */

describe("CrossPlatformIdentityService", () => {
  let identityService: CrossPlatformIdentityService;
  let runtime: MockRuntime;

  beforeEach(async () => {
    runtime = new MockRuntime();
    identityService = new CrossPlatformIdentityService();
    await identityService.start(runtime);
  });

  afterEach(async () => {
    await identityService.stop();
    mock.restore();
  });

  describe("Identity Creation", () => {
    it("should create a new user identity", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "123456789",
        username: "testuser",
        metadata: {
          firstName: "Test",
          lastName: "User",
        },
      });

      expect(identity).toBeDefined();
      expect(identity.id).toBeDefined();
      expect(identity.platforms.telegram).toBe("123456789");
      expect(identity.usernames.telegram).toBe("testuser");
      logger.info(`[TEST] Created identity: ${identity.id}`);
    });

    it("should prevent duplicate identities on same platform", async () => {
      await identityService.createIdentity({
        platform: "telegram",
        platformId: "123456789",
        username: "testuser",
      });

      try {
        await identityService.createIdentity({
          platform: "telegram",
          platformId: "123456789",
          username: "testuser2",
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("already exists");
      }
    });

    it("should generate unique identity IDs", async () => {
      const ids = new Set();

      for (let i = 0; i < 10; i++) {
        const identity = await identityService.createIdentity({
          platform: "telegram",
          platformId: `user${i}`,
          username: `user${i}`,
        });
        ids.add(identity.id);
      }

      expect(ids.size).toBe(10);
    });
  });

  describe("Platform Linking", () => {
    it("should link multiple platforms to same identity", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      await identityService.linkPlatform(identity.id, {
        platform: "discord",
        platformId: "dc456",
        username: "testuser#1234",
      });

      await identityService.linkPlatform(identity.id, {
        platform: "twitter",
        platformId: "tw789",
        username: "testuser_tw",
      });

      const updated = await identityService.getIdentity(identity.id);

      expect(updated.platforms.telegram).toBe("tg123");
      expect(updated.platforms.discord).toBe("dc456");
      expect(updated.platforms.twitter).toBe("tw789");
      expect(updated.usernames.telegram).toBe("testuser");
      expect(updated.usernames.discord).toBe("testuser#1234");
      expect(updated.usernames.twitter).toBe("testuser_tw");
      logger.debug(`[TEST] Linked 3 platforms to identity ${identity.id}`);
    });

    it("should prevent linking same platform twice", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      try {
        await identityService.linkPlatform(identity.id, {
          platform: "telegram",
          platformId: "tg456",
          username: "testuser2",
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("already linked");
      }
    });

    it("should unlink platforms from identity", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      await identityService.linkPlatform(identity.id, {
        platform: "discord",
        platformId: "dc456",
        username: "testuser#1234",
      });

      await identityService.unlinkPlatform(identity.id, "discord");

      const updated = await identityService.getIdentity(identity.id);
      expect(updated.platforms.discord).toBeUndefined();
      expect(updated.usernames.discord).toBeUndefined();
      expect(updated.platforms.telegram).toBe("tg123"); // Should remain
    });
  });

  describe("Identity Resolution", () => {
    it("should resolve identity by platform ID", async () => {
      const created = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      const resolved = await identityService.resolveIdentity(
        "telegram",
        "tg123",
      );

      expect(resolved).toBeDefined();
      expect(resolved.id).toBe(created.id);
      expect(resolved.platforms.telegram).toBe("tg123");
    });

    it("should resolve identity by username", async () => {
      const created = await identityService.createIdentity({
        platform: "twitter",
        platformId: "tw123",
        username: "uniqueuser",
      });

      const resolved = await identityService.resolveByUsername(
        "twitter",
        "uniqueuser",
      );

      expect(resolved).toBeDefined();
      expect(resolved.id).toBe(created.id);
      expect(resolved.usernames.twitter).toBe("uniqueuser");
    });

    it("should return null for non-existent identity", async () => {
      const resolved = await identityService.resolveIdentity(
        "telegram",
        "nonexistent",
      );
      expect(resolved).toBeNull();
    });

    it("should handle cross-platform resolution", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      await identityService.linkPlatform(identity.id, {
        platform: "discord",
        platformId: "dc456",
        username: "testuser#1234",
      });

      // Resolve by Telegram, get Discord info
      const resolved = await identityService.resolveIdentity(
        "telegram",
        "tg123",
      );
      expect(resolved.platforms.discord).toBe("dc456");

      // Resolve by Discord, get Telegram info
      const resolved2 = await identityService.resolveIdentity(
        "discord",
        "dc456",
      );
      expect(resolved2.platforms.telegram).toBe("tg123");
    });
  });

  describe("Profile Management", () => {
    it("should update user profile", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      await identityService.updateProfile(identity.id, {
        displayName: "Test User",
        bio: "Test bio",
        avatar: "https://example.com/avatar.jpg",
        metadata: {
          location: "San Francisco",
          website: "https://example.com",
        },
      });

      const updated = await identityService.getIdentity(identity.id);

      expect(updated.profile.displayName).toBe("Test User");
      expect(updated.profile.bio).toBe("Test bio");
      expect(updated.profile.avatar).toBe("https://example.com/avatar.jpg");
      expect(updated.profile.metadata.location).toBe("San Francisco");
    });

    it("should track profile verification status", async () => {
      const identity = await identityService.createIdentity({
        platform: "twitter",
        platformId: "tw123",
        username: "verified_user",
      });

      await identityService.verifyPlatform(identity.id, "twitter", {
        method: "oauth",
        timestamp: new Date(),
        proof: "oauth_token_hash",
      });

      const updated = await identityService.getIdentity(identity.id);

      expect(updated.verifications.twitter).toBeDefined();
      expect(updated.verifications.twitter.verified).toBe(true);
      expect(updated.verifications.twitter.method).toBe("oauth");
      logger.info(`[TEST] Verified Twitter for identity ${identity.id}`);
    });

    it("should maintain activity timestamps", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      const created = identity.createdAt;

      // Simulate activity
      await new Promise((resolve) => setTimeout(resolve, 10));
      await identityService.recordActivity(identity.id, "telegram");

      const updated = await identityService.getIdentity(identity.id);

      expect(updated.lastActive).toBeGreaterThan(created);
      expect(updated.platformActivity.telegram).toBeGreaterThan(created);
    });
  });

  describe("Security and Privacy", () => {
    it("should hash sensitive data", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
        metadata: {
          email: "test@example.com",
          phone: "+1234567890",
        },
      });

      // Sensitive data should be hashed or encrypted
      const stored = await identityService.getIdentity(identity.id);

      expect(stored.metadata.email).not.toBe("test@example.com");
      expect(stored.metadata.phone).not.toBe("+1234567890");
      expect(stored.metadata.emailHash).toBeDefined();
      expect(stored.metadata.phoneHash).toBeDefined();
    });

    it("should require authorization for cross-platform linking", async () => {
      const identity1 = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "user1",
      });

      const identity2 = await identityService.createIdentity({
        platform: "discord",
        platformId: "dc456",
        username: "user2",
      });

      // Should not allow linking without verification
      try {
        await identityService.mergePlatforms(identity1.id, identity2.id, {
          authorized: false,
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("authorization");
      }
    });

    it("should anonymize data on request", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
        metadata: {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        },
      });

      await identityService.anonymizeIdentity(identity.id);

      const anonymized = await identityService.getIdentity(identity.id);

      expect(anonymized.anonymized).toBe(true);
      expect(anonymized.metadata.firstName).toBeUndefined();
      expect(anonymized.metadata.lastName).toBeUndefined();
      expect(anonymized.metadata.email).toBeUndefined();
      expect(anonymized.platforms.telegram).toBeDefined(); // Platform IDs remain for continuity
      logger.info(`[TEST] Anonymized identity ${identity.id}`);
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk identity creation", async () => {
      const identities = [];

      for (let i = 0; i < 100; i++) {
        identities.push({
          platform: "telegram" as const,
          platformId: `tg${i}`,
          username: `user${i}`,
        });
      }

      const startTime = Date.now();
      const created = await identityService.bulkCreate(identities);
      const duration = Date.now() - startTime;

      expect(created).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      logger.info(`[TEST] Created 100 identities in ${duration}ms`);
    });

    it("should search identities efficiently", async () => {
      // Create test data
      for (let i = 0; i < 20; i++) {
        await identityService.createIdentity({
          platform: "telegram",
          platformId: `tg${i}`,
          username: `testuser${i}`,
          metadata: {
            group: i < 10 ? "groupA" : "groupB",
          },
        });
      }

      const results = await identityService.searchIdentities({
        metadata: { group: "groupA" },
      });

      expect(results).toHaveLength(10);
      results.forEach((identity) => {
        expect(identity.metadata.group).toBe("groupA");
      });
    });

    it("should export and import identities", async () => {
      // Create test identities
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const identity = await identityService.createIdentity({
          platform: "telegram",
          platformId: `tg${i}`,
          username: `user${i}`,
        });
        ids.push(identity.id);
      }

      // Export
      const exported = await identityService.exportIdentities(ids);
      expect(exported).toHaveLength(5);

      // Clear and import
      await identityService.clearAll(); // Hypothetical method
      const imported = await identityService.importIdentities(exported);

      expect(imported).toHaveLength(5);
      for (const id of ids) {
        const identity = await identityService.getIdentity(id);
        expect(identity).toBeDefined();
      }
    });
  });

  describe("Integration with ElizaOS", () => {
    it("should integrate with ElizaOS user system", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      // Create ElizaOS user reference
      const elizaUserId = crypto.randomUUID() as UUID;
      await identityService.linkElizaUser(identity.id, elizaUserId);

      const updated = await identityService.getIdentity(identity.id);
      expect(updated.elizaUserId).toBe(elizaUserId);

      // Resolve by ElizaOS user ID
      const resolved = await identityService.resolveByElizaUser(elizaUserId);
      expect(resolved).toBeDefined();
      expect(resolved.id).toBe(identity.id);
    });

    it("should sync with ElizaOS memory system", async () => {
      const identity = await identityService.createIdentity({
        platform: "telegram",
        platformId: "tg123",
        username: "testuser",
      });

      // Mock memory creation
      runtime.createMemory = mock(() => Promise.resolve());

      await identityService.syncToMemory(identity.id);

      expect(runtime.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            type: "user_identity",
            identityId: identity.id,
          }),
        }),
        "identities",
        false,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database failure
      identityService.db = {
        query: mock(() =>
          Promise.reject(new Error("Database connection failed")),
        ),
      } as any;

      try {
        await identityService.createIdentity({
          platform: "telegram",
          platformId: "tg123",
          username: "testuser",
        });
      } catch (error) {
        expect(error.message).toContain("Database");
      }
    });

    it("should validate input data", async () => {
      const invalidInputs = [
        { platform: "", platformId: "123", username: "test" },
        { platform: "telegram", platformId: "", username: "test" },
        { platform: "telegram", platformId: "123", username: "" },
        {
          platform: "invalid_platform" as any,
          platformId: "123",
          username: "test",
        },
      ];

      for (const input of invalidInputs) {
        try {
          await identityService.createIdentity(input);
          expect(false).toBe(true); // Should not reach here
        } catch (error) {
          expect(error.message).toContain("Invalid");
        }
      }
    });

    it("should handle concurrent operations safely", async () => {
      const platformId = "tg123";

      // Try to create same identity concurrently
      const promises = Array(10)
        .fill(null)
        .map(() =>
          identityService
            .createIdentity({
              platform: "telegram",
              platformId,
              username: "testuser",
            })
            .catch((e) => e),
        );

      const results = await Promise.all(promises);

      // Only one should succeed
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof Error);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(9);
      logger.debug(
        `[TEST] Concurrent creation: 1 success, 9 failures (expected)`,
      );
    });
  });
});
