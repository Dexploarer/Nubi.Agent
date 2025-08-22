/**
 * Identity Module - User identity management and cross-platform linking
 * 
 * This module handles user identity resolution, cross-platform linking,
 * and user profile management across different platforms.
 */

// Re-export core types
export type { IAgentRuntime, Service, Memory, logger, UUID } from '../core';

// Identity types
export interface UserIdentity {
  id: string;
  internalId: string;
  platform: string;
  platformId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSeen: Date;
}

export interface IdentityLink {
  id: string;
  sourceId: string;
  targetId: string;
  confidence: number;
  evidence: string[];
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  internalId: string;
  preferredName: string;
  platforms: Record<string, UserIdentity>;
  preferences: UserPreferences;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notificationSettings: Record<string, boolean>;
  privacySettings: Record<string, boolean>;
}

// Platform-specific types
export type Platform = 'discord' | 'telegram' | 'twitter' | 'web';

export interface PlatformConfig {
  platform: Platform;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  enabled: boolean;
}

// Service exports
export { UserIdentityService } from './user-identity-service';

// Utility functions
export function createUserIdentity(
  platform: Platform,
  platformId: string,
  username: string,
  metadata?: Record<string, unknown>
): UserIdentity {
  return {
    id: `${platform}:${platformId}`,
    internalId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    platform,
    platformId,
    username,
    metadata: metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeen: new Date()
  };
}

export function validateIdentity(identity: UserIdentity): boolean {
  return !!(
    identity.id &&
    identity.internalId &&
    identity.platform &&
    identity.platformId &&
    identity.username
  );
}
