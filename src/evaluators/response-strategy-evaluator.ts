import { Evaluator, IAgentRuntime, Memory, State, logger } from "@elizaos/core";

/**
 * Simple Response Strategy Evaluator that complies with ElizaOS Evaluator interface
 */
export class ResponseStrategyEvaluator implements Evaluator {
  name = "response_strategy";
  description = "Evaluates and determines optimal response delivery strategy";
  alwaysRun = false;
  examples = [];

  async validate(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> {
    // Only evaluate for non-agent messages
    return message.entityId !== runtime.agentId;
  }

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<void> {
    try {
      // Simple strategy evaluation
      const text = (message.content as any)?.text || "";
      const wordCount = text.split(/\s+/).length;

      // Determine if streaming would be beneficial
      const shouldStream =
        wordCount > 50 ||
        text.includes("explain") ||
        text.includes("implement");

      // Store strategy in state for other components
      if (state) {
        (state as any).responseStrategy = {
          shouldStream,
          method: shouldStream ? "stream" : "batch",
          confidence: 0.8,
        };
      }

      logger.debug(
        `[RESPONSE_STRATEGY] Evaluated: ${shouldStream ? "stream" : "batch"} for ${wordCount} words`,
      );
    } catch (error) {
      logger.error(
        "[RESPONSE_STRATEGY] Error:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
