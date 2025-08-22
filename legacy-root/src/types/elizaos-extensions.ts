/**
 * Type extensions for ElizaOS
 */

import { IAgentRuntime as BaseRuntime } from '@elizaos/core';

// Use the base runtime as-is
export type IAgentRuntime = BaseRuntime;

// UUID helper function
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Extended Memory type
export interface ExtendedMemory {
    id?: string;
    userId: string;
    content: {
        text: string;
        platform?: string;
        action?: string;
        [key: string]: any;
    };
    roomId: string;
    sessionId?: string;
    createdAt?: number;
}

// Extended Request type for sessions
declare module 'express-serve-static-core' {
    interface Request {
        session?: {
            id: string;
            [key: string]: any;
        };
    }
}
