/**
 * Core Module - Central exports for all core functionality
 *
 * This module provides the foundational types, interfaces, and utilities
 * used throughout the NUBI application.
 *
 * ARCHITECTURE NOTE:
 * This module intentionally contains only ElizaOS re-exports and basic utilities.
 * Business logic has been properly separated into dedicated modules:
 * - Raid system: src/telegram-raids/
 * - Services: src/services/
 * - Plugins: src/plugins/
 * - Identity: src/identity/
 *
 * This follows ElizaOS best practices for clean separation of concerns.
 */

// Re-export ElizaOS core types
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

// Re-export ElizaOS core classes and values
export { logger, Service, DatabaseAdapter } from "@elizaos/core";

// Re-export EventHandler as type only (since it's an interface)
export type { EventHandler } from "@elizaos/core";

// Core application types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceConfig {
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ModuleConfig {
  name: string;
  version: string;
  dependencies: string[];
  config: ServiceConfig;
}

// Error types
export class NubiError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NubiError";
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Export service management
export { SupabaseServiceManager } from "./supabase-service-manager";
export { SERVICE_DEFINITIONS } from "./service-definitions";
export type { ServiceDefinition, SystemInfo } from "./supabase-service-manager";
