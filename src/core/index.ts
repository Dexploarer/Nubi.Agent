/**
 * Core Module - Central exports for all core functionality
 * 
 * This module provides the foundational types, interfaces, and utilities
 * used throughout the NUBI application.
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
} from '@elizaos/core';

// Re-export ElizaOS core values
export { Service, logger } from '@elizaos/core';

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
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NubiError';
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
