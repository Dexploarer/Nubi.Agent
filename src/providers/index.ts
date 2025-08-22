/**
 * Providers Module - Context and state providers for NUBI
 *
 * This module provides all context providers, state providers, and
 * dynamic parameter providers for the NUBI application.
 */

// Re-export core types
export type {
  Provider,
  ProviderResult,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";

// Provider exports
export { default as enhancedContextProvider } from "./enhanced-context-provider";
export { default as emotionalStateProvider } from "./emotional-state-provider";
export { default as knowledgeBaseProvider } from "./knowledge-base-provider";
export { default as knowledgeRagProvider } from "./knowledge-rag-provider";
export { default as dynamicModelParametersProvider } from "./dynamic-model-parameters-provider";

// Provider types
export type { EmotionalStateType } from "./emotional-state-provider";

// Import all providers for the nubiProviders array
import enhancedContextProviderImport from "./enhanced-context-provider";
import emotionalStateProviderImport from "./emotional-state-provider";
import knowledgeBaseProviderImport from "./knowledge-base-provider";
import knowledgeRagProviderImport from "./knowledge-rag-provider";
import dynamicModelParametersProviderImport from "./dynamic-model-parameters-provider";

// Export the nubiProviders array for tests and other modules
export const nubiProviders = [
  enhancedContextProviderImport,
  emotionalStateProviderImport,
  knowledgeBaseProviderImport,
  knowledgeRagProviderImport,
  dynamicModelParametersProviderImport,
];

// Provider registry for easy access
export const providerRegistry = {
  enhancedContext: enhancedContextProviderImport,
  emotionalState: emotionalStateProviderImport,
  knowledgeBase: knowledgeBaseProviderImport,
  knowledgeRag: knowledgeRagProviderImport,
  dynamicModelParameters: dynamicModelParametersProviderImport,
} as const;

// Utility functions
export function getProvider(name: string) {
  return providerRegistry[name as keyof typeof providerRegistry];
}

export function getAllProviders() {
  return Object.values(providerRegistry);
}

export function validateProvider(provider: any): boolean {
  return !!(
    provider &&
    provider.name &&
    provider.description &&
    typeof provider.get === "function"
  );
}
