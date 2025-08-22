/**
 * Messaging Module - Message handling and transport management
 * 
 * This module provides unified message handling across different platforms,
 * transport adapters, and message bus functionality.
 */

// Re-export core types
export type { IAgentRuntime, Service, Memory, logger } from '../core';

// Message types
export interface Message {
  id: string;
  text: string;
  userId?: string;
  roomId?: string;
  platform: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface MessageContext {
  roomId: string;
  platform: string;
  participants: string[];
  lastActivity: number;
  messageCount: number;
  metadata: Record<string, unknown>;
}

// Transport types
export interface Transport {
  name: string;
  isAvailable(): boolean;
  send(message: Message, target?: string): Promise<boolean>;
  receive?(callback: (message: Message) => void): void;
  configure?(config: TransportConfig): void;
}

export interface TransportConfig {
  apiKey?: string;
  baseUrl?: string;
  retries?: number;
  timeout?: number;
  [key: string]: unknown;
}

export interface TransportInfo {
  available: boolean;
  name: string;
  config: TransportConfig;
}

export interface TransportStats {
  transports: Record<string, TransportInfo>;
  totalMessages: number;
  activeRooms: number;
  totalParticipants: number;
}

// Message bus types
export interface MessageBusConfig {
  transports: Transport[];
  retryAttempts: number;
  timeout: number;
  enableLogging: boolean;
}

export interface MessageHandler {
  name: string;
  pattern: RegExp | string;
  handler: (message: Message, context: MessageContext) => Promise<void>;
  priority: number;
}

// Service exports
export { MessageBusService } from './message-bus';

// Transport implementations
export { DiscordTransport } from './transports/discord-transport';
export { TelegramTransport } from './transports/telegram-transport';
export { TwitterTransport } from './transports/twitter-transport';

// Utility functions
export function createMessage(
  text: string,
  platform: string,
  userId?: string,
  roomId?: string,
  metadata?: Record<string, unknown>
): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text,
    userId,
    roomId,
    platform,
    timestamp: Date.now(),
    metadata: metadata || {}
  };
}

export function validateMessage(message: Message): boolean {
  return !!(
    message.id &&
    message.text &&
    message.platform &&
    message.timestamp
  );
}

export function createMessageContext(
  roomId: string,
  platform: string,
  participants: string[] = []
): MessageContext {
  return {
    roomId,
    platform,
    participants,
    lastActivity: Date.now(),
    messageCount: 0,
    metadata: {}
  };
}
