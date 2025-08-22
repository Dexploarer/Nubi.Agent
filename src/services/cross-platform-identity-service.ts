import {
  Service,
  IAgentRuntime,
  ServiceType,
  UUID,
  logger,
  Memory,
} from "@elizaos/core";
import { Client } from "pg";

/**
 * Cross-Platform Identity Service
 *
 * PostgreSQL-based service that integrates with the identity-linker Edge Function
 * to manage cross-platform user identity resolution and linking.
 */
export class CrossPlatformIdentityService extends Service {
  static serviceType = "cross-platform-identity" as const;
  capabilityDescription =
    "Advanced cross-platform user identity management with automatic and manual linking";

  private dbClient: Client | null = null;
  private identityLinkerUrl: string;
  private agentId: UUID;
  private linkingCommands = new Map<string, LinkCommand>();
  private serviceRoleKey: string;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.agentId = runtime.agentId;

    // Validate required environment variables
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!this.serviceRoleKey) {
      logger.warn(
        "[IDENTITY_SERVICE] SUPABASE_SERVICE_ROLE_KEY not set - identity linking will be disabled",
      );
    }

    // Set identity linker URL
    this.identityLinkerUrl =
      process.env.IDENTITY_LINKER_URL ||
      "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/identity-linker";

    // Register linking commands
    this.registerCommands();
  }

  /**
   * Make API call to identity linker with timeout and retry logic
   */
  private async makeAPICall(
    body: any,
    maxRetries: number = 2,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(this.identityLinkerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.serviceRoleKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          logger.debug(
            `[IDENTITY_SERVICE] API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<CrossPlatformIdentityService> {
    const service = new CrossPlatformIdentityService(runtime);
    await service.initialize();
    return service;
  }

  async stop(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.end();
      logger.info("[IDENTITY_SERVICE] Disconnected from PostgreSQL");
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Setup PostgreSQL connection
      const databaseUrl =
        process.env.DATABASE_URL ||
        "postgresql://postgres:Anubisdata1!@db.nfnmoqepgjyutcbbaqjg.supabase.co:5432/postgres";

      this.dbClient = new Client({
        connectionString: databaseUrl,
      });

      await this.dbClient.connect();
      logger.info("[IDENTITY_SERVICE] Connected to PostgreSQL");
    } catch (error) {
      logger.error("[IDENTITY_SERVICE] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Register manual linking commands
   */
  private registerCommands(): void {
    // /link command
    this.linkingCommands.set("link", {
      pattern: /^\/link\s+(\w+)\s+(.+)$/i,
      handler: async (match, message) => {
        const [_, platform, identifier] = match;
        return await this.handleLinkCommand(message, platform, identifier);
      },
      description:
        "Link your account to another platform: /link discord username",
    });

    // /unlink command
    this.linkingCommands.set("unlink", {
      pattern: /^\/unlink\s+(\w+)$/i,
      handler: async (match, message) => {
        const [_, platform] = match;
        return await this.handleUnlinkCommand(message, platform);
      },
      description: "Unlink your account from a platform: /unlink discord",
    });

    // /myaccounts command
    this.linkingCommands.set("myaccounts", {
      pattern: /^\/myaccounts$/i,
      handler: async (match, message) => {
        return await this.handleMyAccountsCommand(message);
      },
      description: "Show all your linked accounts",
    });

    // Natural language linking
    this.linkingCommands.set("natural_link", {
      pattern: /link my (\w+) (?:account|profile)?\s*(?:@)?(\S+)/i,
      handler: async (match, message) => {
        const [_, platform, identifier] = match;
        return await this.handleLinkCommand(message, platform, identifier);
      },
      description: "Natural language account linking",
    });
  }

  /**
   * Process messages for identity commands
   */
  async processMessage(message: Memory): Promise<string | null> {
    const text = message.content?.text || "";

    // Check for commands
    for (const [name, command] of this.linkingCommands) {
      const match = text.match(command.pattern);
      if (match) {
        return await command.handler(match, message);
      }
    }

    // Auto-detect and analyze identity
    await this.analyzeMessageIdentity(message);

    return null;
  }

  /**
   * Handle link command
   */
  private async handleLinkCommand(
    message: Memory,
    targetPlatform: string,
    targetIdentifier: string,
  ): Promise<string> {
    try {
      const platform = this.detectPlatform(message);
      const userId = this.extractUserId(message);
      const username = this.extractUsername(message);

      // Call Edge Function to create link request
      const response = await this.makeAPICall({
        action: "link",
        platform,
        userId,
        targetPlatform: targetPlatform.toLowerCase(),
        targetIdentifier: targetIdentifier.replace("@", ""),
        data: {
          username,
          display_name: this.extractDisplayName(message),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return `❌ Failed to link account: ${(error as any).error || "Unknown error"}`;
      }

      const result = (await response.json()) as any;

      // Store verification code for user
      await this.storeVerificationCode(
        userId,
        targetPlatform,
        result.verificationCode,
        result.linkRequestId,
      );

      return (
        `🔗 To link your ${targetPlatform} account:\n\n` +
        `1. Go to ${targetPlatform}\n` +
        `2. Send this verification code: **${result.verificationCode}**\n` +
        `3. Your accounts will be linked automatically!\n\n` +
        `⏱️ Code expires in 15 minutes`
      );
    } catch (error) {
      logger.error("[IDENTITY_SERVICE] Link command failed:", error);
      return `❌ Failed to create link request. Please try again later.`;
    }
  }

  /**
   * Handle unlink command
   */
  private async handleUnlinkCommand(
    message: Memory,
    targetPlatform: string,
  ): Promise<string> {
    try {
      const platform = this.detectPlatform(message);
      const userId = this.extractUserId(message);

      // Call Edge Function to unlink
      const response = await fetch(this.identityLinkerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: "unlink",
          platform,
          userId,
          targetPlatform: targetPlatform.toLowerCase(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return `❌ Failed to unlink: ${(error as any).error || "Unknown error"}`;
      }

      return `✅ Successfully unlinked your ${targetPlatform} account`;
    } catch (error: any) {
      logger.error("[IDENTITY_SERVICE] Unlink command failed:", error);
      return `❌ Failed to unlink account. Please try again later.`;
    }
  }

  /**
   * Handle myaccounts command
   */
  private async handleMyAccountsCommand(message: Memory): Promise<string> {
    try {
      const platform = this.detectPlatform(message);
      const userId = this.extractUserId(message);

      // Call Edge Function to resolve identity
      const response = await fetch(this.identityLinkerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: "resolve",
          platform,
          userId,
        }),
      });

      if (!response.ok) {
        return `❌ Failed to fetch linked accounts`;
      }

      const result = (await response.json()) as any;

      if (!result.profiles || result.profiles.length === 0) {
        return (
          `📱 You don't have any linked accounts yet.\n\n` +
          `Use \`/link [platform] [username]\` to link accounts!`
        );
      }

      let response_text = `📱 **Your Linked Accounts**\n\n`;

      for (const profile of result.profiles) {
        const emoji = this.getPlatformEmoji(profile.platform);
        response_text += `${emoji} **${profile.platform}**: @${profile.username || profile.platform_user_id}\n`;
      }

      if (result.confidence) {
        response_text += `\n🔒 Identity confidence: ${Math.round(result.confidence)}%`;
      }

      return response_text;
    } catch (error) {
      logger.error("[IDENTITY_SERVICE] MyAccounts command failed:", error);
      return `❌ Failed to fetch accounts. Please try again later.`;
    }
  }

  /**
   * Analyze message for automatic identity detection
   */
  private async analyzeMessageIdentity(message: Memory): Promise<void> {
    try {
      const platform = this.detectPlatform(message);
      const userId = this.extractUserId(message);
      const username = this.extractUsername(message);

      // Skip if no valid identity
      if (!userId) return;

      // Call Edge Function to analyze (background, no await)
      this.makeAPICall({
        action: "analyze",
        platform,
        userId,
        data: {
          username,
          display_name: this.extractDisplayName(message),
        },
      }).catch((error) => {
        logger.debug("[IDENTITY_SERVICE] Background analysis failed:", error);
      });

      // Update message counts
      await this.updateMessageCount(platform, userId);
    } catch (error) {
      logger.debug("[IDENTITY_SERVICE] Message analysis failed:", error);
    }
  }

  /**
   * Check for verification codes in messages
   */
  async checkVerificationCode(message: Memory): Promise<boolean> {
    try {
      const text = message.content?.text || "";
      const codeMatch = text.match(/^([A-Z0-9]{6})$/);

      if (!codeMatch) return false;

      const code = codeMatch[1];
      const platform = this.detectPlatform(message);
      const userId = this.extractUserId(message);

      // Call Edge Function to verify
      const response = await this.makeAPICall({
        action: "verify",
        platform,
        userId,
        verificationCode: code,
        data: {
          username: this.extractUsername(message),
          display_name: this.extractDisplayName(message),
        },
      });

      if (response.ok) {
        const result = (await response.json()) as any;

        // Send success message
        await (this.runtime as any).messageManager?.createMemory({
          id: this.runtime.agentId,
          entityId: message.entityId,
          roomId: message.roomId,
          content: {
            text: `✅ Accounts successfully linked! Your profiles are now connected across platforms.`,
          },
          createdAt: Date.now(),
        });

        return true;
      }
    } catch (error) {
      logger.debug("[IDENTITY_SERVICE] Verification check failed:", error);
    }

    return false;
  }

  /**
   * Store verification code temporarily
   */
  private async storeVerificationCode(
    userId: string,
    platform: string,
    code: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.dbClient!.query(
        `INSERT INTO cache (key, agent_id, value, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key, agent_id) DO UPDATE SET 
           value = $3,
           created_at = NOW()`,
        [
          `verification_${userId}_${platform}`,
          this.agentId,
          JSON.stringify({ code, requestId, expires: Date.now() + 900000 }),
        ],
      );
    } catch (error) {
      logger.error(
        "[IDENTITY_SERVICE] Failed to store verification code:",
        error,
      );
    }
  }

  /**
   * Update message count for a user
   */
  private async updateMessageCount(
    platform: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.dbClient!.query(
        `UPDATE platform_profiles 
         SET message_count = message_count + 1,
             last_seen = NOW()
         WHERE platform = $1 AND platform_user_id = $2`,
        [platform, userId],
      );
    } catch (error) {
      // Ignore errors - this is not critical
    }
  }

  /**
   * Utility methods for extracting identity from messages
   */
  public detectPlatform(message: Memory): string {
    const source = message.content?.source?.toLowerCase() || "";

    if (source.includes("telegram")) return "telegram";
    if (source.includes("discord")) return "discord";
    if (source.includes("twitter") || source.includes("x.com")) return "x";

    // Check content structure
    const content = message.content as any;
    if (content.from?.id && content.chat) return "telegram";
    if (content.guildId || content.channelId) return "discord";
    if (content.author?.username && content.tweet_id) return "x";

    return "unknown";
  }

  public extractUserId(message: Memory): string {
    const content = message.content as any;

    // Telegram
    if (content.from?.id) return content.from.id.toString();

    // Discord
    if (content.author?.id) return content.author.id;

    // Twitter/X
    if (content.authorId) return content.authorId;

    // Fallback to entityId
    return message.entityId || "";
  }

  private extractUsername(message: Memory): string | undefined {
    const content = message.content as any;

    // Telegram
    if (content.from?.username) return content.from.username;

    // Discord
    if (content.author?.username) return content.author.username;

    // Twitter/X
    if (content.author?.username) return content.author.username;
    if (content.screenName) return content.screenName;

    return undefined;
  }

  private extractDisplayName(message: Memory): string | undefined {
    const content = message.content as any;

    // Telegram
    if (content.from) {
      return `${content.from.first_name || ""} ${content.from.last_name || ""}`.trim();
    }

    // Discord
    if (content.member?.nickname) return content.member.nickname;
    if (content.author?.username) return content.author.username;

    // Twitter/X
    if (content.author?.name) return content.author.name;

    return undefined;
  }

  private getPlatformEmoji(platform: string): string {
    const emojis: Record<string, string> = {
      telegram: "💬",
      discord: "🎮",
      x: "🐦",
      twitter: "🐦",
      unknown: "❓",
    };
    return emojis[platform.toLowerCase()] || "📱";
  }

  /**
   * Get cross-platform context for a user
   */
  async getCrossPlatformContext(
    platform: string,
    userId: string,
  ): Promise<CrossPlatformContext> {
    try {
      // Call Edge Function to resolve identity
      const response = await fetch(this.identityLinkerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: "resolve",
          platform,
          userId,
        }),
      });

      if (!response.ok) {
        return {
          primaryPlatform: platform,
          primaryUserId: userId,
          linkedProfiles: [],
          confidence: 0,
        };
      }

      const result = (await response.json()) as any;

      return {
        primaryPlatform: platform,
        primaryUserId: userId,
        linkedProfiles: result.profiles || [],
        confidence: result.confidence || 0,
        identity: result.identity,
      };
    } catch (error) {
      logger.error(
        "[IDENTITY_SERVICE] Failed to get cross-platform context:",
        error,
      );
      return {
        primaryPlatform: platform,
        primaryUserId: userId,
        linkedProfiles: [],
        confidence: 0,
      };
    }
  }
}

// Type definitions
interface LinkCommand {
  pattern: RegExp;
  handler: (match: RegExpMatchArray, message: Memory) => Promise<string>;
  description: string;
}

interface CrossPlatformContext {
  primaryPlatform: string;
  primaryUserId: string;
  linkedProfiles: any[];
  confidence: number;
  identity?: any;
}

export default CrossPlatformIdentityService;
