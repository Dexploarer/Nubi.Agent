import { IAgentRuntime, Memory } from "@elizaos/core";
import { logger } from "@elizaos/core";

export interface TweetResult {
  url: string;
  tweetId: string;
  content: string;
  timestamp: number;
}

export class XPostingService {
  private runtime: IAgentRuntime;
  private twitterClient: any;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Twitter client through the plugin
      this.twitterClient = await this.runtime.getService("twitter");
      if (!this.twitterClient) {
        throw new Error("Twitter service not initialized");
      }
      logger.info("X Posting Service initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize X Posting Service:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async generateContent(): Promise<string> {
    // Generate content using Anubis's personality
    const topics = [
      "Solana ecosystem developments",
      "DeFi innovations and opportunities",
      "Community building in Web3",
      "NFT culture and creativity",
      "Blockchain technology insights",
    ];

    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    // Use Anubis's personality to generate content
    const prompt = `As Anubis, the charismatic leader of the Solana community, create an engaging tweet about ${randomTopic}. 
    Be confident, inspiring, and include a call to action. Keep it under 280 characters.
    Use your personality traits: confident, wise, community-focused.`;

    // For now, use a simple random content generation
    // In production, this would use the model provider
    const response = {
      text: `The Solana ecosystem continues to evolve. ${randomTopic} brings new opportunities for builders and believers. Join us as we shape the future of Web3.`,
    };

    // Add hashtags - Official Anubis.Chat community tags
    const hashtags = "\n\n#AnubisChat #Anubis #anubisai #OpenSource";
    const content = response.text.trim() + hashtags;

    return content.substring(0, 280); // Ensure within Twitter limit
  }

  async postToX(content: string): Promise<TweetResult> {
    try {
      // Post the tweet using the Twitter client
      const tweet = await this.twitterClient.post({
        text: content,
      });

      if (!tweet || !tweet.id) {
        throw new Error("Failed to post tweet - no ID returned");
      }

      // Extract the tweet URL
      const username = process.env.TWITTER_USERNAME || "anubis";
      const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

      logger.info(`Successfully posted to X: ${tweetUrl}`);

      return {
        url: tweetUrl,
        tweetId: tweet.id,
        content: content,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(
        "Failed to post to X:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async generateAndPost(): Promise<TweetResult> {
    try {
      // Generate content
      const content = await this.generateContent();
      logger.info(`Generated content: ${content}`);

      // Post to X
      const result = await this.postToX(content);

      // Store in memory for tracking
      await this.storePostMemory(result);

      return result;
    } catch (error) {
      logger.error(
        "Failed to generate and post:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async storePostMemory(tweet: TweetResult): Promise<void> {
    // Store tweet data for tracking
    // In production, this would use the proper memory manager
    logger.info(`Stored tweet memory: ${tweet.tweetId}`);
  }

  async getRecentPosts(limit: number = 10): Promise<TweetResult[]> {
    // Return empty array for now
    // In production, this would retrieve from memory storage
    return [];
  }
}
