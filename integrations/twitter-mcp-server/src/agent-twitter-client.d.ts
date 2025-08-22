declare module 'agent-twitter-client' {
  export enum SearchMode {
    Top = 'Top',
    Latest = 'Latest',
    Photos = 'Photos',
    Videos = 'Videos'
  }

  export interface Tweet {
    id?: string;
    text?: string;
    userId?: string;
    username?: string;
    name?: string;
    timeParsed?: Date;
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
    photos?: { url: string, alt_text: string }[];
    videos?: { url?: string, preview?: string }[];
    urls?: string[];
    isRetweet?: boolean;
    isReply?: boolean;
    isQuoted?: boolean;
    quotedStatus?: Tweet;
    inReplyToStatus?: Tweet;
    permanentUrl?: string;
  }

  export interface Profile {
    userId?: string;
    username?: string;
    name?: string;
    biography?: string;
    location?: string;
    website?: string;
    joined?: Date;
    isVerified?: boolean;
    isPrivate?: boolean;
    followersCount?: number;
    followingCount?: number;
    tweetsCount?: number;
    avatar?: string;
    banner?: string;
  }

  export class Scraper {
    isLoggedIn(): Promise<boolean>;
    setCookies(cookies: string[]): Promise<void>;
    getCookies(): Promise<import('tough-cookie').Cookie[]>;
    login(...args: any[]): Promise<void>;
    getTweets(username: string, count: number): AsyncIterableIterator<Tweet>;
    // Add minimal methods used by the MCP server
    getTweet(id: string): Promise<Tweet>;
    searchTweets(query: string, count: number, mode: any): AsyncIterableIterator<Tweet>;
    sendTweet(text: string, replyToTweetId?: string, media?: any): Promise<Response>;
    sendTweetV2(text: string, replyToTweetId?: string, options?: any): Promise<{ id: string } | undefined>;
    likeTweet(id: string): Promise<void>;
    retweet(id: string): Promise<void>;
    sendQuoteTweet(text: string, quotedTweetId: string, mediaOptions?: any): Promise<Response>;
    getProfile(username: string): Promise<Profile>;
    followUser(username: string): Promise<void>;
    getFollowers(userId: string, count: number): AsyncIterableIterator<Profile>;
    getFollowing(userId: string, count: number): AsyncIterableIterator<Profile>;
    grokChat(options: { messages: any[], conversationId?: string, returnSearchResults?: boolean, returnCitations?: boolean }): Promise<{ conversationId: string, message: string, webResults?: any[] }>;
    getTrends?(): Promise<any[]>;
  }

  // Other types can be added as needed
} 