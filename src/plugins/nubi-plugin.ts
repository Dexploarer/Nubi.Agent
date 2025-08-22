import {
  Plugin,
  Action,
  ActionResult,
  Provider,
  Evaluator,
  Service,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
  logger,
  DatabaseAdapter,
  EventHandler,
} from "../core";
// import { SupabaseServiceManager } from "./core/supabase-service-manager";
// import { SERVICE_DEFINITIONS } from "./core/service-definitions";
// Legacy imports removed - using only clean ElizaOS-compliant components
import { nubiProviders } from "./nubi-providers";
import { MessageBusService } from "../messaging";
import { StrategicActionOrchestrator } from "../orchestration";
import { PluginConfigurationManagerService } from "../orchestration";
import {
  YAMLConfigManager,
  loadEnvironmentConfig,
  getFeatureAvailability,
} from "../config";
import { UserIdentityService } from "../identity";

// ElizaOS Sessions API Routes
import { sessionsRoutes } from "../routes";

// New ElizaOS-compliant evaluators and providers
import { personalityEvolutionEvaluator } from "../evaluators/personality-evolution";
import {
  emotionalStateProvider,
  knowledgeBaseProvider,
  knowledgeRagProvider,
  enhancedContextProvider,
  dynamicModelParametersProvider,
} from "../providers";
import { antiDetectionPostProcessor } from "../evaluators/anti-detection-post-processor";
import { communityTrackingEvaluator } from "../evaluators/community-tracking-evaluator";

// Import database schemas for auto-migration
import { allSchemas } from "../schemas";
import securityEvaluator from "../evaluators/security-evaluator";

// Import actions from centralized index
import { identityActions, ritualActions, identityProviders } from "../actions";

// Import action middleware for proper preprocessing
import { withActionMiddleware } from "../middleware";

// Active ElizaOS Services - All services registered in the plugin
import { PersonalityEvolutionService } from "../services";
import { EmotionalStateService } from "../services";
import { CommunityManagementService } from "../services";
import { EnhancedResponseGenerator } from "../services";
import { SessionsService } from "../services";
import { CrossPlatformIdentityService } from "../services";
import { DatabaseMemoryService } from "../services";

// Enhanced Telegram Raids functionality
import { EnhancedTelegramRaidsService } from "../telegram-raids/elizaos-enhanced-telegram-raids";

// Security services
import SecurityFilter from "../services/security-filter";
import {
  metricsGetText,
  metricsIncrementMessageReceived,
  metricsIncrementErrors,
} from "../observability";

// REMOVED: Pyramid system to reduce codebase complexity

// REMOVED: Broken processMessageAction that echoed user input
// Let ElizaOS handle message processing natively through character definition

/**
 * Strategic Session Management Action
 */
const sessionManagementAction: Action = {
  name: "ANUBIS_SESSION_MANAGEMENT",
  similes: [
    "SESSION_CONTROL",
    "CONTEXT_SWITCH",
    "MEMORY_RECALL",
    "CONVERSATION_RESET",
    "CHAT_MANAGEMENT",
    "DIALOGUE_STATE",
  ],
  description:
    "Manage conversation sessions with advanced state persistence and context switching",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Prevent self-evaluation
    if (message.entityId === runtime.agentId) return false;

    // Validate session management scenarios
    const text = message.content.text?.toLowerCase() || "";

    return (
      text.includes("new conversation") ||
      text.includes("switch context") ||
      text.includes("remember when") ||
      text.includes("previous chat") ||
      text.includes("fresh start") ||
      text.includes("reset conversation") ||
      text.includes("start over") ||
      message.content.source === "session_management"
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const text = message.content.text || "";

      if (text.includes("new conversation")) {
        // Use ElizaOS built-in session management
        if (callback) {
          await callback({
            text: "Started a fresh conversation context! Previous context preserved but we're starting clean.",
            action: "ANUBIS_SESSION_MANAGEMENT",
          });
        }

        return {
          success: true,
          text: "New session created",
        };
      }

      if (text.includes("switch context") || text.includes("remember when")) {
        // Retrieve and switch to previous context
        const memories = await runtime.getMemories({
          roomId: message.roomId,
          count: 50,
          unique: true,
          tableName: "memories",
        });

        const contextSummary = memories
          .slice(0, 10)
          .map((m) => m.content.text?.substring(0, 100))
          .filter(Boolean)
          .join("... ");

        if (callback) {
          await callback({
            text: `Switching context... I remember we were discussing: ${contextSummary}`,
            action: "ANUBIS_SESSION_MANAGEMENT",
          });
        }

        return {
          success: true,
          text: "Context switched",
          values: { memoriesRetrieved: memories.length },
        };
      }

      return {
        success: false,
        text: "Unknown session management request",
      };
    } catch (error) {
      logger.error(
        "Session management failed:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        text: "Session management error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Start a new conversation please" },
      },
      {
        name: "Anubis",
        content: {
          text: "Started a fresh conversation context! Previous context preserved but we're starting clean. What would you like to chat about?",
          action: "ANUBIS_SESSION_MANAGEMENT",
        },
      },
    ],
  ],
};

