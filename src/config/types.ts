/**
 * Common Configuration Types
 * Shared interfaces and types for configuration management
 */

/**
 * Base configuration manager interface
 */
export interface ConfigManager<T = any> {
  getConfig(): T;
  updateConfig(updates: Partial<T>): void;
  addWatcher?(event: string, callback: () => void): void;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration watcher interface
 */
export interface ConfigWatcher {
  event: string;
  callback: () => void;
}

/**
 * Configuration file metadata
 */
export interface ConfigFileMetadata {
  path: string;
  lastModified: Date;
  size: number;
  checksum?: string;
}
