import {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
  ActionResult,
  HandlerCallback,
  logger,
} from "@elizaos/core";
import SecurityFilter from "../services/security-filter";

/**
 * Security Evaluator
 *
 * Runs BEFORE other evaluators to filter out malicious requests,
 * prompt injection attempts, and spam. Protects NUBI from attacks
 * while maintaining character consistency in responses.
 */

export const securityEvaluator: Evaluator = {
  name: "SECURITY_FILTER",
  description:
    "Filters malicious requests and protects against prompt injection and spam",
  examples: [], // Required field for ElizaOS Evaluator

  // Run on ALL incoming messages (highest priority)
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Only process incoming messages from users, not agent's own responses
    const isFromAgent = (message as any).userId === runtime.agentId;
    const hasText = !!message.content?.text;

    return !isFromAgent && hasText;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      // Get SecurityFilter service
      const securityFilter = runtime.getService(
        "security-filter",
      ) as unknown as SecurityFilter;

      if (!securityFilter) {
        logger.warn(
          "[SECURITY_EVALUATOR] SecurityFilter service not available",
        );
        return { success: true, text: "" }; // Allow message through if no security service
      }

      const userId = message.entityId || "anonymous";
      const messageText = message.content.text || "";

      // Process message through security filter
      const securityResult = await securityFilter.processMessage(
        userId,
        messageText,
      );

      if (!securityResult.allowed) {
        logger.warn(
          `[SECURITY_EVALUATOR] Blocked message from ${userId}: ${securityResult.violationType}`,
        );

        // Send security response through callback if available
        if (callback && securityResult.response) {
          await callback({
            text: securityResult.response,
            action: "SECURITY_BLOCKED",
            metadata: {
              violationType: securityResult.violationType,
              userId,
              originalMessage: messageText.substring(0, 100), // Log first 100 chars only
              timestamp: Date.now(),
            },
          });
        }

        // Return blocking result - this should prevent further processing
        return {
          success: false,
          text:
            securityResult.response || "Security filter blocked this request",
          values: {
            blocked: true,
            violationType: securityResult.violationType,
            securityResponse: securityResult.response,
          },
          error: new Error(
            `Security violation: ${securityResult.violationType}`,
          ),
        };
      }

      // Message passed security checks
      logger.debug(
        `[SECURITY_EVALUATOR] Message from ${userId} passed security checks`,
      );

      return {
        success: true,
        text: "", // Empty text means pass-through
        values: {
          securityChecked: true,
          allowed: true,
          userId,
        },
      };
    } catch (error) {
      logger.error(
        "[SECURITY_EVALUATOR] Error:",
        error instanceof Error ? error.message : String(error),
      );

      // On error, allow message through to prevent breaking the bot
      // but log the security failure
      return {
        success: true,
        text: "",
        values: {
          securityError: true,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};

export default securityEvaluator;
