import {
  Service,
  IAgentRuntime,
  logger,
  UUID,
  Memory,
  State,
  ModelType,
} from "@elizaos/core";
import { EventEmitter } from "events";
import { NUBISessionsService, Session } from "./nubi-sessions-service";
import { MessageRouter, MessageClassification } from "./message-router";

/**
 * Streaming Sessions Service
 *
 * Provides real-time streaming capabilities for ElizaOS Sessions:
 * - Server-Sent Events (SSE) for HTTP streaming
 * - WebSocket streaming via Socket.IO
 * - Intelligent routing between streaming and batch responses
 * - Progressive response handling with chunks
 * - Context-aware decision making
 */

export interface StreamingConfig {
  enabled: boolean;
  chunkSize: number;
  flushInterval: number;
  maxStreamDuration: number;
  useStreamingThreshold: number; // Estimated tokens before switching to streaming
}

export interface StreamChunk {
  sessionId: string;
  chunkId: string;
  content: string;
  type: "partial" | "complete" | "error" | "metadata";
  metadata?: Record<string, any>;
  timestamp: Date;
  sequenceNumber: number;
}

export interface StreamingSession extends Session {
  streamingConfig: StreamingConfig;
  activeStreams: Map<string, StreamContext>;
}

export interface StreamContext {
  streamId: string;
  sessionId: string;
  startTime: Date;
  chunks: StreamChunk[];
  buffer: string;
  isComplete: boolean;
  error?: Error;
  metadata: Record<string, any>;
}

export interface ResponseStrategy {
  method: "batch" | "stream" | "hybrid";
  reasoning: string;
  estimatedDuration: number;
  estimatedTokens: number;
  confidence: number;
}

export class StreamingSessionsService extends Service {
  static serviceType = "streaming_sessions" as const;
  capabilityDescription =
    "Real-time streaming for ElizaOS Sessions with intelligent routing";

  declare protected runtime: IAgentRuntime;
  private sessionsService!: NUBISessionsService;
  private messageRouter!: MessageRouter;
  private streamEmitter: EventEmitter;
  private activeStreams: Map<string, StreamContext> = new Map();
  private defaultConfig: StreamingConfig = {
    enabled: true,
    chunkSize: 50, // Characters per chunk
    flushInterval: 100, // ms between chunks
    maxStreamDuration: 60000, // 60 seconds max stream
    useStreamingThreshold: 500, // Switch to streaming above 500 tokens
  };

  constructor(
    runtime: IAgentRuntime,
    sessionsService?: NUBISessionsService,
    messageRouter?: MessageRouter,
  ) {
    super(runtime);
    this.runtime = runtime;
    if (sessionsService) {
      this.sessionsService = sessionsService;
    }
    if (messageRouter) {
      this.messageRouter = messageRouter;
    }
    this.streamEmitter = new EventEmitter();
  }

