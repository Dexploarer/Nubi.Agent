import {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
  ActionResult,
  HandlerCallback,
  logger,
} from "@elizaos/core";

/**
 * Community Tracking Evaluator
 *
 * Evaluator that tracks user interactions and community engagement.
 * Works with CommunityManagementService for background analytics.
 */

export const communityTrackingEvaluator: Evaluator = {
  name: "COMMUNITY_TRACKING",
  description: "Tracks user interactions and community engagement patterns",
  examples: [], // Required field for ElizaOS Evaluator

  // Run on incoming user messages
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Only track incoming user messages, not agent responses
    const isFromAgent = (message as any).userId === runtime.agentId;
    return !isFromAgent && !!message.content?.text;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      // Get community management service
      const communityService = runtime.getService("community_management");

      if (communityService) {
        // Extract sentiment from state if available
        const sentiment = state?.sentiment || 0;

        // Track the interaction
        await (communityService as any).trackUserInteraction(
          message,
          sentiment,
        );

        logger.debug(
          `[COMMUNITY_TRACKING] Tracked interaction from user ${message.entityId}`,
        );
      }

      return {
        success: true,
        text: "", // This evaluator doesn't generate responses
        values: {
          tracked: !!communityService,
          userId: message.entityId,
          messageLength: message.content.text?.length || 0,
        },
      };
    } catch (error) {
      logger.error("[COMMUNITY_TRACKING] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
};

export default communityTrackingEvaluator;
