import { AuthConfig } from '../types.js';
export declare class GrokTools {
    private client;
    constructor();
    /**
     * Chat with Grok
     */
    grokChat(authConfig: AuthConfig, args: unknown): Promise<{
        response: string;
        conversationId: string;
        webResults: any[] | undefined;
    }>;
}
