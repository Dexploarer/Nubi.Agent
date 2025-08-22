/**
 * Model configurations for ElizaOS NUBI Agent
 *
 * Provides standardized model configurations for different use cases
 * with proper typing and provider specifications
 */

// Define ModelConfig interface locally since it's not exported from @elizaos/core
export interface ModelConfig {
  name: string;
  provider: string;
  config: Record<string, unknown>;
}

// Define ModelProvider type if not available from core
type ModelProvider = "openai" | "anthropic" | "google" | "azure";

// Base model configuration interface
export interface NubiModelConfig extends ModelConfig {
  name: string;
  provider: ModelProvider;
  config: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}

// ElizaOS-compliant model configurations
export const TEXT_SMALL: NubiModelConfig = {
  name: "gpt-4o-mini",
  provider: "openai" as ModelProvider,
  config: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  },
};

export const TEXT_LARGE: NubiModelConfig = {
  name: "gpt-4o",
  provider: "openai" as ModelProvider,
  config: {
    temperature: 0.8,
    maxTokens: 4096,
    topP: 0.9,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  },
};

export const TEXT_CREATIVE: NubiModelConfig = {
  name: "gpt-4o",
  provider: "openai" as ModelProvider,
  config: {
    temperature: 0.9,
    maxTokens: 2048,
    topP: 0.95,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
  },
};

export const TEXT_ANALYTICAL: NubiModelConfig = {
  name: "gpt-4o",
  provider: "openai" as ModelProvider,
  config: {
    temperature: 0.3,
    maxTokens: 4096,
    topP: 0.8,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  },
};

// Embedding model configuration
export const TEXT_EMBEDDING: NubiModelConfig = {
  name: "text-embedding-3-small",
  provider: "openai" as ModelProvider,
  config: {
    temperature: 0.0, // Not used for embeddings
    maxTokens: 8192,
  },
};

// Model registry for easy access
export const models = {
  TEXT_SMALL,
  TEXT_LARGE,
  TEXT_CREATIVE,
  TEXT_ANALYTICAL,
  TEXT_EMBEDDING,
} as const;

// Model selection utilities
export const modelUtils = {
  /**
   * Get model by use case
   */
  getModelForUseCase: (
    useCase: "conversation" | "analysis" | "creative" | "embedding",
  ): NubiModelConfig => {
    switch (useCase) {
      case "conversation":
        return TEXT_SMALL;
      case "analysis":
        return TEXT_ANALYTICAL;
      case "creative":
        return TEXT_CREATIVE;
      case "embedding":
        return TEXT_EMBEDDING;
      default:
        return TEXT_SMALL;
    }
  },

  /**
   * Get model by token budget
   */
  getModelByTokenBudget: (maxTokens: number): NubiModelConfig => {
    if (maxTokens <= 2048) return TEXT_SMALL;
    if (maxTokens <= 4096) return TEXT_LARGE;
    return TEXT_LARGE; // Default to large for higher token counts
  },

  /**
   * Validate model configuration
   */
  validateModelConfig: (config: NubiModelConfig): boolean => {
    return !!(
      config.name &&
      config.provider &&
      config.config?.temperature !== undefined &&
      config.config?.maxTokens > 0
    );
  },
};

// Export models for plugin compatibility
export default models;
