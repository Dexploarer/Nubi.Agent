/**
 * Webhook Routes for NUBI/XMCP Integration
 * Properly integrated with ElizaOS patterns
 */

import { IAgentRuntime, logger } from "@elizaos/core";
import { Router } from "express";
import crypto from "crypto";

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
    try {
      // Verify Telegram webhook signature
      const token = process.env.TELEGRAM_WEBHOOK_SECRET;
      const signature = req.headers["x-telegram-bot-api-secret-token"];

      if (token && signature !== token) {
        logger.warn("[WEBHOOK] Invalid Telegram signature");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const update = req.body;
      logger.debug("[WEBHOOK] Telegram update received:", update.update_id);

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

      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error(
        "[WEBHOOK] Telegram webhook error:",
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
  logger.info("  - POST /webhook/mcp/verify");
  logger.info("  - GET  /webhook/raid/status/:raidId");
  logger.info("  - POST /webhook/engagement/submit");
  logger.info("  - GET  /webhook/leaderboard/:chatId?");
  logger.info("  - GET  /webhook/health");
}

export default { createWebhookRoutes, registerWebhookRoutes };
