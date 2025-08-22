/**
 * Actions Index
 * Centralized exports for all ElizaOS actions
 */

// Identity linking actions
export {
  linkAccountAction,
  unlinkAccountAction,
  showLinkedAccountsAction,
  verificationCodeAction,
  identityActions,
  identityContextProvider,
  identityProviders,
} from "./identity-linking-actions";

// Ritual actions
export {
  ritualAction,
  recordAction,
  ritualActions,
} from "./elizaos-ritual-action";

// Re-export types for convenience
export type { Action, ActionResult, HandlerCallback } from "@elizaos/core";
