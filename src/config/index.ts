/**
 * Configuration Module Index
 * Centralized exports for all configuration utilities and types
 */

// Environment configuration
export {
  loadEnvironmentConfig,
  getFeatureAvailability,
  defaultEnvironment,
  type EnvironmentConfig,
} from './environment';

// YAML configuration manager
export { default as YAMLConfigManager } from './yaml-config-manager';
export type {
  AnubisConfig,
  PluginConfig,
  KnowledgeConfig,
  ProtocolInfo,
  ResponseTemplates,
  TemplateStructure,
} from './yaml-config-manager';

// Re-export common types for convenience
export type { ConfigManager } from './types';
