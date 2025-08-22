import {
  Service,
  IAgentRuntime,
  Memory,
  State,
  logger,
  UUID,
  createUniqueUuid,
  ModelType,
  MemoryType,
} from "@elizaos/core";
import MessagingAnalyticsService from "./messaging-analytics-service";

/**
 * ElizaOS Message Processor Service
 *
 * Implements the official 12-step ElizaOS message processing lifecycle:
 * 1. Self-check (prevent self-response loops)
 * 2. Response ID generation
 * 3. Memory storage
 * 4. State composition via providers
 * 5. Should respond evaluation
 * 6. Action matching and execution
 * 7. Response generation
 * 8. Response post-processing
 * 9. Response validation
 * 10. Response memory storage
 * 11. Response delivery
 * 12. Cleanup and analytics
 */

export class ElizaOSMessageProcessor extends Service {
  static serviceType = "elizaos_message_processor" as const;
  capabilityDescription =
    "Official ElizaOS message processing lifecycle implementation";

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<ElizaOSMessageProcessor> {
    const service = new ElizaOSMessageProcessor(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    logger.info(
      "[ELIZAOS_PROCESSOR] Message processor initialized with 12-step lifecycle",
    );
  }

  /**
   * Process message according to ElizaOS 12-step lifecycle
   */
  async processMessage(message: Memory): Promise<{
    success: boolean;
    response?: Memory;
    analytics?: any;
  }> {
    const startTime = Date.now();
    let stepTimes: Record<string, number> = {};

    try {
      // Step 1: Self-check - Prevent response loops
      const step1Start = Date.now();
      if (await this.isSelfMessage(message)) {
        logger.debug(
          "[ELIZAOS_PROCESSOR] Step 1: Self-message detected, skipping",
        );
        return { success: false };
      }
      stepTimes.selfCheck = Date.now() - step1Start;

      // Step 2: Generate response ID
      const step2Start = Date.now();
      const responseId = this.generateResponseId(message);
      stepTimes.idGeneration = Date.now() - step2Start;

      // Step 3: Store incoming message memory
      const step3Start = Date.now();
      await this.storeIncomingMemory(message);
      stepTimes.memoryStorage = Date.now() - step3Start;

      // Step 4: Compose state via providers
      const step4Start = Date.now();
      const state = await this.composeState(message);
      stepTimes.stateComposition = Date.now() - step4Start;

      // Step 5: Evaluate if should respond
      const step5Start = Date.now();
      const shouldRespond = await this.shouldRespond(message, state);
      if (!shouldRespond) {
        logger.debug("[ELIZAOS_PROCESSOR] Step 5: Should not respond");
        return { success: false };
      }
      stepTimes.shouldRespondCheck = Date.now() - step5Start;

      // Step 6: Match and execute actions
      const step6Start = Date.now();
      const actionResult = await this.executeActions(message, state);
      stepTimes.actionExecution = Date.now() - step6Start;

      // Step 7: Generate response
      const step7Start = Date.now();
      const responseContent = await this.generateResponse(
        message,
        state,
        actionResult,
      );
      if (!responseContent) {
        logger.warn("[ELIZAOS_PROCESSOR] Step 7: No response generated");
        return { success: false };
      }
      stepTimes.responseGeneration = Date.now() - step7Start;

      // Step 8: Post-process response
      const step8Start = Date.now();
      const processedResponse = await this.postProcessResponse(
        responseContent,
        state,
      );
      stepTimes.postProcessing = Date.now() - step8Start;

      // Step 9: Validate response
      const step9Start = Date.now();
      const isValidResponse = await this.validateResponse(processedResponse);
      if (!isValidResponse) {
        logger.warn("[ELIZAOS_PROCESSOR] Step 9: Response validation failed");
        return { success: false };
      }
      stepTimes.responseValidation = Date.now() - step9Start;

      // Step 10: Store response memory
      const step10Start = Date.now();
      const responseMemory = await this.storeResponseMemory(
        responseId,
        processedResponse,
        message,
      );
      stepTimes.responseMemoryStorage = Date.now() - step10Start;

      // Step 11: Deliver response (handled by calling service)
      const step11Start = Date.now();
      // Response delivery is handled by the calling service (Sessions API, etc.)
      stepTimes.responseDelivery = Date.now() - step11Start;

      // Step 12: Cleanup and analytics
      const step12Start = Date.now();
      await this.cleanup(message, responseMemory);
      await this.recordAnalytics(
        message,
        responseMemory,
        stepTimes,
        Date.now() - startTime,
      );
      stepTimes.cleanup = Date.now() - step12Start;

      logger.debug(
        `[ELIZAOS_PROCESSOR] Successfully processed message in ${Date.now() - startTime}ms`,
      );

      return {
        success: true,
        response: responseMemory,
        analytics: {
          totalTime: Date.now() - startTime,
          stepTimes,
          responseLength: processedResponse.length,
        },
      };
    } catch (error) {
      logger.error("[ELIZAOS_PROCESSOR] Message processing failed:", error);
      await this.recordAnalytics(
        message,
        null,
        stepTimes,
        Date.now() - startTime,
        error,
      );

      return {
        success: false,
        analytics: {
          totalTime: Date.now() - startTime,
          stepTimes,
          error: error.message,
        },
      };
    }
  }

  /**
   * Step 1: Check if message is from agent itself
   */
  private async isSelfMessage(message: Memory): Promise<boolean> {
    return (
      message.entityId === this.runtime.agentId ||
      message.agentId === this.runtime.agentId
    );
  }

  /**
   * Step 2: Generate unique response ID
   */
  private generateResponseId(message: Memory): UUID {
    return createUniqueUuid(this.runtime, message.entityId || "default");
  }

  /**
   * Step 3: Store incoming message as memory
   */
  private async storeIncomingMemory(message: Memory): Promise<void> {
    try {
      await this.runtime.createMemory(message, "memories", false);
    } catch (error) {
      logger.debug(
        "[ELIZAOS_PROCESSOR] Memory storage failed, continuing:",
        error,
      );
    }
  }

  /**
   * Step 4: Compose state using providers
   */
  private async composeState(message: Memory): Promise<State> {
    try {
      return await this.runtime.composeState(message);
    } catch (error) {
      logger.warn(
        "[ELIZAOS_PROCESSOR] State composition failed, using basic state:",
        error,
      );
      return {
        values: {},
        data: {},
        text: message.content?.text || "",
        userId: message.entityId,
        agentId: message.agentId,
        roomId: message.roomId,
        recentMemories: [],
        agentState: {},
      };
    }
  }

  /**
   * Step 5: Determine if agent should respond
   */
  private async shouldRespond(message: Memory, state: State): Promise<boolean> {
    try {
      // ElizaOS handles shouldRespond logic internally
      // Use simplified logic for this service
      const text = message.content?.text?.toLowerCase() || "";

      // Always respond to direct mentions
      if (text.includes("@nubi") || text.includes("@anubis")) {
        return true;
      }

      // Respond to questions
      if (
        text.includes("?") ||
        text.startsWith("what") ||
        text.startsWith("how")
      ) {
        return true;
      }

      // Respond based on probability for general conversation
      return Math.random() < 0.3;
    } catch (error) {
      logger.warn(
        "[ELIZAOS_PROCESSOR] shouldRespond evaluation failed:",
        error,
      );
      return true; // Default to responding
    }
  }

  /**
   * Step 6: Execute matching actions
   */
  private async executeActions(message: Memory, state: State): Promise<any> {
    try {
      const actions = this.runtime.actions || [];

      for (const action of actions) {
        if (
          action.validate &&
          (await action.validate(this.runtime, message, state))
        ) {
          return await action.handler(
            this.runtime,
            message,
            state,
            {},
            async () => [],
          );
        }
      }

      return null;
    } catch (error) {
      logger.debug("[ELIZAOS_PROCESSOR] Action execution failed:", error);
      return null;
    }
  }

  /**
   * Step 7: Generate response using ElizaOS
   */
  private async generateResponse(
    message: Memory,
    state: State,
    actionResult: any,
  ): Promise<string | null> {
    try {
      // Get dynamic parameters if available
      const dynamicParams = (state as any).dynamicTemperature
        ? {
            temperature: (state as any).dynamicTemperature,
            top_p: (state as any).dynamicTopP || 0.9,
            max_response_length: (state as any).maxTokens || 400,
          }
        : {};

      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        text: message.content?.text || "",
        temperature: dynamicParams.temperature || 0.7,
        max_tokens: dynamicParams.max_response_length || 2000,
        stop: [],
      });

      return response;
    } catch (error) {
      logger.warn("[ELIZAOS_PROCESSOR] Response generation failed:", error);
      return null;
    }
  }

  /**
   * Step 8: Post-process response
   */
  private async postProcessResponse(
    response: string,
    state: State,
  ): Promise<string> {
    try {
      // Apply NUBI personality touches
      let processed = response;

      // Add occasional ancient wisdom references
      if (Math.random() < 0.1) {
        processed += " (ancient wisdom activated)";
      }

      // Apply emotional state modifiers
      const emotionalState = (state as any).nubiContext?.emotionalState;
      if (emotionalState?.current_state === "excited") {
        processed = processed.replace(/\./g, "!");
      }

      return processed;
    } catch (error) {
      logger.debug("[ELIZAOS_PROCESSOR] Post-processing failed:", error);
      return response;
    }
  }

  /**
   * Step 9: Validate response quality
   */
  private async validateResponse(response: string): Promise<boolean> {
    // Basic validation
    if (!response || response.trim().length === 0) return false;
    if (response.length > 2000) return false; // Too long
    if (response.length < 2) return false; // Too short

    // Check for harmful content (basic)
    const harmful = /spam|scam|hack|exploit/i;
    if (harmful.test(response)) return false;

    return true;
  }

  /**
   * Step 10: Store response as memory
   */
  private async storeResponseMemory(
    responseId: UUID,
    response: string,
    originalMessage: Memory,
  ): Promise<Memory> {
    const responseMemory: Memory = {
      id: responseId,
      agentId: this.runtime.agentId,
      entityId: this.runtime.agentId,
      roomId: originalMessage.roomId,
      content: {
        text: response,
        source: "agent_response",
        inReplyTo: originalMessage.id,
      },
      createdAt: Date.now(),
      metadata: {
        type: MemoryType.MESSAGE,
        originalMessageId: originalMessage.id,
        generatedBy: "ElizaOSMessageProcessor",
      },
      unique: true,
    };

    try {
      await this.runtime.createMemory(responseMemory, "memories", true);
    } catch (error) {
      logger.debug(
        "[ELIZAOS_PROCESSOR] Response memory storage failed:",
        error,
      );
    }

    return responseMemory;
  }

  /**
   * Step 12: Cleanup and record analytics
   */
  private async cleanup(message: Memory, response?: Memory): Promise<void> {
    // Perform any necessary cleanup
    // For now, this is minimal
  }

  private async recordAnalytics(
    message: Memory,
    response: Memory | null,
    stepTimes: Record<string, number>,
    totalTime: number,
    error?: Error,
  ): Promise<void> {
    try {
      const analyticsService =
        this.runtime.getService<MessagingAnalyticsService>(
          "messaging_analytics",
        );
      if (
        !analyticsService ||
        typeof (analyticsService as any).trackResponseGeneration !== "function"
      ) {
        return;
      }

      (analyticsService as any).trackResponseGeneration({
        generationTime: totalTime,
        modelClass: "UNKNOWN",
        temperature: 0.8,
        contextUsed: !!stepTimes.stateComposition,
        userRecords: 0,
        semanticMemories: 0,
        emotionalState: "unknown",
        responseLength: response?.content?.text?.length || 0,
        success: !error && !!response,
        error: error?.message,
        stepTimes,
      });
    } catch (analyticsError) {
      logger.debug(
        "[ELIZAOS_PROCESSOR] Analytics recording failed:",
        analyticsError,
      );
    }
  }

  async stop(): Promise<void> {
    logger.info("[ELIZAOS_PROCESSOR] Message processor stopped");
  }
}

export default ElizaOSMessageProcessor;
