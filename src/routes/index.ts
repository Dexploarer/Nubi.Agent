/**
 * Routes exports for ElizaOS NUBI Agent
 *
 * Provides API routes for sessions management and webhook handling
 */

import sessionsRoutes from "./sessions-routes";
import webhookRoutes from "./webhook-routes";

// Export sessions routes (actively used)
export { default as sessionsRoutes } from "./sessions-routes";

// Export webhook routes (available but not currently used)
export { createWebhookRoutes, registerWebhookRoutes } from "./webhook-routes";

// Re-export webhook routes for potential future use
export { default as webhookRoutes } from "./webhook-routes";

/**
 * Route utilities for enhanced route management
 */
export const routeUtils = {
  /**
   * Validate route parameters
   */
  validateRouteParams: (
    params: Record<string, any>,
    required: string[],
  ): boolean => {
    return required.every(
      (param) => params[param] !== undefined && params[param] !== null,
    );
  },

  /**
   * Create standardized error response
   */
  createErrorResponse: (status: number, message: string, details?: any) => {
    return {
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Create standardized success response
   */
  createSuccessResponse: (data: any, message?: string) => {
    return {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Extract user ID from request
   */
  extractUserId: (request: any): string | null => {
    // Try different sources for user ID
    return (
      request.user?.id ||
      request.headers?.["x-user-id"] ||
      request.body?.userId ||
      request.query?.userId ||
      null
    );
  },

  /**
   * Validate session ID format
   */
  validateSessionId: (sessionId: string): boolean => {
    // UUID v4 format validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  },

  /**
   * Rate limiting helper
   */
  createRateLimiter: (maxRequests: number, windowMs: number) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const userRequests = requests.get(identifier);

      if (!userRequests || now > userRequests.resetTime) {
        requests.set(identifier, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (userRequests.count >= maxRequests) {
        return false;
      }

      userRequests.count++;
      return true;
    };
  },
};

/**
 * Route configuration for NUBI agent
 */
export const routeConfig = {
  sessions: {
    basePath: "/api/sessions",
    endpoints: {
      create: "/create",
      message: "/:sessionId/message",
      history: "/:sessionId/history",
      renew: "/:sessionId/renew",
      heartbeat: "/:sessionId/heartbeat",
      delete: "/:sessionId",
      list: "/",
      analytics: "/analytics",
    },
    rateLimits: {
      create: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
      message: { maxRequests: 100, windowMs: 60000 }, // 100 messages per minute
      history: { maxRequests: 30, windowMs: 60000 }, // 30 history requests per minute
    },
  },
  webhooks: {
    basePath: "/webhook",
    endpoints: {
      telegram: "/telegram",
      mcpVerify: "/mcp/verify",
      raidStatus: "/raid/status/:raidId",
      engagementSubmit: "/engagement/submit",
      leaderboard: "/leaderboard/:chatId?",
      health: "/health",
    },
    rateLimits: {
      telegram: { maxRequests: 100, windowMs: 60000 }, // 100 webhooks per minute
      mcpVerify: { maxRequests: 50, windowMs: 60000 }, // 50 verifications per minute
    },
  },
};

// Export default routes interface
export default {
  utils: routeUtils,
  config: routeConfig,
};
