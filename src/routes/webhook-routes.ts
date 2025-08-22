/**
 * Webhook Routes for NUBI/XMCP Integration
 * Properly integrated with ElizaOS patterns
 */

import { IAgentRuntime, logger } from "@elizaos/core";
import { Router } from "express";
import crypto from "crypto";
import { pipelineAnalytics } from "../services/clickhouse-pipeline-analytics";

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // per user per minute

// IP blocking (in production, use Redis with TTL)
const blockedIPs = new Set<string>();
const suspiciousIPs = new Map<
  string,
  { violations: number; lastViolation: number }
>();

/**
 * Create webhook routes for the application
 */
export function createWebhookRoutes(runtime: IAgentRuntime): Router {
  const router = Router();

  /**
   * Telegram Webhook Handler
   * POST /webhook/telegram
   */
  router.post("/webhook/telegram", async (req, res) => {
    const startTime = Date.now();
    const traceId = pipelineAnalytics.generateTraceId();
    const sourceIp = req.ip || req.connection.remoteAddress || "unknown";
    const userId =
      req.body?.message?.from?.id ||
      req.body?.callback_query?.from?.id ||
      "unknown";
    const messageId =
      req.body?.message?.message_id ||
      req.body?.callback_query?.id ||
      crypto.randomUUID();

    try {
      // Layer 1: Security checks with ClickHouse logging
      const securityResult = await performSecurityChecks(
        "telegram",
        sourceIp,
        userId,
        req.body,
      );

      if (!securityResult.allowed) {
        await pipelineAnalytics.logSecurityEvent({
          platform: "telegram",
          eventType: securityResult.reason as any,
          sourceIp,
          userId: userId !== "unknown" ? userId : undefined,
          severity: securityResult.severity || "medium",
          blocked: true,
          metadata: { userAgent: req.headers["user-agent"], body: req.body },
        });

        return res
          .status(securityResult.statusCode || 403)
          .json({ error: securityResult.message });
      }

      // Log successful security check
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "telegram",
        eventType: "security_check",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: true,
        metadata: { sourceIp, checks: securityResult.checks },
      });

      // Verify Telegram webhook signature
      const token = process.env.TELEGRAM_WEBHOOK_SECRET;
      const signature = req.headers["x-telegram-bot-api-secret-token"];

      if (token && signature !== token) {
        await pipelineAnalytics.logSecurityEvent({
          platform: "telegram",
          eventType: "invalid_signature",
          sourceIp,
          userId: userId !== "unknown" ? userId : undefined,
          severity: "high",
          blocked: true,
          metadata: { expected: !!token, received: !!signature },
        });

        logger.warn("[WEBHOOK] Invalid Telegram signature");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update = req.body;
      logger.debug("[WEBHOOK] Telegram update received:", update.update_id);

      // Pre-ElizaOS filtering at webhook level
      const filterResult = await shouldProcessWebhookMessage(
        update,
        "telegram",
        traceId,
      );
      if (!filterResult.shouldProcess) {
        await pipelineAnalytics.logPipelineEvent({
          traceId,
          layer: "layer1",
          platform: "telegram",
          eventType: "normalization",
          userId,
          messageId,
          processingTimeMs: Date.now() - startTime,
          success: true,
          metadata: { filtered: true, reason: filterResult.reason },
        });

        logger.info(
          "[WEBHOOK] Message filtered before processing:",
          filterResult.reason,
        );
        return res.status(200).json({ ok: true, filtered: true });
      }

      // Forward to webhook-processor edge function for rate limiting and deduplication
      const webhookProcessorUrl =
        process.env.WEBHOOK_PROCESSOR_URL ||
        "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/webhook-processor";

      try {
        const processorResponse = await fetch(webhookProcessorUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            "x-platform": "telegram",
          },
          body: JSON.stringify({
            platform: "telegram",
            eventType: "webhook_update",
            userId:
              update.message?.from?.id ||
              update.callback_query?.from?.id ||
              "unknown",
            messageId: update.message?.message_id || update.callback_query?.id,
            content: update.message?.text || update.callback_query?.data,
            metadata: update,
          }),
        });

        if (!processorResponse.ok) {
          logger.warn(
            `[WEBHOOK] Processor returned ${processorResponse.status}`,
          );
          if (processorResponse.status === 429) {
            // Rate limited - handle gracefully
            logger.info(
              "[WEBHOOK] Rate limited by processor, proceeding with caution",
            );
          }
        }
      } catch (error) {
        logger.warn(
          "[WEBHOOK] Failed to reach processor:",
          error instanceof Error ? error.message : String(error),
        );
        // Continue processing locally as fallback
      }

      // Emit to ElizaOS event system
      await (runtime as any).emit("telegram.webhook.received", {
        update,
        timestamp: Date.now(),
        source: "webhook",
      });

      // Check if it's a raid-related update
      if (isRaidRelated(update)) {
        await (runtime as any).emit("raid.webhook.update", {
          platform: "telegram",
          update,
          timestamp: Date.now(),
        });
      }

      // Log successful processing
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "telegram",
        eventType: "normalization",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: true,
        metadata: {
          processed: true,
          updateType: update.message ? "message" : "callback_query",
        },
      });

      res.status(200).json({ ok: true, traceId });
    } catch (error) {
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "telegram",
        eventType: "security_check",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { sourceIp },
      });

      logger.error(
        "[WEBHOOK] Telegram webhook error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Discord Webhook Handler
   * POST /webhook/discord
   */
  router.post("/webhook/discord", async (req, res) => {
    const startTime = Date.now();
    const traceId = pipelineAnalytics.generateTraceId();
    const sourceIp = req.ip || req.connection.remoteAddress || "unknown";
    const userId =
      req.body?.member?.user?.id || req.body?.user?.id || "unknown";
    const messageId = req.body?.id || crypto.randomUUID();

    try {
      // Layer 1: Security checks with ClickHouse logging
      const securityResult = await performSecurityChecks(
        "discord",
        sourceIp,
        userId,
        req.body,
      );

      if (!securityResult.allowed) {
        await pipelineAnalytics.logSecurityEvent({
          platform: "discord",
          eventType: securityResult.reason as any,
          sourceIp,
          userId: userId !== "unknown" ? userId : undefined,
          severity: securityResult.severity || "medium",
          blocked: true,
          metadata: { userAgent: req.headers["user-agent"], body: req.body },
        });

        return res
          .status(securityResult.statusCode || 403)
          .json({ error: securityResult.message });
      }

      // Log successful security check
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "discord",
        eventType: "security_check",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: true,
        metadata: { sourceIp, checks: securityResult.checks },
      });

      // Verify Discord webhook signature if set
      const signature = req.headers["x-signature-ed25519"];
      const timestamp = req.headers["x-signature-timestamp"];

      // Discord webhook verification (if secret is set)
      const discordSecret = process.env.DISCORD_WEBHOOK_SECRET;
      if (discordSecret && signature && timestamp) {
        // Verify Discord webhook signature logic would go here
        // For now, we'll log and continue
        logger.debug("[WEBHOOK] Discord signature verification needed");
      }

      const interaction = req.body;
      logger.debug("[WEBHOOK] Discord interaction received:", interaction.type);

      // Forward to webhook-processor edge function for rate limiting and deduplication
      const webhookProcessorUrl =
        process.env.WEBHOOK_PROCESSOR_URL ||
        "https://nfnmoqepgjyutcbbaqjg.supabase.co/functions/v1/webhook-processor";

      try {
        const processorResponse = await fetch(webhookProcessorUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            "x-platform": "discord",
          },
          body: JSON.stringify({
            platform: "discord",
            eventType:
              interaction.type === 2 ? "slash_command" : "webhook_interaction",
            userId:
              interaction.member?.user?.id || interaction.user?.id || "unknown",
            messageId: interaction.id,
            content: interaction.data?.name || interaction.data?.content,
            metadata: interaction,
          }),
        });

        if (!processorResponse.ok) {
          logger.warn(
            `[WEBHOOK] Processor returned ${processorResponse.status}`,
          );
          if (processorResponse.status === 429) {
            // Rate limited - handle gracefully
            logger.info(
              "[WEBHOOK] Rate limited by processor, proceeding with caution",
            );
          }
        }
      } catch (error) {
        logger.warn(
          "[WEBHOOK] Failed to reach processor:",
          error instanceof Error ? error.message : String(error),
        );
        // Continue processing locally as fallback
      }

      // Emit to ElizaOS event system
      await (runtime as any).emit("discord.webhook.received", {
        interaction,
        timestamp: Date.now(),
        source: "webhook",
      });

      // Bridge Discord message to Socket.IO if it's a message interaction
      if (
        interaction.type === 3 &&
        interaction.data &&
        interaction.guild_id &&
        interaction.channel_id
      ) {
        // Try to get Socket.IO service and bridge the message
        try {
          const socketService = runtime.getService("socket-io-server") as any;
          if (
            socketService &&
            typeof socketService.broadcastDiscordMessage === "function"
          ) {
            await socketService.broadcastDiscordMessage({
              channelId: interaction.channel_id,
              userId:
                interaction.member?.user?.id ||
                interaction.user?.id ||
                "unknown",
              username:
                interaction.member?.user?.username ||
                interaction.user?.username ||
                "Discord User",
              content:
                interaction.data.content ||
                `Used command: ${interaction.data.name}`,
              messageId: interaction.id,
              guildId: interaction.guild_id,
              metadata: {
                interactionType: interaction.type,
                commandName: interaction.data.name,
                options: interaction.data.options,
              },
            });
          }
        } catch (error) {
          logger.warn(
            "[WEBHOOK] Failed to bridge Discord message to Socket.IO:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      // Check if it's a raid-related interaction
      if (isRaidRelatedDiscord(interaction)) {
        await (runtime as any).emit("raid.webhook.update", {
          platform: "discord",
          update: interaction,
          timestamp: Date.now(),
        });
      }

      // Log successful processing
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "discord",
        eventType: "normalization",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: true,
        metadata: { processed: true, interactionType: interaction.type },
      });

      // Send appropriate Discord response
      if (interaction.type === 1) {
        // PING - respond with PONG
        res.status(200).json({ type: 1 });
      } else {
        // Other interaction types
        res.status(200).json({ type: 1 });
      }
    } catch (error) {
      await pipelineAnalytics.logPipelineEvent({
        traceId,
        layer: "layer1",
        platform: "discord",
        eventType: "security_check",
        userId,
        messageId,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { sourceIp },
      });

      logger.error(
        "[WEBHOOK] Discord webhook error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * MCP Webhook Handler for Twitter Verifications
   * POST /webhook/mcp/verify
   */
  router.post("/webhook/mcp/verify", async (req, res) => {
    try {
      // Verify MCP webhook signature
      const signature = req.headers["x-mcp-signature"];
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", process.env.MCP_WEBHOOK_SECRET || "")
        .update(payload)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn("[WEBHOOK] Invalid MCP signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      const { type, data } = req.body;
      logger.debug(`[WEBHOOK] MCP verification request: ${type}`);

      // Handle different verification types
      switch (type) {
        case "engagement_verification":
          await handleEngagementVerification(runtime, data);
          break;
        case "raid_completion":
          await handleRaidCompletion(runtime, data);
          break;
        case "twitter_action":
          await handleTwitterAction(runtime, data);
          break;
        default:
          logger.warn(`[WEBHOOK] Unknown MCP verification type: ${type}`);
      }

      res.status(200).json({ ok: true, processed: true });
    } catch (error) {
      logger.error(
        "[WEBHOOK] MCP webhook error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Raid Status Webhook
   * GET /webhook/raid/status/:raidId
   */
  router.get("/webhook/raid/status/:raidId", async (req, res) => {
    try {
      const { raidId } = req.params;

      // Emit event to get raid status
      const statusEvent = await (runtime as any).emit("raid.status.request", {
        raidId,
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      });

      // In production, this would query the raids service
      const status = {
        raidId,
        active: true,
        participants: 0,
        engagements: {
          likes: 0,
          retweets: 0,
          comments: 0,
        },
        timestamp: Date.now(),
      };

      res.status(200).json({
        ok: true,
        data: status,
      });
    } catch (error) {
      logger.error(
        "[WEBHOOK] Raid status error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Engagement Submission Webhook
   * POST /webhook/engagement/submit
   */
  router.post("/webhook/engagement/submit", async (req, res) => {
    try {
      const { userId, raidId, engagementType, proof } = req.body;

      // Validate required fields
      if (!userId || !raidId || !engagementType) {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }

      // Emit engagement event for processing
      await (runtime as any).emit("raid.engagement.submitted", {
        userId,
        raidId,
        engagementType,
        proof,
        timestamp: Date.now(),
        source: "webhook",
      });

      res.status(200).json({
        ok: true,
        message: "Engagement submitted for verification",
      });
    } catch (error) {
      logger.error(
        "[WEBHOOK] Engagement submission error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Leaderboard Webhook
   * GET /webhook/leaderboard/:chatId?
   */
  router.get("/webhook/leaderboard/:chatId?", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { limit = 10 } = req.query;

      // Emit event to get leaderboard
      await (runtime as any).emit("leaderboard.request", {
        chatId,
        limit: parseInt(limit as string),
        timestamp: Date.now(),
      });

      // In production, this would query the leaderboard service
      const leaderboard = {
        chatId,
        entries: [],
        timestamp: Date.now(),
      };

      res.status(200).json({
        ok: true,
        data: leaderboard,
      });
    } catch (error) {
      logger.error(
        "[WEBHOOK] Leaderboard error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Health Check Webhook
   * GET /webhook/health
   */
  router.get("/webhook/health", (req, res) => {
    res.status(200).json({
      ok: true,
      service: "nubi-webhooks",
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  return router;
}

/**
 * Helper Functions
 */

function isRaidRelated(update: any): boolean {
  const text = update.message?.text || update.callback_query?.data || "";
  const raidKeywords = ["raid", "join", "engagement", "leaderboard", "stats"];
  return raidKeywords.some((keyword) => text.toLowerCase().includes(keyword));
}

function isRaidRelatedDiscord(interaction: any): boolean {
  const commandName = interaction.data?.name || "";
  const content = interaction.data?.options?.[0]?.value || "";
  const raidKeywords = ["raid", "join", "engagement", "leaderboard", "stats"];

  return (
    raidKeywords.some((keyword) =>
      commandName.toLowerCase().includes(keyword),
    ) || raidKeywords.some((keyword) => content.toLowerCase().includes(keyword))
  );
}

async function handleEngagementVerification(runtime: IAgentRuntime, data: any) {
  const { userId, raidId, engagementType, tweetUrl } = data;

  logger.info(
    `[WEBHOOK] Verifying engagement: ${engagementType} for user ${userId}`,
  );

  // Emit verification event
  await (runtime as any).emit("raid.engagement.verified", {
    userId,
    raidId,
    engagementType,
    tweetUrl,
    verified: true,
    timestamp: Date.now(),
  });
}

async function handleRaidCompletion(runtime: IAgentRuntime, data: any) {
  const { raidId, analytics } = data;

  logger.info(`[WEBHOOK] Raid completed: ${raidId}`);

  // Emit completion event
  await (runtime as any).emit("raid.completed", {
    raidId,
    analytics,
    timestamp: Date.now(),
  });
}

async function handleTwitterAction(runtime: IAgentRuntime, data: any) {
  const { action, targetUrl, userId } = data;

  logger.info(`[WEBHOOK] Twitter action: ${action} on ${targetUrl}`);

  // Emit Twitter action event
  await (runtime as any).emit("twitter.action.performed", {
    action,
    targetUrl,
    userId,
    timestamp: Date.now(),
  });
}

/**
 * Register webhook routes with the ElizaOS runtime
 */
export function registerWebhookRoutes(runtime: IAgentRuntime, app: any) {
  const webhookRoutes = createWebhookRoutes(runtime);
  app.use("/webhook", webhookRoutes);

  logger.info("[WEBHOOK] Routes registered:");
  logger.info("  - POST /webhook/telegram");
  logger.info("  - POST /webhook/discord");
  logger.info("  - POST /webhook/mcp/verify");
  logger.info("  - GET  /webhook/raid/status/:raidId");
  logger.info("  - POST /webhook/engagement/submit");
  logger.info("  - GET  /webhook/leaderboard/:chatId?");
  logger.info("  - GET  /webhook/health");
}

/**
 * Layer 1 Security Functions
 */

interface SecurityResult {
  allowed: boolean;
  reason?: string;
  severity?: "low" | "medium" | "high" | "critical";
  statusCode?: number;
  message?: string;
  checks?: string[];
}

/**
 * Perform comprehensive security checks
 */
async function performSecurityChecks(
  platform: string,
  sourceIp: string,
  userId: string,
  payload: any,
): Promise<SecurityResult> {
  const checks: string[] = [];

  // 1. IP-based checks
  if (blockedIPs.has(sourceIp)) {
    return {
      allowed: false,
      reason: "blocked_ip",
      severity: "high",
      statusCode: 403,
      message: "IP address is blocked",
    };
  }
  checks.push("ip_check");

  // 2. Rate limiting
  const rateLimitKey = `${sourceIp}:${userId}`;
  const now = Date.now();
  const userLimit = rateLimitStore.get(rateLimitKey);

  if (userLimit) {
    if (now < userLimit.resetTime) {
      if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        // Mark IP as suspicious after repeated rate limiting
        const suspicious = suspiciousIPs.get(sourceIp) || {
          violations: 0,
          lastViolation: 0,
        };
        suspicious.violations++;
        suspicious.lastViolation = now;
        suspiciousIPs.set(sourceIp, suspicious);

        // Block IP after 5 violations in 1 hour
        if (
          suspicious.violations >= 5 &&
          now - suspicious.lastViolation < 3600000
        ) {
          blockedIPs.add(sourceIp);
        }

        return {
          allowed: false,
          reason: "rate_limit",
          severity: "medium",
          statusCode: 429,
          message: "Rate limit exceeded",
        };
      }
      userLimit.count++;
    } else {
      // Reset window
      rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      });
    }
  } else {
    rateLimitStore.set(rateLimitKey, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
  }
  checks.push("rate_limit");

  // 3. Payload validation
  if (!payload || typeof payload !== "object") {
    return {
      allowed: false,
      reason: "invalid_payload",
      severity: "medium",
      statusCode: 400,
      message: "Invalid payload format",
    };
  }
  checks.push("payload_validation");

  // 4. Platform-specific checks
  if (platform === "telegram") {
    if (!payload.update_id) {
      return {
        allowed: false,
        reason: "invalid_payload",
        severity: "medium",
        statusCode: 400,
        message: "Missing required Telegram fields",
      };
    }
  }

  if (platform === "discord") {
    if (!payload.id || !payload.type) {
      return {
        allowed: false,
        reason: "invalid_payload",
        severity: "medium",
        statusCode: 400,
        message: "Missing required Discord fields",
      };
    }
  }
  checks.push("platform_validation");

  // 5. Content filtering (basic spam detection)
  const content = payload.message?.text || payload.data?.content || "";
  if (content && isSpamContent(content)) {
    return {
      allowed: false,
      reason: "spam_detected",
      severity: "low",
      statusCode: 200, // Accept but don't process
      message: "Content flagged as spam",
    };
  }
  checks.push("content_filter");

  return {
    allowed: true,
    checks,
  };
}

/**
 * Basic spam detection
 */
function isSpamContent(content: string): boolean {
  const spamPatterns = [
    /http[s]?:\/\/.{0,50}(?:bit\.ly|tinyurl|t\.co|goo\.gl)/i, // Suspicious shortened URLs
    /(free|win|click|urgent|limited|offer).{0,30}(money|prize|reward|cash)/i, // Spam phrases
    /[🎰🎲💰💸💵💴💶💷]{3,}/i, // Excessive gambling/money emojis
    /(.{1,3})\1{10,}/i, // Repeated characters
  ];

  return spamPatterns.some((pattern) => pattern.test(content));
}

interface FilterResult {
  shouldProcess: boolean;
  reason?: string;
}

/**
 * Enhanced message filtering with tracing
 */
async function shouldProcessWebhookMessage(
  update: any,
  platform: "telegram" | "discord",
  traceId?: string,
): Promise<FilterResult> {
  // Skip empty updates
  if (!update) {
    return { shouldProcess: false, reason: "empty_update" };
  }

  // Platform-specific filtering
  if (platform === "telegram") {
    // Skip non-message updates we don't care about
    if (!update.message && !update.callback_query && !update.inline_query) {
      return { shouldProcess: false, reason: "unsupported_update_type" };
    }

    // Skip system messages
    if (update.message?.new_chat_members || update.message?.left_chat_member) {
      return { shouldProcess: false, reason: "system_message" };
    }
  }

  if (platform === "discord") {
    // Only process message interactions and slash commands
    if (update.type !== 2 && update.type !== 3) {
      // APPLICATION_COMMAND and MESSAGE_COMPONENT
      return { shouldProcess: false, reason: "unsupported_interaction_type" };
    }
  }

  return { shouldProcess: true };
}

export default { createWebhookRoutes, registerWebhookRoutes };
