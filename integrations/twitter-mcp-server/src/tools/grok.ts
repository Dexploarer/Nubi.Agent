import { GrokChatSchema, AuthConfig } from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput } from '../utils/validators.js';

// Define type for the validated parameters
type GrokChatParams = {
  message: string;
  conversationId?: string;
  returnSearchResults: boolean;
  returnCitations: boolean;
};

export class GrokTools {
  private client: TwitterClient;

  constructor() {
    this.client = new TwitterClient();
  }

  /**
   * Chat with Grok
   */
  async grokChat(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GrokChatParams>(GrokChatSchema, args);
    const response = await this.client.grokChat(
      authConfig,
      params.message,
      params.conversationId,
      params.returnSearchResults,
      params.returnCitations
    );

    return {
      response: response.message,
      conversationId: response.conversationId,
      webResults: response.webResults,
    };
  }
}