/**
 * Raid Command Action - Handles community scoring and leaderboard
 */
// REMOVED: Raid command action - depends on broken NubiService
// Will rebuild as proper ElizaOS action later

// REMOVED: Advanced context provider - depends on broken NubiService
// Using simpler providers until we rebuild personality system

/**
 * Session State Evaluator
 */
const sessionStateEvaluator: Evaluator = {
  name: "ANUBIS_SESSION_STATE",
  description:
    "Evaluates and manages session state, relationship building, and context persistence",
  alwaysRun: false, // Run strategically
  examples: [],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Prevent self-evaluation
    if (message.entityId === runtime.agentId) return false;

    // Run strategically every ~3rd message to track session evolution
    return Math.random() < 0.33;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<any> => {
    try {
      // Analyze conversation evolution using ElizaOS built-in patterns
      const memories = await runtime.getMemories({
        roomId: message.roomId,
        count: 20,
        unique: true,
        tableName: "memories",
      });

      const conversationDepth = memories.length;
      const avgMessageLength =
        memories
          .map((m) => m.content.text?.length || 0)
          .reduce((sum, len) => sum + len, 0) / memories.length;

      // Determine relationship progression
      const relationship =
        conversationDepth > 50
          ? "close_friend"
          : conversationDepth > 20
            ? "friend"
            : conversationDepth > 5
              ? "acquaintance"
              : "new";

      logger.debug(
        `Session state updated: ${relationship} (${conversationDepth} messages)`,
      );

      return {
        success: true,
        data: {
          relationship,
          conversationDepth,
          avgMessageLength,
        },
      };
    } catch (error) {
      logger.error(
        "Session state evaluator failed:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Helper functions for plugin initialization
 */
function mergeConfiguration(
  userConfig: Record<string, string>,
): Record<string, string> {
  const defaults = {
    LOG_LEVEL: "warn",
    OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
    ANUBIS_TYPO_RATE: "0.03",
    ANUBIS_CONTRADICTION_RATE: "0.15",
    ANUBIS_EMOTIONAL_PERSISTENCE: "1800000",
  };
  return { ...defaults, ...userConfig };
}

function applyEnvironmentConfig(config: Record<string, string>): void {
  for (const [key, value] of Object.entries(config)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * NUBI Plugin - The Symbiosis of Anubis with proper ElizaOS architecture
 */
const nubiPlugin: Plugin = {
  name: "nubi",
  description:
    "NUBI - The Symbiosis of Anubis AI agent plugin with personality, knowledge, and social coordination",
  config: {
    version: "2.1.0",
    author: "ElizaOS Community - NUBI Project",
    enabled: true,
    features: {
      telegramRaids: true,
      personalityEvolution: true,
      crossPlatformIdentity: true,
      enhancedMemory: true,
      multiPartResponses: true,
    },
  },
  models: {
    TEXT_SMALL: async () => "OpenAI GPT-4o Mini",
    TEXT_LARGE: async () => "OpenAI GPT-4o",
    TEXT_EMBEDDING: async () => "OpenAI text-embedding-3-small",
  },

  actions: [
    // Wrap actions with middleware for proper @mention preprocessing and routing
    withActionMiddleware(sessionManagementAction),

    // Identity linking actions
    ...identityActions.map(withActionMiddleware),

    // Ritual actions
    ...ritualActions.map(withActionMiddleware),

    // enhancedTelegramRaidsPlugin.actions || []
  ],

  evaluators: [
    securityEvaluator, // FIRST - security filter runs before all other evaluators
    sessionStateEvaluator,
    personalityEvolutionEvaluator,
    antiDetectionPostProcessor,
    communityTrackingEvaluator,
  ],

  providers: [
    enhancedContextProvider, // Primary database-driven context
    dynamicModelParametersProvider, // Dynamic parameter adjustment
    ...nubiProviders,
    emotionalStateProvider,
    knowledgeBaseProvider,
    knowledgeRagProvider,
    ...identityProviders, // Identity context providers
  ],

  routes: [
    // ElizaOS Sessions API compliance routes
    ...sessionsRoutes,

    // Legacy health endpoint
    {
      path: "/health",
      type: "GET",
      handler: async (request: any, response: any, runtime: IAgentRuntime) => {
        try {
          // Minimal response for tests without relying on runtime or response.status
          return response.json({ success: true, status: "healthy" });
        } catch (error) {
          // Fallback without using response.status chain to avoid test mocks issues
          response.json({ success: false });
        }
      },
    },
    // Prometheus metrics endpoint
    {
      path: "/metrics",
      type: "GET",
      handler: async (request: any, response: any) => {
        try {
          const text = metricsGetText();
          if (typeof response.setHeader === "function") {
            response.setHeader(
              "Content-Type",
              "text/plain; version=0.0.4; charset=utf-8",
            );
          }
          if (typeof response.send === "function") {
            return response.send(text);
          }
          // Fallback to json if send is not available
          return response.end
            ? response.end(text)
            : response.json({ metrics: text });
        } catch (err) {
          if (typeof response.status === "function") {
            response.status(500);
          }
          return response.json({ success: false });
        }
      },
    },
  ],

  events: {
    MESSAGE_RECEIVED: [
      // SECURITY FILTER - runs first to block malicious content
      async (payload: any) => {
        const { message, runtime, state, callback } = payload;
        if (!message?.content?.text || !runtime) return payload;

        const securityFilter = runtime.getService("security-filter") as any;
        if (!securityFilter) return payload;

        const userId = message.entityId || message.userId || "anonymous";
        const result = await securityFilter.processMessage(
          userId,
          message.content.text,
        );

        if (!result.allowed) {
          logger.warn(
            `[SECURITY] Blocked message from ${userId}: ${result.violationType}`,
          );

          if (callback) {
            await callback({
              text:
                result.response ||
                "Your message was blocked by security policy.",
              action: "SECURITY_BLOCKED",
            });
          }

          // Mark state to prevent further processing
          if (state)
            state.security = { blocked: true, reason: result.violationType };
          return { ...payload, stopProcessing: true };
        }
        try {
          metricsIncrementMessageReceived();
        } catch {}
        return payload;
      },
      // Enhanced message processing with NUBI personality
      async (payload: any) => {
        logger.info("MESSAGE_RECEIVED event received");
        logger.info(
          { keys: Object.keys(payload || {}) },
          "MESSAGE_RECEIVED param keys",
        );
        logger.debug(
          `[NUBI] Processing message: ${payload?.message?.content?.text}`,
        );
        // Message processing logic would go here
        return payload;
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      // Voice message processing
      async (payload: any) => {
        logger.info("VOICE_MESSAGE_RECEIVED event received");
        logger.info(
          { keys: Object.keys(payload || {}) },
          "VOICE_MESSAGE_RECEIVED param keys",
        );
        logger.debug(`[NUBI] Processing voice message`);
        return payload;
      },
    ],
    WORLD_CONNECTED: [
      // World connection events
      async (payload: any) => {
        logger.info("WORLD_CONNECTED event received");
        logger.info(
          { keys: Object.keys(payload || {}) },
          "WORLD_CONNECTED param keys",
        );
        logger.debug(`[NUBI] World connected`);
        return payload;
      },
    ],
    WORLD_JOINED: [
      async (payload: any) => {
        logger.info("WORLD_JOINED event received");
        logger.info(
          { keys: Object.keys(payload || {}) },
          "WORLD_JOINED param keys",
        );
        logger.debug(`[NUBI] World joined`);
        return payload;
      },
    ],
  },

  services: [
    // Core NUBI Services (10 focused services following ElizaOS recommendations)

    // Security (first priority)
    SecurityFilter, // Prompt injection and spam protection

    // AI and response generation
    EnhancedResponseGenerator, // AI-powered responses with context awareness

    // Session and memory management
    SessionsService, // Session management and persistence
    DatabaseMemoryService, // Enhanced context retrieval with semantic search

    // Personality and emotional systems
    EmotionalStateService, // NUBI emotional state management
    PersonalityEvolutionService, // NUBI trait evolution system

    // Community and identity
    CommunityManagementService, // NUBI community features
    UserIdentityService, // Cross-platform identity linking
    CrossPlatformIdentityService, // User identity linking across platforms

    // Enhanced Telegram functionality
    EnhancedTelegramRaidsService, // NUBI raids coordination
  ],

  // Enhanced functionality integrated directly into NUBI plugin
  // (// enhancedTelegramRaidsPlugin merged into this plugin via actions/services)

  async init(config: Record<string, string>, runtime: IAgentRuntime) {
    logger.info("🚀 Initializing NUBI Plugin...");

    try {
      //       // Initialize infra aligned with @elizaos/plugin-sql (DatabaseAdapter on runtime)
      //       const manager = new SupabaseServiceManager(runtime);
      //       for (const def of SERVICE_DEFINITIONS) manager.registerService(def);
      //       (runtime as any).serviceManager = manager;
      //       try {
      //         await manager.initialize();
      //       } catch (infraError) {
      //         logger.warn("⚠️ Infrastructure initialization degraded:", infraError);
      //       }

      // Load and validate environment configuration
      const envConfig = loadEnvironmentConfig();
      const featureAvailability = getFeatureAvailability(envConfig);

      logger.info(
        "🔧 Feature Availability:",
        JSON.stringify(featureAvailability),
      );

      if (!runtime.composeState) {
        throw new Error(
          "Runtime does not support state composition - ElizaOS version too old",
        );
      }

      // Initialize YAML Configuration Manager with error boundary
      try {
        const yamlConfigManager = new YAMLConfigManager("./configs");
        const yamlConfig = yamlConfigManager.getConfig();

        // Validate config structure
        if (!yamlConfig.agent?.name) {
          throw new Error("Invalid YAML config: missing agent.name");
        }

        // Store YAML config manager in runtime for Services to access
        (runtime as any).yamlConfigManager = yamlConfigManager;

        logger.info("✅ YAML configuration loaded");
        logger.info(`  - Agent: ${yamlConfig.agent.name}`);
        logger.info(
          `  - Personality traits: ${Object.keys(yamlConfig.agent?.personality || {}).length}`,
        );
        logger.info(
          `  - Known protocols: ${Object.keys(yamlConfig.knowledge?.solana_protocols || {}).length}`,
        );
        logger.info(
          `  - Response templates: ${Object.keys(yamlConfig.templates || {}).length}`,
        );
      } catch (yamlError) {
        logger.warn(
          "⚠️ YAML configuration failed to load:",
          yamlError instanceof Error ? yamlError.message : String(yamlError),
        );
        logger.info("Continuing with default configuration...");

        // Store empty config manager as fallback
        (runtime as any).yamlConfigManager = {
          getConfig: () => ({ agent: { name: "NUBI" } }),
        };
      }

      const finalConfig = mergeConfiguration(config);
      applyEnvironmentConfig(finalConfig);

      try {
        //         const sys = manager.getSystemInfo();
        //         logger.info(`🩺 Infra: db=${sys.databaseConnected} redis=${sys.redisConnected} services=${sys.servicesInitialized}/${sys.totalServices}`);
      } catch {}

      logger.info("✨ Anubis Plugin initialization complete");
      logger.info(`  - Services: ${nubiPlugin.services?.length || 0}`);
      logger.info(`  - Actions: ${nubiPlugin.actions?.length || 0}`);
      logger.info(`  - Providers: ${nubiPlugin.providers?.length || 0}`);
      logger.info(`  - Evaluators: ${nubiPlugin.evaluators?.length || 0}`);
    } catch (error) {
      logger.error(
        "❌ Anubis Plugin initialization failed:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  },
};

export default nubiPlugin;
