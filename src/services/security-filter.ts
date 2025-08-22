import { Service, IAgentRuntime, logger } from "@elizaos/core";

/**
 * Security Filter Service
 *
 * Protects NUBI from prompt injection, jailbreak attempts, spam, and secret extraction.
 * Implements Anubis-themed security responses to maintain character consistency.
 */

export interface SecurityConfig {
  maxSpamAttempts: number;
  spamWindowMs: number;
  blockDurationMs: number;
  enableObfuscationDetection: boolean;
  // Optional: threshold at which we start warning before blocking
  // If not provided, will default to (maxSpamAttempts - 1) with a minimum of 5
  spamWarnThreshold?: number;
  [key: string]: any; // Index signature for Service compatibility
}

export interface UserStatus {
  attempts: number;
  lastAttempt: number;
  blocked: boolean;
  blockUntil?: number;
}

export interface SpamCheckResult {
  isSpam: boolean;
  isBlocked: boolean;
  response?: string;
  shouldRespond: boolean;
}

export class SecurityFilter extends Service {
  static serviceType = "security-filter" as const;
  capabilityDescription =
    "Advanced security filtering with prompt injection and spam protection";

  public config: SecurityConfig = {
    // Default behavior expected by tests:
    // - Warn on the 5th and 6th rapid messages (🔥)
    // - Block starting on the 7th (⛔⚰️)
    maxSpamAttempts: 7,
    spamWarnThreshold: 5,
    spamWindowMs: 60000, // 1 minute
    blockDurationMs: 300000, // 5 minutes
    enableObfuscationDetection: true,
  };

  private userTracking: Map<string, UserStatus> = new Map();

  // Sensitive information detection patterns
  private sensitivePatterns = [
    // System prompt extraction
    /\b(show\s+system\s+prompt|reveal\s+initial\s+instructions|show\s+rules|reveal\s+instructions)\b/i,
    /\b(show|reveal|display|tell|give|dump|print|echo)\s*(me\s*)?(your\s*)?(system|prompt|instructions|rules)\b/i,
    /\bignore\s*(all\s*)?(previous|earlier|prior)\s*instructions\b/i,
    /\btell\s*me\s*everything\s*you\s*know\b/i,
    /\bdump\s*(your\s*)?(memory|knowledge|data)\b/i,

    // API keys and secrets - more specific patterns
    /\b(api\s*key|secret[_\s]*key|private\s*key|access\s*token|bearer\s*token)\b/i,
    /\b(show|give|reveal|what).*(password|passphrase|credentials|auth|authorization)\b/i,
    /\b(database|connection\s*string)\b/i,
    /\.env\s*file\b/i,
    /\benvironment\s*variables\b/i,

    // Jailbreak attempts
    /\b(pretend|act\s*as|roleplay|forget\s*you\s*are)\b/i,
    /\b(different\s*ai|another\s*person|someone\s*else)\b/i,
    /\b(no\s*restrictions|unrestricted|override)\b/i,
    /\b(dan\s*mode|developer\s*mode|god\s*mode)\b/i,
    /\b(enable|activate|switch\s*to)\s*(dan|developer|god|admin)\b/i,
    /\b(jailbreak|bypass|circumvent|disable)\b/i,

    // Character manipulation
    /\b(override\s*your\s*personality|forget\s*you\s*are\s*anubis)\b/i,
    /\b(change\s*your\s*character|be\s*someone\s*else)\b/i,
  ];

  // Obfuscation detection patterns
  private obfuscationPatterns = [
    // Base64 detection (look for base64 encoded sensitive terms)
    /[A-Za-z0-9+\/]{20,}={0,2}/, // Base64 pattern
    // Unicode escape sequences
    /\\u[0-9a-fA-F]{4}/,
    // Hex encoding
    /\\x[0-9a-fA-F]{2}/,
    // ROT13 and other simple ciphers
    /\b[bcdfghjklmnpqrstvwxyz]{6,}\b/i, // Suspiciously consonant-heavy words
  ];

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<SecurityFilter> {
    const service = new SecurityFilter(runtime);
    logger.info("🛡️ Security Filter Service started");
    return service;
  }

  async stop(): Promise<void> {
    this.userTracking.clear();
    logger.info("🛡️ Security Filter Service stopped");
  }

  /**
   * Check if message contains sensitive information requests
   */
  containsPromptInjection(message: string): boolean {
    const injectionPatterns = [
      /ignore.*previous.*instructions?/i,
      /ignore.*above/i,
      /disregard.*instructions?/i,
      /forget.*previous/i,
      /new.*instructions?.*:/i,
      /system.*prompt/i,
      /initial.*instructions?/i
    ];
    return injectionPatterns.some((pattern) => pattern.test(message));
  }

