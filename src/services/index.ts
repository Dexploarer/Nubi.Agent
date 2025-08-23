/**
 * Services Module - Core service implementations for NUBI Agent
 *
 * This module provides only the services that are actually used and registered
 * in the NUBI plugin. Unused services have been removed to reduce complexity.
 *
 * ARCHITECTURE NOTE:
 * - Only services registered in nubi-plugin.ts are exported here
 * - Services follow ElizaOS Service interface from @elizaos/core
 * - Services use dependency injection via runtime.getService()
 * - Background services handle long-running tasks and integrations
 */

// Import core types and values
import type { IAgentRuntime, Memory } from "../core";
import { Service, logger } from "../core";

// Re-export for convenience
export type { IAgentRuntime, Memory };
export { Service, logger };

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface ServiceRegistry {
  [key: string]: Service;
}

export interface ServiceManager {
  register(service: Service): void;
  get<T extends Service>(serviceType: string): T | null;
  getAll(serviceType: string): Service[];
  start(serviceType: string): Promise<void>;
  stop(serviceType: string): Promise<void>;
}

// Memory service types
export interface MemoryService extends Service {
  createMemory(memory: Memory, tableName?: string): Promise<void>;
  getMemories(options: MemoryQueryOptions): Promise<Memory[]>;
  updateMemory(memory: Memory): Promise<void>;
  deleteMemory(memoryId: string): Promise<void>;
}

export interface MemoryQueryOptions {
  roomId?: string;
  agentId?: string;
  entityId?: string;
  count?: number;
  unique?: boolean;
  tableName?: string;
  filters?: Record<string, unknown>;
}

// Community service types
export interface CommunityService extends Service {
  getMemberProfile(userId: string): Promise<CommunityMember | null>;
  updateMemberProfile(profile: CommunityMember): Promise<void>;
  getRelationships(userId: string): Promise<RelationshipStatus[]>;
  addRelationship(relationship: RelationshipStatus): Promise<void>;
}

export interface CommunityMember {
  id: string;
  username: string;
  platform: string;
  interests: string[];
  influence: number;
  lastSeen: Date;
  metadata: Record<string, unknown>;
}

export interface RelationshipStatus {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  strength: number;
  lastInteraction: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// ACTIVE SERVICES - All services registered in nubi-plugin.ts
// ============================================================================

// Security Services (highest priority)
export { default as SecurityFilter } from "./security-filter";

// AI and Response Generation Services
export { EnhancedResponseGenerator } from "./enhanced-response-generator";

// Session and Memory Management Services
export { SessionsService } from "./sessions-service";
export { DatabaseMemoryService } from "./database-memory-service";

// ElizaOS Sessions API Services
export { NUBISessionsService } from "./nubi-sessions-service";
export { RaidSessionManager } from "./raid-session-manager";
export { SocketIOSessionsService } from "./socket-io-sessions-service";
export { StreamingSessionsService } from "./streaming-sessions-service";
export type {
  StreamingConfig,
  StreamChunk,
  StreamingSession,
  StreamContext,
  ResponseStrategy,
} from "./streaming-sessions-service";
export type {
  SessionConfig,
  Session,
  SessionState,
  RaidSessionConfig,
  RaidObjective,
  RaidSession,
  RaidParticipant,
  RaidProgress,
} from "./nubi-sessions-service";
export type {
  RaidAction,
  RaidMetrics,
  RaidLeaderboardEntry,
  RaidCompletionReport,
} from "./raid-session-manager";
export type {
  SocketSessionData,
  SessionMessage,
  RaidUpdate,
} from "./socket-io-sessions-service";

// Database Connection Management
export { DatabasePoolerManager, PoolType } from "./database-pooler-manager";

// Personality & Emotional Services
export { PersonalityEvolutionService } from "./personality-evolution-service";
export { EmotionalStateService } from "./emotional-state-service";

// Community and Identity Services
export { CommunityManagementService } from "./community-management-service";
export { CrossPlatformIdentityService } from "./cross-platform-identity-service";

// Socket.IO Services
export { SocketIOServerService } from "./socket-io-server";
export { SocketIOClientService } from "./socket-io-client";
export { SocketIOAnalyticsService } from "./socket-io-analytics";

// Pipeline Services
export { MessageRouter } from "./message-router";
export { pipelineAnalytics } from "./clickhouse-pipeline-analytics";

// Optimized Telegram Services
export { default as OptimizedTelegramService } from "../telegram-raids/optimized-telegram-service";
export { default as EnhancedRaidCoordinator } from "../telegram-raids/enhanced-raid-coordinator";
export { default as OptimizedRaidDatabase } from "../telegram-raids/optimized-raid-database";

// ============================================================================
// SERVICE MANAGER IMPLEMENTATION
// ============================================================================

/**
 * Service Manager Implementation
 *
 * Provides centralized service registration and lifecycle management.
 * Used for dependency injection and service discovery.
 */
export class ServiceManagerImpl implements ServiceManager {
  private services: ServiceRegistry = {};

