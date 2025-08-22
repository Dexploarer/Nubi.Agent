import { Buffer } from 'buffer';
import {
  AuthConfig,
  TwitterMcpError,
  TweetResponse,
  ProfileResponse,
  SearchResponse,
  FollowResponse,
  GrokChatResponse
} from './types.js';
import { AuthenticationManager } from './authentication.js';
import { formatTweet, formatProfile, formatSearch } from './utils/formatters.js';
import { SearchMode } from 'agent-twitter-client';

export class TwitterClient {
  private authManager: AuthenticationManager;

  constructor() {
    this.authManager = AuthenticationManager.getInstance();
  }

  /**
   * Get tweets from a user
   */
  async getUserTweets(
    config: AuthConfig,
    username: string,
    count: number,
    includeReplies: boolean = false,
    includeRetweets: boolean = true
  ): Promise<TweetResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const tweetIterator = includeReplies
        ? scraper.getTweets(username, count) // assuming getTweets retrieves both tweets and replies if configured
        : scraper.getTweets(username, count);
      const tweets: any[] = [];
      for await (const tweet of tweetIterator) {
        if (!includeRetweets && tweet.isRetweet) {
          continue;
        }
        tweets.push(tweet);
        if (tweets.length >= count) {
          break;
        }
      }
      return tweets.map(formatTweet);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a tweet by ID
   */
  async getTweetById(
    config: AuthConfig,
    id: string
  ): Promise<TweetResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const tweet = await scraper.getTweet(id);
      if (!tweet) {
        throw new TwitterMcpError(
          `Tweet with ID ${id} not found`,
          'tweet_not_found',
          404
        );
      }
      return formatTweet(tweet);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Search for tweets
   */
  async searchTweets(
    config: AuthConfig,
    query: string,
    count: number,
    searchMode: string = 'Top'
  ): Promise<SearchResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const mode = this.getSearchMode(searchMode);
      const tweets: any[] = [];
      for await (const tweet of scraper.searchTweets(query, count, mode)) {
        tweets.push(tweet);
        if (tweets.length >= count) {
          break;
        }
      }
      return formatSearch(query, tweets);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Send a tweet
   */
  async sendTweet(
    config: AuthConfig,
    text: string,
    replyToTweetId?: string,
    media?: { data: string; mediaType: string }[]
  ): Promise<TweetResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const processedMedia = media?.map(item => ({
        data: Buffer.from(item.data, 'base64'),
        mediaType: item.mediaType
      }));
      const response = await scraper.sendTweet(text, replyToTweetId, processedMedia);
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      const tweetId = responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
      if (!tweetId) {
        throw new TwitterMcpError(
          'Failed to extract tweet ID from response',
          'tweet_creation_error',
          500
        );
      }
      return await this.getTweetById(config, tweetId);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Send a tweet with poll
   */
  async sendTweetWithPoll(
    config: AuthConfig,
    text: string,
    poll: { options: { label: string }[]; durationMinutes: number },
    replyToTweetId?: string
  ): Promise<TweetResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const response = await scraper.sendTweetV2(
        text,
        replyToTweetId,
        { poll }
      );
      if (!response?.id) {
        throw new TwitterMcpError(
          'Failed to create tweet with poll',
          'poll_creation_error',
          500
        );
      }
      return await this.getTweetById(config, response.id);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Like a tweet
   */
  async likeTweet(
    config: AuthConfig,
    id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const scraper = await this.authManager.getScraper(config);
      await scraper.likeTweet(id);
      return {
        success: true,
        message: `Successfully liked tweet with ID ${id}`
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Retweet a tweet
   */
  async retweet(
    config: AuthConfig,
    id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const scraper = await this.authManager.getScraper(config);
      await scraper.retweet(id);
      return {
        success: true,
        message: `Successfully retweeted tweet with ID ${id}`
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Quote a tweet
   */
  async quoteTweet(
    config: AuthConfig,
    text: string,
    quotedTweetId: string,
    media?: { data: string; mediaType: string }[]
  ): Promise<TweetResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const processedMedia = media?.map(item => ({
        data: Buffer.from(item.data, 'base64'),
        mediaType: item.mediaType
      }));
      const response = await scraper.sendQuoteTweet(
        text,
        quotedTweetId,
        processedMedia ? { mediaData: processedMedia } : undefined
      );
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      const tweetId = responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
      if (!tweetId) {
        throw new TwitterMcpError(
          'Failed to extract tweet ID from quote tweet response',
          'quote_tweet_creation_error',
          500
        );
      }
      return await this.getTweetById(config, tweetId);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's profile
   */
  async getUserProfile(
    config: AuthConfig,
    username: string
  ): Promise<ProfileResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profile = await scraper.getProfile(username);
      return formatProfile(profile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Follow a user
   */
  async followUser(
    config: AuthConfig,
    username: string
  ): Promise<FollowResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      await scraper.followUser(username);
      return {
        success: true,
        message: `Successfully followed user @${username}`
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's followers
   */
  async getFollowers(
    config: AuthConfig,
    userId: string,
    count: number
  ): Promise<ProfileResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profiles: any[] = [];
      for await (const profile of scraper.getFollowers(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles.map(formatProfile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's following
   */
  async getFollowing(
    config: AuthConfig,
    userId: string,
    count: number
  ): Promise<ProfileResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profiles: any[] = [];
      for await (const profile of scraper.getFollowing(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles.map(formatProfile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Chat with Grok
   */
  async grokChat(
    config: AuthConfig,
    message: string,
    conversationId?: string,
    returnSearchResults: boolean = true,
    returnCitations: boolean = true
  ): Promise<GrokChatResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
            
      // First, ensure we're authenticated
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Not logged in. Authentication is required for Grok functionality.');
      }
      
      // For cookie authentication, we need to extract the cookies from the config
      let cookies: string[] = [];
      if ('cookies' in config) {
        cookies = config.cookies as string[];
      } else {
        throw new Error('Cookie authentication is required for Grok functionality');
      }
      
      const authToken = cookies.find((c: string) => c.includes('auth_token='))?.split('=')[1]?.split(';')[0];
      const csrfToken = cookies.find((c: string) => c.includes('ct0='))?.split('=')[1]?.split(';')[0];
      
      if (!authToken || !csrfToken) {
        throw new Error('Required authentication cookies not found');
      }
      
      // If no conversation ID is provided, create a new one
      let grokConversationId = conversationId || '';
      if (!grokConversationId) {
        // Create a new Grok conversation using the GraphQL API
        const createConversationResponse = await fetch('https://x.com/i/api/graphql/6cmfJY3d7EPWuCSXWrkOFg/CreateGrokConversation', {
          method: 'POST',
          headers: {
            'authorization': `Bearer AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF`,
            'cookie': cookies.join('; '),
            'x-csrf-token': csrfToken,
            'content-type': 'application/json'
          },
          credentials: 'include'
        }).then(res => res.json());
        
        if (!createConversationResponse?.data?.create_grok_conversation?.conversation_id) {
          throw new Error('Failed to create Grok conversation');
        }
        
        grokConversationId = createConversationResponse.data.create_grok_conversation.conversation_id;
        console.log('Created new Grok conversation:', grokConversationId);
      }
      
      // Prepare the request payload for Grok
      const payload = {
        responses: [
          {
            message,
            sender: 1, // 1 = user
            promptSource: '',
            fileAttachments: []
          }
        ],
        systemPromptName: '',
        grokModelOptionId: 'grok-2a',
        conversationId: grokConversationId,
        returnSearchResults,
        returnCitations,
        promptMetadata: {
          promptSource: 'NATURAL',
          action: 'INPUT'
        },
        imageGenerationCount: 4,
        requestFeatures: {
          eagerTweets: true,
          serverHistory: true
        }
      };
      
      // Send the request to Grok API
      console.log('Sending request to Grok API with payload:', JSON.stringify(payload).substring(0, 200) + '...');
      const response = await fetch('https://api.x.com/2/grok/add_response.json', {
        method: 'POST',
        headers: {
          'authorization': `Bearer AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF`,
          'cookie': cookies.join('; '),
          'x-csrf-token': csrfToken,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      }).then(res => res.text()).then(text => {
        try {
          return JSON.parse(text);
        } catch (e) {
          return { text };
        }
      });
      
      console.log('Received response from Grok API:', JSON.stringify(response).substring(0, 200) + '...');
      
      // Parse the response
      let fullMessage = '';
      let webResults;
      
      // Handle different response formats
      if (response.text) {
        // For streaming responses, split text into chunks and parse each JSON chunk
        const chunks = response.text
          .split('\n')
          .filter(Boolean)
          .map((chunk: string) => {
            try {
              return JSON.parse(chunk);
            } catch (e) {
              console.error('Failed to parse chunk:', chunk);
              return null;
            }
          })
          .filter(Boolean);
        
        // Combine all message chunks into single response
        fullMessage = chunks
          .filter((chunk: any) => chunk.result?.message)
          .map((chunk: any) => chunk.result.message)
          .join('');
        
        // Extract web results if available
        webResults = chunks.find((chunk: any) => chunk.result?.webResults)?.result.webResults;
      } else if (response.result?.message) {
        // For single responses
        fullMessage = response.result.message;
        webResults = response.result.webResults;
      } else if (response.result?.responseType === 'limiter') {
        // Handle rate limiting
        fullMessage = response.result.message || 'Rate limited by Grok';
      } else {
        // Fallback for unexpected response format
        fullMessage = 'Received response from Grok, but could not parse the message.';
        console.error('Unexpected Grok response format:', response);
      }
      
      // Return the response in the expected format
      return {
        conversationId: grokConversationId,
        message: fullMessage || 'No response from Grok',
        webResults: webResults
      };
    } catch (error) {
      console.error('Error in grokChat:', error);
      this.handleError(error);
    }
  }

  /**
   * Helper to convert string search mode to SearchMode enum
   */
  private getSearchMode(mode: string): any {
    switch (mode) {
      case 'Latest':
        return SearchMode.Latest;
      case 'Photos':
        return SearchMode.Photos;
      case 'Videos':
        return SearchMode.Videos;
      case 'Top':
      default:
        return SearchMode.Top;
    }
  }

  /**
   * Centralized error handling
   */
  private handleError(error: unknown): never {
    if (error instanceof TwitterMcpError) {
      throw error;
    }
    console.error('Twitter client error:', error);
    throw new TwitterMcpError(
      `Twitter client error: ${(error as Error).message}`,
      'twitter_client_error',
      500
    );
  }
} 