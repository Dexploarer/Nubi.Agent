// Main entry point - now using proper ElizaOS project structure
export { default as project } from './project'
export { nubiProjectAgent } from './project'

// Export character from modular structure
export { nubiCharacter } from "./character";

// Export middleware, models, and observability modules
export { middleware, models, observability } from './app'

// Export routes and schemas modules
export { routes, schemas } from './app'

// Export Telegram raiding system
export { default as telegramRaids } from "./telegram-raids";

// Re-export core types for convenience
export type {
  IAgentRuntime,
  Memory,
  State,
  Action,
  HandlerCallback,
  ServiceType,
  UUID,
  Content,
  Character,
  Plugin,
  Evaluator,
  Provider,
  ActionResult,
  ServiceError,
} from "@elizaos/core";