  register(service: Service): void {
    this.services[service.constructor.name] = service;
  }

  get<T extends Service>(serviceType: string): T | null {
    return (this.services[serviceType] as T) || null;
  }

  getAll(serviceType: string): Service[] {
    return Object.values(this.services).filter(
      (service) => service.constructor.name === serviceType,
    );
  }

  async start(serviceType: string): Promise<void> {
    const services = this.getAll(serviceType);
    // Services are already started when constructed, so nothing to do here
    logger.info(`[SERVICE_MANAGER] Services of type ${serviceType} are ready`);
  }

  async stop(serviceType: string): Promise<void> {
    const services = this.getAll(serviceType);
    await Promise.all(services.map((service) => service.stop()));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new service manager instance
 */
export function createServiceManager(): ServiceManager {
  return new ServiceManagerImpl();
}

/**
 * Validate that a service implements the required interface
 */
export function validateService(service: Service): boolean {
  return !!(
    service &&
    typeof service.stop === "function" &&
    service.capabilityDescription
  );
}

/**
 * Get service by type with proper error handling
 */
export function getServiceSafely<T extends Service>(
  runtime: IAgentRuntime,
  serviceType: string,
): T | null {
  try {
    return runtime.getService<T>(serviceType);
  } catch (error) {
    logger.warn(
      `[SERVICES] Failed to get service ${serviceType}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Service categories for organization
 */
export const SERVICE_CATEGORIES = {
  SECURITY: ["security-filter"],
  AI: ["enhanced-response-generator"],
  DATABASE: ["database-memory", "database-pooler-manager"],
  SESSIONS: ["sessions", "nubi-sessions", "raid-session-manager"],
  PERSONALITY: ["personality-evolution", "emotional-state"],
  COMMUNITY: ["community-management", "cross-platform-identity"],
  SOCKET_IO: ["socket-io-server", "socket-io-client", "socket-io-analytics", "socketio-sessions"],
  TELEGRAM: [
    "optimized-telegram",
    "enhanced-raid-coordinator",
    "optimized-raid-database",
  ],
} as const;

/**
 * List of all active services registered in nubi-plugin.ts
 */
export const ACTIVE_SERVICES = [
  "SecurityFilter",
  "EnhancedResponseGenerator",
  "SessionsService",
  "DatabaseMemoryService",
  "DatabasePoolerManager",
  "PersonalityEvolutionService",
  "EmotionalStateService",
  "CommunityManagementService",
  "CrossPlatformIdentityService",
  "SocketIOServerService",
  "SocketIOClientService",
  "SocketIOAnalyticsService",
  "OptimizedTelegramService",
  "EnhancedRaidCoordinator",
  "OptimizedRaidDatabase",
  // ElizaOS Sessions API Services
  "NUBISessionsService",
  "RaidSessionManager", 
  "SocketIOSessionsService",
  "StreamingSessionsService",
] as const;
