/**
 * Type Adapters for ElizaOS Compatibility
 * Helps bridge the gap between custom implementations and ElizaOS interfaces
 */

import { 
    HandlerCallback, 
    Content, 
    Memory,
    ActionResult,
    Service,
    IAgentRuntime
} from '@elizaos/core';

/**
 * Adapts a custom callback to ElizaOS HandlerCallback
 */
export function adaptToElizaOSCallback(
    customCallback?: (success: boolean, message: string) => void
): HandlerCallback | undefined {
    if (!customCallback) return undefined;
    
    return async (response: Content, files?: any): Promise<Memory[]> => {
        // Convert Content to string
        const message = typeof response === 'string' 
            ? response 
            : response?.text || 'Action completed';
        
        // Call the custom callback
        customCallback(true, message);
        
        // Return empty memories array (ElizaOS requirement)
        return [];
    };
}

/**
 * Creates a proper ActionResult with defaults
 */
export function createActionResult(
    partial: Partial<ActionResult> = {}
): ActionResult {
    return {
        success: partial.success ?? true,
        text: partial.text,
        values: partial.values,
        data: partial.data,
        error: partial.error
    };
}

/**
 * Wraps a Memory to safely access custom properties
 */
export class MemoryWrapper {
    constructor(private memory: Memory) {}
    
    getUserId(): string {
        // Try multiple paths to get user ID
        return (this.memory as any).userId ||
               (this.memory as any).user?.id ||
               (this.memory as any).agentId ||
               this.memory.userId ||
               'anonymous';
    }
    
    getSessionId(): string {
        return (this.memory as any).sessionId ||
               (this.memory as any).roomId ||
               'default';
    }
}

export default {
    adaptToElizaOSCallback,
    createActionResult,
    MemoryWrapper
};
