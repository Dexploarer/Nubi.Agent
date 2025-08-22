/**
 * Telegram Raiding System - Complete Integration
 *
 * This module provides comprehensive Telegram raid coordination with:
 * - MCP server integration for X/Twitter posting
 * - Enhanced raid management and tracking
 * - Community engagement verification
 * - Multi-platform raid orchestration
 */

// Core Services
import { RaidTracker } from "./raid-tracker";
import { RaidCoordinator } from "./raid-coordinator";
import { EngagementVerifier } from "./engagement-verifier";
import { LeaderboardService } from "./leaderboard-service";
import { RaidModerationService } from "./raid-moderation-service";
import { ChatLockManager } from "./chat-lock-manager";
import { LinkDetectionService } from "./link-detection-service";

// Enhanced ElizaOS Integration
import { EnhancedTelegramRaidsService } from "./elizaos-enhanced-telegram-raids";

// Legacy Plugin (for backward compatibility)
import anubisRaidPlugin from "./anubis-raid-plugin";

// Raid Flow Services
import { AnubisRaidFlow as RaidFlow } from "./raid-flow";
import { UserInitiatedRaidFlow } from "./user-initiated-raid-flow";

// Re-export all components
export { RaidTracker } from "./raid-tracker";
export { RaidCoordinator } from "./raid-coordinator";
export { EngagementVerifier } from "./engagement-verifier";
export { LeaderboardService } from "./leaderboard-service";
export { RaidModerationService } from "./raid-moderation-service";
export { ChatLockManager } from "./chat-lock-manager";
export { LinkDetectionService } from "./link-detection-service";
export { EnhancedTelegramRaidsService } from "./elizaos-enhanced-telegram-raids";
export { default as anubisRaidPlugin } from "./anubis-raid-plugin";
export { AnubisRaidFlow as RaidFlow } from "./raid-flow";
export { UserInitiatedRaidFlow } from "./user-initiated-raid-flow";

// Types
export type { RaidConfig } from "./raid-coordinator";
export type { RaidSession, RaidParticipant, RaidStats } from "./raid-tracker";

// Default export for main module
const telegramRaids = {
  RaidTracker,
  RaidCoordinator,
  EngagementVerifier,
  LeaderboardService,
  RaidModerationService,
  ChatLockManager,
  LinkDetectionService,
  EnhancedTelegramRaidsService,
  anubisRaidPlugin,
  RaidFlow,
  UserInitiatedRaidFlow,
};

export default telegramRaids;
