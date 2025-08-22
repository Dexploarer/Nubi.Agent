// Context Providers
export { default as enhancedContextProvider } from "./enhanced-context-provider";
export { default as emotionalStateProvider } from "./emotional-state-provider";

// Export the nubiProviders for tests and other modules
import enhancedContextProviderImport from "./enhanced-context-provider";
import emotionalStateProviderImport from "./emotional-state-provider";

export const nubiProviders = [
  enhancedContextProviderImport,
  emotionalStateProviderImport
];
