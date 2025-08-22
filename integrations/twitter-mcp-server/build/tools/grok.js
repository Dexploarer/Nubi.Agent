import { GrokChatSchema } from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput } from '../utils/validators.js';
export class GrokTools {
    client;
    constructor() {
        this.client = new TwitterClient();
    }
    /**
     * Chat with Grok
     */
    async grokChat(authConfig, args) {
        const params = validateInput(GrokChatSchema, args);
        const response = await this.client.grokChat(authConfig, params.message, params.conversationId, params.returnSearchResults, params.returnCitations);
        return {
            response: response.message,
            conversationId: response.conversationId,
            webResults: response.webResults,
        };
    }
}
//# sourceMappingURL=grok.js.map