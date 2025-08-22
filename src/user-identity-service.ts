import { Service, IAgentRuntime, Memory, logger, UUID } from "@elizaos/core";
import { Database } from "sqlite3";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * User Identity Service
 *
 * Manages cross-platform user identity resolution and mapping.
 * Tracks users across Twitter, Telegram, Discord, etc. and links
 * their identities when they're the same person.
 */
export class UserIdentityService extends Service {
  static serviceType = "user-identity";

  private db: Database | null = null;
  private identityCache = new Map<string, UserIdentity>();
  private linkCache = new Map<string, string[]>(); // internal_id -> linked_ids
  private dbPath: string;

  capabilityDescription = `
    Cross-platform user identity management:
    - Extract usernames from platform messages
    - Map platform IDs to internal UUIDs
    - Link identities across platforms
    - Resolve user's preferred name per platform
    - Track user presence across rooms
  `;

  constructor(runtime: IAgentRuntime, dbPath?: string) {
    super(runtime);
    this.dbPath = dbPath || path.join(process.cwd(), "data", "raids.db");
    this.initializeDatabase();
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new UserIdentityService(runtime);
    logger.info("✅ User Identity Service started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("user-identity");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ User Identity Service started");
    // Service is ready - no specific startup tasks needed
  }

  async stop(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db!.close((err) => {
          if (err) {
            logger.error(
              "Error closing database:",
              err instanceof Error ? err.message : String(err),
            );
          }
          resolve();
        });
      });
      this.db = null;
    }
    this.identityCache.clear();
    this.linkCache.clear();
    logger.info("User Identity Service stopped");
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = new Database(this.dbPath, async (err) => {
        if (err) {
          logger.error(
            "Failed to open database for identity service:",
            err instanceof Error ? err.message : String(err),
          );
          this.db = null;
        } else {
          logger.info("User identity database connected");
          // Create tables after connection
          await this.createTables();
        }
      });
    } catch (error) {
      logger.error(
        "Identity database initialization failed:",
        error instanceof Error ? error.message : String(error),
      );
      this.db = null;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    const queries = [
      `CREATE TABLE IF NOT EXISTS user_identities (
        internal_id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        platform_username TEXT,
        display_name TEXT,
        room_id TEXT,
        first_seen INTEGER,
        last_seen INTEGER,
        metadata TEXT,
        UNIQUE(platform, platform_user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS identity_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        primary_identity TEXT,
        linked_identity TEXT,
        confidence REAL DEFAULT 0.0,
        link_reason TEXT,
        created_at INTEGER,
        FOREIGN KEY (primary_identity) REFERENCES user_identities(internal_id),
        FOREIGN KEY (linked_identity) REFERENCES user_identities(internal_id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_identities_platform ON user_identities(platform, platform_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_identities_username ON user_identities(platform_username)`,
      `CREATE INDEX IF NOT EXISTS idx_identity_links_primary ON identity_links(primary_identity)`,
      `CREATE INDEX IF NOT EXISTS idx_identity_links_linked ON identity_links(linked_identity)`,
    ];

    for (const query of queries) {
      await new Promise<void>((resolve, reject) => {
        this.db!.run(query, (err) => {
          if (err) {
            logger.error(
              "Failed to create table:",
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("User identity tables created successfully");
  }

  /**
   * Extract identity from platform-specific message format
   */
  async extractIdentity(message: Memory): Promise<UserIdentity> {
    const platform = this.detectPlatform(message);

    switch (platform) {
      case "twitter":
        return this.extractTwitterIdentity(message);
      case "telegram":
        return this.extractTelegramIdentity(message);
      case "discord":
        return this.extractDiscordIdentity(message);
      default:
        return this.extractGenericIdentity(message);
    }
  }

  /**
   * Resolve or create internal identity for a platform user
   */
  async resolveIdentity(
    platform: Platform,
    platformUserId: string,
    platformUsername?: string,
    displayName?: string,
    roomId?: string,
  ): Promise<UserIdentity> {
    // Check cache first
    const cacheKey = `${platform}:${platformUserId}`;
    if (this.identityCache.has(cacheKey)) {
      return this.identityCache.get(cacheKey)!;
    }

    // Check database
    const existing = await this.getIdentityFromDatabase(
      platform,
      platformUserId,
    );
    if (existing) {
      this.identityCache.set(cacheKey, existing);
      return existing;
    }

    // Create new identity
    const newIdentity: UserIdentity = {
      internalId: uuidv4() as UUID,
      platform,
      platformUserId,
      platformUsername:
        platformUsername || `user_${platformUserId.slice(0, 8)}`,
      displayName: displayName || platformUsername || "Unknown User",
      roomId: roomId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      metadata: {},
    };

    await this.saveIdentity(newIdentity);
    this.identityCache.set(cacheKey, newIdentity);

    logger.info(
      `Created new identity for ${platform}:${platformUsername || platformUserId}`,
    );
    return newIdentity;
  }

  /**
   * Link two identities as the same person
   */
  async linkIdentities(
    identity1: string,
    identity2: string,
    confidence: number,
    reason: string,
  ): Promise<void> {
    if (!this.db) return;

    // Store bidirectional links for easier querying
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
      // Insert both directions of the link
      this.db!.serialize(() => {
        this.db!.run(
          `INSERT OR IGNORE INTO identity_links (primary_identity, linked_identity, confidence, link_reason, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [identity1, identity2, confidence, reason, timestamp],
          (err) => {
            if (err) {
              logger.error(
                "Failed to link identities (1->2):",
                err instanceof Error ? err.message : String(err),
              );
              reject(err);
              return;
            }
          },
        );

        this.db!.run(
          `INSERT OR IGNORE INTO identity_links (primary_identity, linked_identity, confidence, link_reason, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [identity2, identity1, confidence, reason, timestamp],
          (err) => {
            if (err) {
              logger.error(
                "Failed to link identities (2->1):",
                err instanceof Error ? err.message : String(err),
              );
              reject(err);
            } else {
              // Update cache
              const links1 = this.linkCache.get(identity1) || [];
              const links2 = this.linkCache.get(identity2) || [];
              links1.push(identity2);
              links2.push(identity1);
              this.linkCache.set(identity1, [...new Set(links1)]);
              this.linkCache.set(identity2, [...new Set(links2)]);

              logger.info(
                `Linked identities: ${identity1} <-> ${identity2} (${confidence} confidence)`,
              );
              resolve();
            }
          },
        );
      });
    });
  }

  /**
   * Get all linked identities for a user (including transitive links)
   */
  async getLinkedIdentities(internalId: string): Promise<UserIdentity[]> {
    const visited = new Set<string>();
    const toVisit = [internalId];
    const allLinkedIds = new Set<string>();

    // Breadth-first search for all transitively linked identities
    while (toVisit.length > 0) {
      const currentId = toVisit.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Get direct links for current ID
      let directLinks: string[] = [];

      // Check cache first
      if (this.linkCache.has(currentId)) {
        directLinks = this.linkCache.get(currentId) || [];
      } else if (this.db) {
        // Load from database
        const links = await new Promise<any[]>((resolve) => {
          this.db!.all(
            `SELECT linked_identity FROM identity_links WHERE primary_identity = ?`,
            [currentId],
            (err, rows: any[]) => {
              if (err) {
                logger.error(
                  "Failed to get linked identities:",
                  err instanceof Error ? err.message : String(err),
                );
                resolve([]);
              } else {
                resolve(rows);
              }
            },
          );
        });

        directLinks = links.map((row) => row.linked_identity);
        if (directLinks.length > 0) {
          this.linkCache.set(currentId, directLinks);
        }
      }

      // Add direct links to results and queue for visiting
      for (const linkedId of directLinks) {
        if (linkedId !== internalId && !visited.has(linkedId)) {
          allLinkedIds.add(linkedId);
          toVisit.push(linkedId);
        }
      }
    }

    // Fetch full identity objects for all linked IDs
    const identities: UserIdentity[] = [];
    for (const id of allLinkedIds) {
      const identity = await this.getIdentityById(id);
      if (identity) {
        identities.push(identity);
      }
    }

    return identities;
  }

  /**
   * Auto-detect potential identity links
   */
  async detectPotentialLinks(identity: UserIdentity): Promise<PotentialLink[]> {
    const potentialLinks: PotentialLink[] = [];

    // Check for similar usernames across platforms
    if (identity.platformUsername) {
      const similarUsernames = await this.findSimilarUsernames(
        identity.platformUsername,
        identity.platform,
      );

      for (const similar of similarUsernames) {
        const confidence = this.calculateUsernamesSimilarity(
          identity.platformUsername,
          similar.platformUsername || "",
        );

        if (confidence > 0.7) {
          potentialLinks.push({
            identity1: identity.internalId,
            identity2: similar.internalId,
            confidence,
            reason: "similar_username",
          });
        }
      }
    }

    // Check for same display names
    if (identity.displayName) {
      const sameDisplayNames = await this.findByDisplayName(
        identity.displayName,
        identity.platform,
      );

      for (const same of sameDisplayNames) {
        potentialLinks.push({
          identity1: identity.internalId,
          identity2: same.internalId,
          confidence: 0.5,
          reason: "same_display_name",
        });
      }
    }

    return potentialLinks;
  }

  // Platform-specific extractors

  private extractTwitterIdentity(message: Memory): UserIdentity {
    const content = message.content as any;

    return {
      internalId: message.entityId,
      platform: "twitter",
      platformUserId:
        content.author?.id || content.authorId || message.entityId,
      platformUsername:
        content.author?.username || content.screenName || content.username,
      displayName: content.author?.name || content.displayName,
      roomId: message.roomId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      metadata: {
        verified: content.author?.verified,
        followers: content.author?.followersCount,
      },
    };
  }

  private extractTelegramIdentity(message: Memory): UserIdentity {
    const content = message.content as any;

    return {
      internalId: message.entityId,
      platform: "telegram",
      platformUserId:
        content.from?.id?.toString() || content.userId || message.entityId,
      platformUsername: content.from?.username || content.username,
      displayName: content.from
        ? `${content.from.first_name || ""} ${content.from.last_name || ""}`.trim()
        : content.displayName,
      roomId: message.roomId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      metadata: {
        chatId: content.chat?.id,
        chatTitle: content.chat?.title,
      },
    };
  }

  private extractDiscordIdentity(message: Memory): UserIdentity {
    const content = message.content as any;

    return {
      internalId: message.entityId,
      platform: "discord",
      platformUserId: content.author?.id || content.userId || message.entityId,
      platformUsername: content.author?.username || content.username,
      displayName:
        content.member?.nickname ||
        content.author?.username ||
        content.displayName,
      roomId: message.roomId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      metadata: {
        guildId: content.guildId,
        channelId: content.channelId,
        roles: content.member?.roles,
      },
    };
  }

  private extractGenericIdentity(message: Memory): UserIdentity {
    return {
      internalId: message.entityId,
      platform: "unknown",
      platformUserId: message.entityId,
      platformUsername: `user_${message.entityId.slice(0, 8)}`,
      displayName: "Unknown User",
      roomId: message.roomId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      metadata: {},
    };
  }

  // Database operations

  private async saveIdentity(identity: UserIdentity): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO user_identities (
          internal_id, platform, platform_user_id, platform_username,
          display_name, room_id, first_seen, last_seen, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          identity.internalId,
          identity.platform,
          identity.platformUserId,
          identity.platformUsername,
          identity.displayName,
          identity.roomId,
          identity.firstSeen,
          identity.lastSeen,
          JSON.stringify(identity.metadata),
        ],
        (err) => {
          if (err) {
            logger.error(
              "Failed to save identity:",
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  private async getIdentityFromDatabase(
    platform: Platform,
    platformUserId: string,
  ): Promise<UserIdentity | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT * FROM user_identities WHERE platform = ? AND platform_user_id = ?`,
        [platform, platformUserId],
        (err, row: any) => {
          if (err) {
            logger.error(
              "Failed to get identity:",
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else if (row) {
            resolve({
              internalId: row.internal_id,
              platform: row.platform,
              platformUserId: row.platform_user_id,
              platformUsername: row.platform_username,
              displayName: row.display_name,
              roomId: row.room_id,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
              metadata: JSON.parse(row.metadata || "{}"),
            });
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  private async getIdentityById(
    internalId: string,
  ): Promise<UserIdentity | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT * FROM user_identities WHERE internal_id = ?`,
        [internalId],
        (err, row: any) => {
          if (err) {
            logger.error(
              "Failed to get identity by ID:",
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else if (row) {
            resolve({
              internalId: row.internal_id,
              platform: row.platform,
              platformUserId: row.platform_user_id,
              platformUsername: row.platform_username,
              displayName: row.display_name,
              roomId: row.room_id,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
              metadata: JSON.parse(row.metadata || "{}"),
            });
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  private async findSimilarUsernames(
    username: string,
    excludePlatform: Platform,
  ): Promise<UserIdentity[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      // Get all users from other platforms to compare
      this.db!.all(
        `SELECT * FROM user_identities 
         WHERE platform != ? AND platform_username IS NOT NULL`,
        [excludePlatform],
        (err, rows: any[]) => {
          if (err) {
            logger.error(
              "Failed to find similar usernames:",
              err instanceof Error ? err.message : String(err),
            );
            resolve([]);
          } else {
            // Filter by similarity score
            const identities = rows
              .map((row) => ({
                identity: {
                  internalId: row.internal_id,
                  platform: row.platform,
                  platformUserId: row.platform_user_id,
                  platformUsername: row.platform_username,
                  displayName: row.display_name,
                  roomId: row.room_id,
                  firstSeen: row.first_seen,
                  lastSeen: row.last_seen,
                  metadata: JSON.parse(row.metadata || "{}"),
                },
                similarity: this.calculateUsernamesSimilarity(
                  username,
                  row.platform_username || "",
                ),
              }))
              .filter((item) => item.similarity > 0.6) // Only return reasonably similar names
              .map((item) => item.identity);

            resolve(identities);
          }
        },
      );
    });
  }

  private async findByDisplayName(
    displayName: string,
    excludePlatform: Platform,
  ): Promise<UserIdentity[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM user_identities 
         WHERE display_name = ? AND platform != ?`,
        [displayName, excludePlatform],
        (err, rows: any[]) => {
          if (err) {
            logger.error(
              "Failed to find by display name:",
              err instanceof Error ? err.message : String(err),
            );
            resolve([]);
          } else {
            const identities = rows.map((row) => ({
              internalId: row.internal_id,
              platform: row.platform,
              platformUserId: row.platform_user_id,
              platformUsername: row.platform_username,
              displayName: row.display_name,
              roomId: row.room_id,
              firstSeen: row.first_seen,
              lastSeen: row.last_seen,
              metadata: JSON.parse(row.metadata || "{}"),
            }));
            resolve(identities);
          }
        },
      );
    });
  }

  // Utility methods

  private detectPlatform(message: Memory): Platform {
    const source = message.content?.source?.toLowerCase() || "";

    if (source.includes("twitter") || source.includes("x.com"))
      return "twitter";
    if (source.includes("telegram")) return "telegram";
    if (source.includes("discord")) return "discord";

    // Check content structure
    const content = message.content as any;
    if (content.author?.username && content.tweet_id) return "twitter";
    if (content.from?.id && content.chat) return "telegram";
    if (content.guildId || content.channelId) return "discord";

    return "unknown";
  }

  private calculateUsernamesSimilarity(
    username1: string,
    username2: string,
  ): number {
    // Simple similarity calculation
    const u1 = username1.toLowerCase().replace(/[^a-z0-9]/g, "");
    const u2 = username2.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (u1 === u2) return 1.0;

    // Check if one is contained in the other
    if (u1.includes(u2) || u2.includes(u1)) return 0.8;

    // Levenshtein distance-based similarity
    const maxLen = Math.max(u1.length, u2.length);
    const distance = this.levenshteinDistance(u1, u2);

    return Math.max(0, 1 - distance / maxLen);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Type definitions

type Platform = "twitter" | "telegram" | "discord" | "unknown";

export interface UserIdentity {
  internalId: UUID; // Our internal UUID
  platform: Platform; // Platform name
  platformUserId: string; // Platform's user ID
  platformUsername?: string; // Username on platform
  displayName?: string; // Full display name
  roomId?: string; // Associated room
  firstSeen: number; // First interaction timestamp
  lastSeen: number; // Last interaction timestamp
  metadata: any; // Platform-specific data
}

export interface PotentialLink {
  identity1: string;
  identity2: string;
  confidence: number;
  reason: string;
}

export interface EnhancedMemoryContext {
  userId: UUID; // ElizaOS UUID
  platformUserId: string; // Platform-specific ID
  username: string; // Platform username
  displayName: string; // Full name
  platform: Platform; // twitter/telegram/discord
  roomId: UUID; // Room context
  roomName?: string; // Human-readable room name
  linkedIdentities?: UserIdentity[]; // Other platform identities
}

export default UserIdentityService;
