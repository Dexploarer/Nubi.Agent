import {
  GetUserTweetsSchema,
  GetTweetByIdSchema,
  SearchTweetsSchema,
  SendTweetSchema,
  SendTweetWithPollSchema,
  LikeTweetSchema,
  RetweetSchema,
  QuoteTweetSchema,
  AuthConfig,
} from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput, validateMediaData, validatePollOptions } from '../utils/validators.js';

// Define types for the validated parameters
type GetUserTweetsParams = {
  username: string;
  count: number;
  includeReplies: boolean;
  includeRetweets: boolean;
};

type GetTweetByIdParams = {
  id: string;
};

type SearchTweetsParams = {
  query: string;
  count: number;
  searchMode: string;
};

type SendTweetParams = {
  text: string;
  replyToTweetId?: string;
  media?: { data: string; mediaType: string }[];
};

type SendTweetWithPollParams = {
  text: string;
  replyToTweetId?: string;
  poll: {
    options: { label: string }[];
    durationMinutes: number;
  };
};

type LikeTweetParams = {
  id: string;
};

type RetweetParams = {
  id: string;
};

type QuoteTweetParams = {
  text: string;
  quotedTweetId: string;
  media?: { data: string; mediaType: string }[];
};

export class TweetTools {
  private client: TwitterClient;

  constructor() {
    this.client = new TwitterClient();
  }

  /**
   * Get tweets from a user
   */
  async getUserTweets(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetUserTweetsParams>(GetUserTweetsSchema, args);
    const tweets = await this.client.getUserTweets(
      authConfig,
      params.username,
      params.count,
      params.includeReplies,
      params.includeRetweets
    );

    return {
      tweets,
      count: tweets.length,
      username: params.username,
    };
  }

  /**
   * Get a specific tweet by ID
   */
  async getTweetById(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetTweetByIdParams>(GetTweetByIdSchema, args);
    const tweet = await this.client.getTweetById(authConfig, params.id);

    return {
      tweet,
    };
  }

  /**
   * Search for tweets
   */
  async searchTweets(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<SearchTweetsParams>(SearchTweetsSchema, args);
    const searchResults = await this.client.searchTweets(
      authConfig,
      params.query,
      params.count,
      params.searchMode
    );

    return searchResults;
  }

  /**
   * Send a tweet
   */
  async sendTweet(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<SendTweetParams>(SendTweetSchema, args);

    // Validate media if present
    if (params.media && params.media.length > 0) {
      validateMediaData(params.media);
    }

    const tweet = await this.client.sendTweet(
      authConfig,
      params.text,
      params.replyToTweetId,
      params.media
    );

    return {
      tweet,
      success: true,
      message: 'Tweet sent successfully',
    };
  }

  /**
   * Post a viral raid tweet and return the permanent X link
   */
  async postRaidTweet(authConfig: AuthConfig, args: unknown) {
    // expects: { message: string, hashtags?: string[] }
    const input = args as { message: string; hashtags?: string[] };
    if (!input?.message || typeof input.message !== 'string') {
      throw new Error('message is required');
    }
    const tags = (
      input.hashtags && Array.isArray(input.hashtags)
        ? input.hashtags
        : ['#AnubisChat', '#Anubis', '#anubisai', '#OpenSource']
    ).join(' ');

    const text = `${input.message}

${tags}`.trim();
    const tweet = await this.client.sendTweet(authConfig, text);
    return {
      success: true,
      tweet,
      x_link: tweet.permanentUrl,
      message: 'Raid tweet posted successfully',
    };
  }

  /**
   * Send a tweet with poll
   */
  async sendTweetWithPoll(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<SendTweetWithPollParams>(SendTweetWithPollSchema, args);

    // Validate poll options
    validatePollOptions(params.poll.options);

    const tweet = await this.client.sendTweetWithPoll(
      authConfig,
      params.text,
      params.poll,
      params.replyToTweetId
    );

    return {
      tweet,
      success: true,
      message: 'Tweet with poll sent successfully',
    };
  }

  /**
   * Like a tweet
   */
  async likeTweet(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<LikeTweetParams>(LikeTweetSchema, args);
    const result = await this.client.likeTweet(authConfig, params.id);

    return result;
  }

  /**
   * Retweet a tweet
   */
  async retweet(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<RetweetParams>(RetweetSchema, args);
    const result = await this.client.retweet(authConfig, params.id);

    return result;
  }

  /**
   * Quote a tweet
   */
  async quoteTweet(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<QuoteTweetParams>(QuoteTweetSchema, args);

    // Validate media if present
    if (params.media && params.media.length > 0) {
      validateMediaData(params.media);
    }

    const tweet = await this.client.quoteTweet(
      authConfig,
      params.text,
      params.quotedTweetId,
      params.media
    );

    return {
      tweet,
      success: true,
      message: 'Quote tweet sent successfully',
    };
  }
}
