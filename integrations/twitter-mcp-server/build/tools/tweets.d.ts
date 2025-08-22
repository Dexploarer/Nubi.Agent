import { AuthConfig } from '../types.js';
export declare class TweetTools {
    private client;
    constructor();
    /**
     * Get tweets from a user
     */
    getUserTweets(authConfig: AuthConfig, args: unknown): Promise<{
        tweets: import("../types.js").TweetResponse[];
        count: number;
        username: string;
    }>;
    /**
     * Get a specific tweet by ID
     */
    getTweetById(authConfig: AuthConfig, args: unknown): Promise<{
        tweet: import("../types.js").TweetResponse;
    }>;
    /**
     * Search for tweets
     */
    searchTweets(authConfig: AuthConfig, args: unknown): Promise<import("../types.js").SearchResponse>;
    /**
     * Send a tweet
     */
    sendTweet(authConfig: AuthConfig, args: unknown): Promise<{
        tweet: import("../types.js").TweetResponse;
        success: boolean;
        message: string;
    }>;
    /**
     * Post a viral raid tweet and return the permanent X link
     */
    postRaidTweet(authConfig: AuthConfig, args: unknown): Promise<{
        success: boolean;
        tweet: import("../types.js").TweetResponse;
        x_link: string;
        message: string;
    }>;
    /**
     * Send a tweet with poll
     */
    sendTweetWithPoll(authConfig: AuthConfig, args: unknown): Promise<{
        tweet: import("../types.js").TweetResponse;
        success: boolean;
        message: string;
    }>;
    /**
     * Like a tweet
     */
    likeTweet(authConfig: AuthConfig, args: unknown): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Retweet a tweet
     */
    retweet(authConfig: AuthConfig, args: unknown): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Quote a tweet
     */
    quoteTweet(authConfig: AuthConfig, args: unknown): Promise<{
        tweet: import("../types.js").TweetResponse;
        success: boolean;
        message: string;
    }>;
}
