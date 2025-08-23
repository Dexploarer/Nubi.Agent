/**
 * Plugins Module - Plugin system and implementations
 *
 * This module provides the plugin system, plugin management, and
 * all plugin implementations for the NUBI application.
 */

// Re-export core types
export type {
  Plugin,
  Action,
  Evaluator,
  Provider,
  IAgentRuntime,
  Memory,
  State,
} from "../core";

// Import logger as a value
import { Action, Evaluator, logger, Provider } from "../core";

// Extend Plugin interface to include missing properties
export interface ExtendedPlugin extends Plugin {
  actions?: Action[];
  evaluators?: Evaluator[];
  providers?: Provider[];
  services?: any[];
  enabled?: boolean;
}

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
  register(plugin: ExtendedPlugin): void;
  get(name: string): ExtendedPlugin | null;
  getAll(): ExtendedPlugin[];
  enable(name: string): void;
  disable(name: string): void;
  validate(plugin: ExtendedPlugin): boolean;
}

export interface PluginRegistry {
  [key: string]: ExtendedPlugin;
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
export { default as nubiPlugin } from "./nubi-plugin";
export { clickhouseAnalyticsPlugin } from "./clickhouse-analytics";
export { default as twitterMonitorPlugin } from "./twitter-monitor-plugin";
export { default as SessionsPlugin } from "./sessions-plugin";
export { nubiProviders } from "./nubi-providers";

// Plugin manager implementation
export class PluginManagerImpl implements PluginManager {
  private plugins: PluginRegistry = {};
  private pluginStats: Map<string, { loadTime: number; enabled: boolean }> =
    new Map();

  register(plugin: ExtendedPlugin): void {
    try {
      if (this.validate(plugin)) {
        this.plugins[plugin.name] = plugin;
        this.pluginStats.set(plugin.name, {
          loadTime: Date.now(),
          enabled: true,
        });

        logger.info(`✅ Registered plugin: ${plugin.name}`);
      } else {
        logger.error(`❌ Failed to validate plugin: ${plugin.name}`);
      }
    } catch (error) {
      logger.error(
        `Failed to register plugin ${plugin.name}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  get(name: string): ExtendedPlugin | null {
    return this.plugins[name] || null;
  }

  getAll(): ExtendedPlugin[] {
    return Object.values(this.plugins);
  }

  enable(name: string): void {
    try {
      const plugin = this.plugins[name];
      if (plugin) {
        plugin.enabled = true;
        this.pluginStats.set(name, {
          ...this.pluginStats.get(name)!,
          enabled: true,
        });

        logger.info(`✅ Enabled plugin: ${name}`);
      } else {
        logger.warn(`Plugin not found: ${name}`);
      }
    } catch (error) {
      logger.error(
        `Failed to enable plugin ${name}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  disable(name: string): void {
    try {
      const plugin = this.plugins[name];
      if (plugin) {
        plugin.enabled = false;
        this.pluginStats.set(name, {
          ...this.pluginStats.get(name)!,
          enabled: false,
        });

        logger.info(`🛑 Disabled plugin: ${name}`);
      } else {
        logger.warn(`Plugin not found: ${name}`);
      }
    } catch (error) {
      logger.error(
        `Failed to disable plugin ${name}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  validate(plugin: ExtendedPlugin): boolean {
    return !!(
      plugin &&
      plugin.name &&
      plugin.description &&
      (!plugin.actions || Array.isArray(plugin.actions)) &&
      (!plugin.evaluators || Array.isArray(plugin.evaluators)) &&
      (!plugin.providers || Array.isArray(plugin.providers)) &&
      (!plugin.services || Array.isArray(plugin.services))
    );
  }

  getPluginStats(name: string): { loadTime: number; enabled: boolean } | null {
    return this.pluginStats.get(name) || null;
  }

  getAllPluginStats(): Record<string, { loadTime: number; enabled: boolean }> {
    const result: Record<string, { loadTime: number; enabled: boolean }> = {};

    for (const [name, stats] of this.pluginStats.entries()) {
      result[name] = stats;
    }

    return result;
  }
}

// Utility functions
export function createPluginManager(): PluginManager {
  return new PluginManagerImpl();
}

export function validatePlugin(plugin: ExtendedPlugin): boolean {
  return !!(
    plugin &&
    plugin.name &&
    plugin.description &&
    (!plugin.actions || Array.isArray(plugin.actions)) &&
    (!plugin.evaluators || Array.isArray(plugin.evaluators)) &&
    (!plugin.providers || Array.isArray(plugin.providers)) &&
    (!plugin.services || Array.isArray(plugin.services))
  );
}

export function createPluginConfig(
  name: string,
  version: string,
  description: string,
  dependencies: string[] = [],
): PluginConfig {
  return {
    name,
    version,
    description,
    enabled: true,
    dependencies,
    config: {},
  };
}

export function createActionConfig(
  name: string,
  description: string,
  priority: number = 1,
): ActionConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {},
  };
}

export function createEvaluatorConfig(
  name: string,
  description: string,
  priority: number = 1,
): EvaluatorConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {},
  };
}

export function createProviderConfig(
  name: string,
  description: string,
  priority: number = 1,
): ProviderConfig {
  return {
    name,
    description,
    enabled: true,
    priority,
    config: {},
  };
}
