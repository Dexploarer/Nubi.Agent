/**
 * Services Module - Core service implementations
 * 
 * This module provides all service implementations including memory,
 * community management, personality evolution, and other core services.
 */

// Re-export core types
export type { IAgentRuntime, Memory } from '../core';

// Re-export core values
export { Service, logger } from '../core';

// Service types
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

// Service implementations
export { DatabaseMemoryService } from './database-memory-service';
export { CommunityMemoryService } from './community-memory-service';
export { PersonalityEvolutionService } from './personality-evolution-service';
export { EmotionalStateService } from './emotional-state-service';
export { CommunityManagementService } from './community-management-service';
export { EnhancedResponseGenerator } from './enhanced-response-generator';
export { SessionsService } from './sessions-service';
export { ComposeStateService } from './compose-state-service';
export { SocketIOEventsService } from './socket-io-events-service';
export { EnhancedRealtimeService } from './enhanced-realtime-service';
export { MessagingAnalyticsService } from './messaging-analytics-service';
export { ElizaOSMessageProcessor } from './elizaos-message-processor';
export { CrossPlatformIdentityService } from './cross-platform-identity-service';
export { SecurityFilter } from './security-filter';
export { RaidSocketService } from './raid-socket-service';
export { RaidPromptOrchestrator } from './raid-prompt-orchestrator';
export { PersonalityService } from './personality-service';
export { ElizaOSRaidService } from './elizaos-raid-service';
export { SocketIOAnalyticsService } from './socket-io-analytics-enhanced';

// Service manager implementation
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
      service => service.constructor.name === serviceType
    );
  }

  async start(serviceType: string): Promise<void> {
    const services = this.getAll(serviceType);
    await Promise.all(services.map(service => service.start()));
  }

  async stop(serviceType: string): Promise<void> {
    const services = this.getAll(serviceType);
    await Promise.all(services.map(service => service.stop()));
  }
}

// Utility functions
export function createServiceManager(): ServiceManager {
  return new ServiceManagerImpl();
}

export function validateService(service: Service): boolean {
  return !!(
    service &&
    typeof service.start === 'function' &&
    typeof service.stop === 'function'
  );
}
