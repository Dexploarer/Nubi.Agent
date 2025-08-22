import { AuthConfig, TweetResponse, ProfileResponse, SearchResponse, FollowResponse, GrokChatResponse } from './types.js';
export declare class TwitterClient {
    private authManager;
    constructor();
    /**
     * Get tweets from a user
     */
    getUserTweets(config: AuthConfig, username: string, count: number, includeReplies?: boolean, includeRetweets?: boolean): Promise<TweetResponse[]>;
    /**
     * Get a tweet by ID
     */
    getTweetById(config: AuthConfig, id: string): Promise<TweetResponse>;
    /**
     * Search for tweets
     */
    searchTweets(config: AuthConfig, query: string, count: number, searchMode?: string): Promise<SearchResponse>;
    /**
     * Send a tweet
     */
    sendTweet(config: AuthConfig, text: string, replyToTweetId?: string, media?: {
        data: string;
        mediaType: string;
    }[]): Promise<TweetResponse>;
    /**
     * Send a tweet with poll
     */
    sendTweetWithPoll(config: AuthConfig, text: string, poll: {
        options: {
            label: string;
        }[];
        durationMinutes: number;
    }, replyToTweetId?: string): Promise<TweetResponse>;
    /**
     * Like a tweet
     */
    likeTweet(config: AuthConfig, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Retweet a tweet
     */
    retweet(config: AuthConfig, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Quote a tweet
     */
    quoteTweet(config: AuthConfig, text: string, quotedTweetId: string, media?: {
        data: string;
        mediaType: string;
    }[]): Promise<TweetResponse>;
    /**
     * Get a user's profile
     */
    getUserProfile(config: AuthConfig, username: string): Promise<ProfileResponse>;
    /**
     * Follow a user
     */
    followUser(config: AuthConfig, username: string): Promise<FollowResponse>;
    /**
     * Get a user's followers
     */
    getFollowers(config: AuthConfig, userId: string, count: number): Promise<ProfileResponse[]>;
    /**
     * Get a user's following
     */
    getFollowing(config: AuthConfig, userId: string, count: number): Promise<ProfileResponse[]>;
    /**
     * Chat with Grok
     */
    grokChat(config: AuthConfig, message: string, conversationId?: string, returnSearchResults?: boolean, returnCitations?: boolean): Promise<GrokChatResponse>;
    /**
     * Helper to convert string search mode to SearchMode enum
     */
    private getSearchMode;
    /**
     * Centralized error handling
     */
    private handleError;
}