  async start(): Promise<void> {
    try {
      logger.info(
        "[STREAMING_SESSIONS] Starting Streaming Sessions Service...",
      );

      if (!this.runtime) {
        logger.warn(
          "[STREAMING_SESSIONS] No runtime available, service will operate in limited mode",
        );
        return;
      }

      // Get dependencies if not provided
      if (!this.sessionsService) {
        this.sessionsService = this.runtime.getService<NUBISessionsService>(
          "nubi_sessions",
        ) as NUBISessionsService;
        if (!this.sessionsService) {
          throw new Error(
            "NUBISessionsService is required for StreamingSessionsService",
          );
        }
      }

      if (!this.messageRouter) {
        this.messageRouter = new MessageRouter();
      }

      logger.info(
        "[STREAMING_SESSIONS] Streaming Sessions Service started successfully",
      );
    } catch (error) {
      logger.error(
        "[STREAMING_SESSIONS] Failed to start:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info(
        "[STREAMING_SESSIONS] Stopping Streaming Sessions Service...",
      );

      // Clean up active streams
      for (const [streamId, context] of this.activeStreams) {
        await this.endStream(streamId, "Service stopping");
      }

      this.activeStreams.clear();
      this.streamEmitter.removeAllListeners();

      logger.info("[STREAMING_SESSIONS] Streaming Sessions Service stopped");
    } catch (error) {
      logger.error(
        "[STREAMING_SESSIONS] Failed to stop:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Determine the optimal response strategy based on message context
   */
  async determineResponseStrategy(
    message: Memory,
    session: Session,
    classification?: MessageClassification,
  ): Promise<ResponseStrategy> {
    try {
      // Get message classification if not provided
      if (!classification) {
        classification = await this.messageRouter.classifyMessage(
          (message.content as any)?.text || "",
          message.entityId as string,
          "general",
          "stream-route"
        );
      }

      // Estimate complexity based on various factors
      const complexity = await this.estimateComplexity(message, classification);

      // Determine strategy based on complexity and context
      let method: "batch" | "stream" | "hybrid" = "batch";
      let reasoning = "";

      if (
        complexity.estimatedTokens > this.defaultConfig.useStreamingThreshold
      ) {
        method = "stream";
        reasoning = `High token count (${complexity.estimatedTokens}) exceeds streaming threshold`;
      } else if (complexity.requiresAnalysis) {
        method = "hybrid";
        reasoning = "Complex analysis task benefits from progressive updates";
      } else if (complexity.isCodeGeneration) {
        method = "stream";
        reasoning = "Code generation benefits from real-time streaming";
      } else if (complexity.isSimpleQuery) {
        method = "batch";
        reasoning = "Simple query can be answered immediately";
      } else if (session.metadata?.preferStreaming) {
        method = "stream";
        reasoning = "User preference for streaming responses";
      }

      // Check for specific prompt types that benefit from streaming
      const streamingPromptTypes = [
        "technical-expert",
        "crypto-analyst",
        "raid-coordinator-strategic",
        "personality-core-philosophical",
      ];

      if (streamingPromptTypes.includes(classification.selectedPrompt)) {
        method = "stream";
        reasoning = `Prompt type ${classification.selectedPrompt} benefits from streaming`;
      }

      return {
        method,
        reasoning,
        estimatedDuration: complexity.estimatedDuration,
        estimatedTokens: complexity.estimatedTokens,
        confidence: classification.confidenceScore,
      };
    } catch (error) {
      logger.error(
        "[STREAMING_SESSIONS] Failed to determine response strategy:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        method: "batch",
        reasoning: "Error in strategy determination, defaulting to batch",
        estimatedDuration: 1000,
        estimatedTokens: 100,
        confidence: 0.5,
      };
    }
  }

  /**
   * Estimate message complexity for routing decisions
   */
  private async estimateComplexity(
    message: Memory,
    classification: MessageClassification,
  ): Promise<{
    estimatedTokens: number;
    estimatedDuration: number;
    requiresAnalysis: boolean;
    isCodeGeneration: boolean;
    isSimpleQuery: boolean;
  }> {
    const text = (message.content as any)?.text || "";
    const words = text.split(/\s+/).length;

    // Base token estimation (rough approximation)
    let estimatedTokens = words * 1.3;

    // Adjust based on classification
    const complexPrompts = [
      "crypto-analyst",
      "technical-expert",
      "raid-coordinator-strategic",
    ];

    if (complexPrompts.includes(classification.selectedPrompt)) {
      estimatedTokens *= 3; // Complex responses tend to be longer
    }

    // Check for specific indicators
    const requiresAnalysis = /analyze|explain|compare|evaluate|assess/i.test(
      text,
    );
    const isCodeGeneration = /code|implement|function|class|program/i.test(
      text,
    );
    const isSimpleQuery =
      words < 10 && /what|when|where|who|how much/i.test(text);

    // Estimate duration based on tokens (rough approximation)
    const estimatedDuration = estimatedTokens * 20; // 20ms per token

    return {
      estimatedTokens,
      estimatedDuration,
      requiresAnalysis,
      isCodeGeneration,
      isSimpleQuery,
    };
  }

  /**
   * Start a streaming response for a session
   */
  async startStream(
    sessionId: string,
    message: Memory,
    strategy: ResponseStrategy,
  ): Promise<string> {
    const streamId = crypto.randomUUID();

    const context: StreamContext = {
      streamId,
      sessionId,
      startTime: new Date(),
      chunks: [],
      buffer: "",
      isComplete: false,
      metadata: {
        strategy,
        messageId: message.id,
        userId: message.entityId,
      },
    };

    this.activeStreams.set(streamId, context);

    logger.info(
      `[STREAMING_SESSIONS] Started stream ${streamId} for session ${sessionId}`,
    );

    // Emit stream start event
    this.streamEmitter.emit("stream:start", {
      streamId,
      sessionId,
      strategy,
    });

    return streamId;
  }

  /**
   * Send a chunk of data to a stream
   */
  async sendChunk(
    streamId: string,
    content: string,
    type: "partial" | "complete" | "error" | "metadata" = "partial",
  ): Promise<void> {
    const context = this.activeStreams.get(streamId);
    if (!context) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const chunk: StreamChunk = {
      sessionId: context.sessionId,
      chunkId: crypto.randomUUID(),
      content,
      type,
      timestamp: new Date(),
      sequenceNumber: context.chunks.length,
    };

    context.chunks.push(chunk);
    context.buffer += content;

    // Emit chunk event
    this.streamEmitter.emit("stream:chunk", chunk);

    if (type === "complete") {
      context.isComplete = true;
      await this.endStream(streamId, "Stream completed successfully");
    }
  }

  /**
   * End a streaming session
   */
  async endStream(streamId: string, reason?: string): Promise<void> {
    const context = this.activeStreams.get(streamId);
    if (!context) {
      return;
    }

    context.isComplete = true;

    // Emit stream end event
    this.streamEmitter.emit("stream:end", {
      streamId,
      sessionId: context.sessionId,
      reason,
      duration: Date.now() - context.startTime.getTime(),
      totalChunks: context.chunks.length,
      finalContent: context.buffer,
    });

    // Store the complete response in memory if runtime is available
    if (this.runtime && context.buffer) {
      try {
        await this.runtime.createMemory(
          {
            id: crypto.randomUUID() as UUID,
            agentId: context.metadata.agentId || (crypto.randomUUID() as UUID),
            entityId: context.metadata.userId || (crypto.randomUUID() as UUID),
            roomId: context.sessionId as UUID,
            content: {
              text: context.buffer,
              type: "assistant_message",
              streamId,
              metadata: context.metadata,
            },
            embedding: undefined,
            createdAt: Date.now(),
          },
          "memories",
          false,
        );
      } catch (error) {
        logger.error(
          `[STREAMING_SESSIONS] Failed to store stream memory:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    this.activeStreams.delete(streamId);
    logger.info(
      `[STREAMING_SESSIONS] Ended stream ${streamId} for session ${context.sessionId}`,
    );
  }

  /**
   * Process a message with streaming support
   */
  async processStreamingMessage(
    sessionId: string,
    message: Memory,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<string> {
    const session = await this.sessionsService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Classify the message
    const classification = await this.messageRouter.classifyMessage(
      (message.content as any)?.text || "",
      message.entityId as string,
      "general",
      "process-stream"
    );

    // Determine response strategy
    const strategy = await this.determineResponseStrategy(
      message,
      session,
      classification,
    );

    logger.info(
      `[STREAMING_SESSIONS] Using ${strategy.method} strategy for session ${sessionId}: ${strategy.reasoning}`,
    );

    if (strategy.method === "batch") {
      // Use regular processing for batch responses
      return this.processBatchMessage(sessionId, message);
    }

    // Start streaming
    const streamId = await this.startStream(sessionId, message, strategy);

    // Set up chunk listener
    const chunkListener = (chunk: StreamChunk) => {
      if (chunk.sessionId === sessionId) {
        onChunk(chunk);
      }
    };
    this.streamEmitter.on("stream:chunk", chunkListener);

    try {
      // Simulate streaming response (in production, this would connect to LLM streaming API)
      await this.simulateStreamingResponse(streamId, message, strategy);

      const context = this.activeStreams.get(streamId);
      return context?.buffer || "";
    } finally {
      // Clean up listener
      this.streamEmitter.off("stream:chunk", chunkListener);
    }
  }

  /**
   * Process a message without streaming (batch mode)
   */
  private async processBatchMessage(
    sessionId: string,
    message: Memory,
  ): Promise<string> {
    if (!this.runtime) {
      return "Runtime not available for processing";
    }

    const responses: Memory[] = [];
    await this.runtime.processActions(message, responses, undefined, undefined);

    return (responses[0]?.content as any)?.text || "Message processed";
  }

  /**
   * Simulate streaming response (replace with actual LLM streaming in production)
   */
  private async simulateStreamingResponse(
    streamId: string,
    message: Memory,
    strategy: ResponseStrategy,
  ): Promise<void> {
    const sampleResponse = `Based on the ${strategy.method} strategy, I'm processing your request about: "${(message.content as any)?.text}". 
    
    This response is being streamed in real-time to provide you with immediate feedback. 
    The estimated processing time is ${strategy.estimatedDuration}ms for approximately ${strategy.estimatedTokens} tokens.
    
    ${strategy.reasoning}`;

    // Split response into chunks
    const words = sampleResponse.split(" ");
    const chunkSize = 3; // Words per chunk

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words
        .slice(i, Math.min(i + chunkSize, words.length))
        .join(" ");
      await this.sendChunk(streamId, chunk + " ", "partial");

      // Simulate processing delay
      await new Promise((resolve) =>
        setTimeout(resolve, this.defaultConfig.flushInterval),
      );
    }

    // Send completion
    await this.sendChunk(streamId, "", "complete");
  }

  /**
   * Get stream event emitter for external listeners
   */
  getStreamEmitter(): EventEmitter {
    return this.streamEmitter;
  }

  /**
   * Get active stream by ID
   */
  getActiveStream(streamId: string): StreamContext | undefined {
    return this.activeStreams.get(streamId);
  }

  /**
   * Get all active streams for a session
   */
  getSessionStreams(sessionId: string): StreamContext[] {
    return Array.from(this.activeStreams.values()).filter(
      (context) => context.sessionId === sessionId,
    );
  }
}

export default StreamingSessionsService;
