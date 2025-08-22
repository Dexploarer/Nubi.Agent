/**
 * Plugins Module - Plugin system and implementations
 * 
 * This module provides the plugin system, plugin management, and
 * all plugin implementations for the NUBI application.
 */

// Re-export core types
export type { Plugin, Action, Evaluator, Provider, IAgentRuntime, Memory, State, logger } from '../core';

// Plugin types
export interface PluginConfig {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  dependencies: string[];
  config: Record<string, unknown>;
}

export interface PluginManager {
  register(plugin: Plugin): void;
  get(name: string): Plugin | null;
  getAll(): Plugin[];
  enable(name: string): void;
  disable(name: string): void;
  validate(plugin: Plugin): boolean;
}

export interface PluginRegistry {
  [key: string]: Plugin;
}

// Action types
export interface ActionConfig {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface ActionRegistry {
  [key: string]: Action;
}

// Evaluator types
export interface EvaluatorConfig {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface EvaluatorRegistry {
  [key: string]: Evaluator;
}

// Provider types
export interface ProviderConfig {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface ProviderRegistry {
  [key: string]: Provider;
}

// Plugin implementations
export { nubiPlugin } from './nubi-plugin';
export { clickhouseAnalyticsPlugin } from './clickhouse-analytics-plugin';
export { nubiProviders } from './nubi-providers';

// Plugin manager implementation
export class PluginManagerImpl implements PluginManager {
  private plugins: PluginRegistry = {};

  register(plugin: Plugin): void {
    if (this.validate(plugin)) {
      this.plugins[plugin.name] = plugin;
    }
  }

  get(name: string): Plugin | null {
    return this.plugins[name] || null;
  }

  getAll(): Plugin[] {
    return Object.values(this.plugins);
  }

  enable(name: string): void {
    const plugin = this.plugins[name];
    if (plugin) {
      // Enable plugin logic
    }
  }

  disable(name: string): void {
    const plugin = this.plugins[name];
    if (plugin) {
      // Disable plugin logic
    }
  }

  validate(plugin: Plugin): boolean {
    return !!(
      plugin &&
      plugin.name &&
      plugin.description &&
      Array.isArray(plugin.actions) &&
      Array.isArray(plugin.evaluators) &&
      Array.isArray(plugin.providers) &&
      Array.isArray(plugin.services)
    );
  }
}

// Utility functions
export function createPluginManager(): PluginManager {
  return new PluginManagerImpl();
}

export function validatePlugin(plugin: Plugin): boolean {
  return !!(
    plugin &&
    plugin.name &&
    plugin.description &&
    Array.isArray(plugin.actions) &&
    Array.isArray(plugin.evaluators) &&
    Array.isArray(plugin.providers) &&
    Array.isArray(plugin.services)
  );
}

export function createPluginConfig(
  name: string,
  version: string,
  description: string,
  dependencies: string[] = []
): PluginConfig {
  return {
    name,
    version,
    description,
    enabled: true,
    dependencies,
    config: {}
  };
}

export function createActionConfig(
  name: string,
  description: string,
  priority: number = 1
): ActionConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {}
  };
}

export function createEvaluatorConfig(
  name: string,
  description: string,
  priority: number = 1
): EvaluatorConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {}
  };
}

export function createProviderConfig(
  name: string,
  description: string,
  priority: number = 1
): ProviderConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {}
  };
}
