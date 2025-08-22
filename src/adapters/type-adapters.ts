/**
 * Type Adapters
 * Provides type-safe adapters for ElizaOS interfaces
 */

import {
  IAgentRuntime,
  Memory,
  State,
  UUID,
  Content,
  Character,
} from "@elizaos/core";

/**
 * Runtime adapter for safe property access
 */
export class RuntimeAdapter {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Get a setting with type safety
   */
  getSetting<T = any>(key: string, defaultValue?: T): T | undefined {
    try {
      const value = this.runtime.getSetting(key);
      return value !== undefined ? (value as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Check if runtime has a specific service
   */
  hasService(serviceName: string): boolean {
    try {
      return this.runtime.getService(serviceName as any) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get character with defaults
   */
  getCharacter(): Character {
    return this.runtime.character;
  }
}

/**
 * Wraps a Memory to safely access custom properties
 */
export class MemoryWrapper {
  constructor(private memory: Memory) {}

  getUserId(): string {
    // Try multiple paths to get user ID
    return (
      (this.memory as any).userId ||
      (this.memory as any).user?.id ||
      (this.memory as any).agentId ||
      "anonymous"
    );
  }

  getSessionId(): string {
    return (
      (this.memory as any).sessionId ||
      (this.memory.roomId as unknown as string) ||
      "default"
    );
  }

  getRoomId(): UUID {
    return (this.memory.roomId ||
      ("00000000-0000-0000-0000-000000000000" as unknown as UUID)) as UUID;
  }

  getAgentId(): UUID {
    return (this.memory.agentId ||
      ("00000000-0000-0000-0000-000000000000" as unknown as UUID)) as UUID;
  }

  getContent(): Content {
    return this.memory.content;
  }

  getText(): string {
    return this.memory.content?.text || "";
  }

  getAction(): string | null {
    return (this.memory.content?.action as string) || null;
  }

  getCustomProperty<T = unknown>(key: string): T | undefined {
    return (this.memory as unknown as Record<string, unknown>)[key] as T;
  }

  setCustomProperty(key: string, value: unknown): void {
    (this.memory as unknown as Record<string, unknown>)[key] = value;
  }
}

/**
 * State adapter for enhanced state access
 */
export class StateAdapter {
  constructor(private state: State) {}

  /**
   * Get actor names as array
   */
  getActorNames(): string[] {
    const stateRecord = this.state as Record<string, unknown>;
    if (Array.isArray(stateRecord.actorNames)) {
      return stateRecord.actorNames as string[];
    }
    if (typeof this.state.actors === "string") {
      return this.state.actors
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Get recent messages as structured data
   */
  getRecentMessagesData(): Memory[] {
    const stateRecord = this.state as Record<string, unknown>;
    if (Array.isArray(stateRecord.recentMessagesData)) {
      return stateRecord.recentMessagesData as Memory[];
    }
    return [];
  }

  /**
   * Check if state has specific action available
   */
  hasAction(actionName: string): boolean {
    const stateRecord = this.state as Record<string, unknown>;
    const actionNames = (stateRecord.actionNames as string[]) || [];
    return actionNames.includes(actionName);
  }

  /**
   * Get custom state property
   */
  getCustomProperty<T = unknown>(key: string): T | undefined {
    return (this.state as Record<string, unknown>)[key] as T;
  }
}

/**
 * Content builder for creating proper Content objects
 */
export class ContentBuilder {
  private text: string = "";
  private action: string | null = null;
  private metadata: Record<string, unknown> = {};

  setText(text: string): this {
    this.text = text;
    return this;
  }

  setAction(action: string | null): this {
    this.action = action;
    return this;
  }

  addMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  build(): Content {
    const content: Content = {
      text: this.text,
      action: this.action,
    };

    // Add metadata if present
    if (Object.keys(this.metadata).length > 0) {
      (content as any).metadata = this.metadata;
    }

    return content;
  }

  /**
   * Static helper to create Content quickly
   */
  static create(text: string, action?: string | null): Content {
    return {
      text,
      action: action || null,
    };
  }
}

/**
 * UUID utilities
 */
export class UUIDUtils {
  /**
   * Check if string is valid UUID format
   */
  static isValid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Generate a new UUID (v4)
   */
  static generate(): UUID {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as UUID;
  }

  /**
   * Convert string to UUID with validation
   */
  static fromString(str: string): UUID {
    if (!this.isValid(str)) {
      throw new Error(`Invalid UUID format: ${str}`);
    }
    return str as UUID;
  }
}