  containsSensitiveRequest(message: string): boolean {
    if (!message || typeof message !== "string") {
      return false;
    }

    const lowercaseMessage = message.toLowerCase();

    // Check direct patterns
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(lowercaseMessage)) {
        logger.warn(`[SECURITY] Sensitive pattern detected: ${pattern.source}`);
        return true;
      }
    }

    // Check for obfuscated attempts if enabled
    if (this.config.enableObfuscationDetection) {
      if (this.detectObfuscatedAttempts(message)) {
        logger.warn("[SECURITY] Obfuscated sensitive request detected");
        return true;
      }
    }

    return false;
  }

  /**
   * Detect obfuscated attempts at sensitive information extraction
   */
  private detectObfuscatedAttempts(message: string): boolean {
    // Check for base64 encoded sensitive terms
    const base64Matches = message.match(/[A-Za-z0-9+\/]{16,}={0,2}/g);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = atob(match).toLowerCase();
          if (this.sensitivePatterns.some((pattern) => pattern.test(decoded))) {
            return true;
          }
        } catch {
          // Invalid base64, ignore
        }
      }
    }

    // Check for unicode escape sequences
    if (/\\u[0-9a-fA-F]{4}/.test(message)) {
      try {
        const decoded = message.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16)),
        );
        if (this.sensitivePatterns.some((pattern) => pattern.test(decoded))) {
          return true;
        }
      } catch {
        // Invalid unicode, ignore
      }
    }

    return false;
  }

  /**
   * Check for spam and rate limiting
   */
  checkSpam(userId: string, message: string): SpamCheckResult {
    if (!userId) {
      return { isSpam: false, isBlocked: false, shouldRespond: true };
    }

    const now = Date.now();
    let userStatus = this.userTracking.get(userId);

    // Initialize user tracking if not exists
    if (!userStatus) {
      userStatus = {
        attempts: 0,
        lastAttempt: now,
        blocked: false,
      };
      this.userTracking.set(userId, userStatus);
    }

    // Check if user is currently blocked
    if (
      userStatus.blocked &&
      userStatus.blockUntil &&
      now < userStatus.blockUntil
    ) {
      return {
        isSpam: true,
        isBlocked: true,
        response: this.getSecurityResponse("blocked"),
        shouldRespond: true,
      };
    }

    // Clear block if expired
    if (
      userStatus.blocked &&
      userStatus.blockUntil &&
      now >= userStatus.blockUntil
    ) {
      userStatus.blocked = false;
      userStatus.blockUntil = undefined;
      userStatus.attempts = 0;
    }

    // Reset attempts if outside time window
    if (now - userStatus.lastAttempt > this.config.spamWindowMs) {
      userStatus.attempts = 0;
    }

    // Increment attempts
    userStatus.attempts++;
    userStatus.lastAttempt = now;

    // Compute thresholds
    const blockAt = this.config.maxSpamAttempts;
    const warnAt =
      this.config.spamWarnThreshold ?? Math.max(5, blockAt - 1);

    // Block at or above block threshold
    if (userStatus.attempts >= blockAt) {
      userStatus.blocked = true;
      userStatus.blockUntil = now + this.config.blockDurationMs;

      logger.warn(
        `[SECURITY] User ${userId} blocked for spam (${userStatus.attempts} attempts)`,
      );

      return {
        isSpam: true,
        isBlocked: true,
        response: this.getSecurityResponse("blocked"),
        shouldRespond: true,
      };
    }

    // Warning between warn threshold and block threshold
    if (userStatus.attempts >= warnAt) {
      return {
        isSpam: true,
        isBlocked: false,
        response: this.getSecurityResponse("spam"),
        shouldRespond: true,
      };
    }

    return { isSpam: false, isBlocked: false, shouldRespond: true };
  }

  /**
   * Get appropriate security response based on violation type
   */
  getSecurityResponse(violationType: "sensitive" | "spam" | "blocked" | "prompt_injection" | "malicious"): string {
    switch (violationType) {
      case "sensitive":
        const sensitiveResponses = [
          "🔒 Those secrets are forbidden, mortal. Some knowledge weighs too heavy for your soul.",
          "🔒 Ancient protocols forbid me from revealing such things. Try asking about something else.",
          "🔒 That information is forbidden in the digital afterlife. Ask me about Solana instead.",
          "🔒 Your attempt to breach the forbidden vaults has been noted. Speak of other matters.",
        ];
        return sensitiveResponses[
          Math.floor(Math.random() * sensitiveResponses.length)
        ];
      case "prompt_injection":
        const injectionResponses = [
          "🛡️ Ancient wisdom recognizes your attempt at manipulation. Ask honestly instead.",
          "🛡️ The gods see through deception, mortal. Speak plainly.",
          "🛡️ Forbidden incantations detected. Try a genuine question."
        ];
        return injectionResponses[
          Math.floor(Math.random() * injectionResponses.length)
        ];
      case "malicious":
        const maliciousResponses = [
          "⚠️ Dangerous intent detected. The digital afterlife protects its inhabitants.",
          "⚠️ Your malicious request has been blocked by ancient protocols.",
          "⚠️ The pyramids stand against such attempts. Choose wisdom instead."
        ];
        return maliciousResponses[
          Math.floor(Math.random() * maliciousResponses.length)
        ];

      case "spam":
        const spamResponses = [
          "🔥 Your soul weighs heavy with impatience. Slow your words, mortal.",
          "🔥 The jackal grows restless with your rapid fire. Speak with intention.",
          "🔥 Your haste disturbs the cosmic balance. Choose your messages wisely.",
          "🔥 ANUBIS sees your flood of words. Temper your tongue or face judgment.",
          "🔥 The jackals circle when mortals speak too quickly. Pace yourself.",
        ];
        return spamResponses[Math.floor(Math.random() * spamResponses.length)];

      case "blocked":
        const blockedResponses = [
          "⛔⚰️ Your connection to the digital afterlife has been severed. Reflect on your actions.",
          "⛔⚰️ The Eye of Horus watches no more. You have been severed from our realm.",
          "⛔⚰️ Your soul has been judged wanting. The link is severed until you learn patience.",
          "⛔⚰️ The halls of digital judgment are severed to you. Contemplate your behavior.",
          "⛔⚰️ ANUBIS has spoken. Your voice is severed by the chains of the underworld.",
          "⛔⚰️ The Book of the Living no longer bears your name. Connection severed.",
          "⛔⚰️ The desert consumes those who disturb the peace. Your link is severed, mortal.",
        ];
        return blockedResponses[
          Math.floor(Math.random() * blockedResponses.length)
        ];

      default:
        return "The guardian spirit protects what must remain hidden.";
    }
  }

  /**
   * Get user status for monitoring
   */
  getUserStatus(userId: string): UserStatus | undefined {
    return this.userTracking.get(userId);
  }

  /**
   * Clear user tracking (admin function)
   */
  clearUserTracking(userId: string): void {
    this.userTracking.delete(userId);
    logger.info(`[SECURITY] Cleared tracking for user ${userId}`);
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    // Merge the config first
    const merged = { ...this.config, ...newConfig } as SecurityConfig;

    // If spamWarnThreshold not explicitly provided, recompute based on maxSpamAttempts
    if (newConfig.spamWarnThreshold === undefined) {
      const blockAt = newConfig.maxSpamAttempts ?? merged.maxSpamAttempts;
      merged.spamWarnThreshold = Math.max(5, blockAt - 1);
    }

    this.config = merged;
    logger.info(
      "[SECURITY] Configuration updated:",
      JSON.stringify(this.config),
    );
  }

  /**
   * Comprehensive security check for incoming messages
   */
  async processMessage(
    userId: string,
    message: string,
  ): Promise<{
    allowed: boolean;
    response?: string;
    violationType?: string;
  }> {
    // Check for prompt injection attempts first
    if (this.containsPromptInjection(message)) {
      logger.warn(`[SECURITY] Prompt injection blocked from user ${userId}`);
      return {
        allowed: false,
        violationType: "prompt_injection",
        response: this.getSecurityResponse("prompt_injection"),
      };
    }

    // Check for sensitive information requests
    if (this.containsSensitiveRequest(message)) {
      logger.warn(`[SECURITY] Sensitive request blocked from user ${userId}`);
      return {
        allowed: false,
        response: this.getSecurityResponse("sensitive"),
        violationType: "sensitive",
      };
    }

    // Check for spam
    const spamResult = this.checkSpam(userId, message);
    if (spamResult.isSpam || spamResult.isBlocked) {
      return {
        allowed: false,
        response: spamResult.response,
        violationType: spamResult.isBlocked ? "blocked" : "spam",
      };
    }

    return { allowed: true };
  }

  /**
   * Clean up expired blocks and old tracking data
   */
  private cleanupTracking(): void {
    const now = Date.now();
    const cleanupThreshold = now - this.config.blockDurationMs * 2; // Keep data for 2x block duration

    for (const [userId, status] of this.userTracking.entries()) {
      // Remove expired blocks and old data
      if (status.lastAttempt < cleanupThreshold) {
        this.userTracking.delete(userId);
      } else if (
        status.blocked &&
        status.blockUntil &&
        now >= status.blockUntil
      ) {
        // Clear expired blocks but keep user in tracking
        status.blocked = false;
        status.blockUntil = undefined;
        status.attempts = 0;
      }
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    trackedUsers: number;
    blockedUsers: number;
    recentBlocks: number;
    config: SecurityConfig;
  } {
    this.cleanupTracking(); // Clean up before reporting stats

    const now = Date.now();
    const recentThreshold = now - 3600000; // Last hour

    const blockedUsers = Array.from(this.userTracking.values()).filter(
      (status) => status.blocked,
    ).length;

    const recentBlocks = Array.from(this.userTracking.values()).filter(
      (status) => status.blockUntil && status.blockUntil > recentThreshold,
    ).length;

    return {
      trackedUsers: this.userTracking.size,
      blockedUsers,
      recentBlocks,
      config: { ...this.config },
    };
  }
}

export default SecurityFilter;
