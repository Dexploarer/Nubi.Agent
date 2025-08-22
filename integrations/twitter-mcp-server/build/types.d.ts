import * as zod from 'zod';
export type AuthMethod = 'cookies' | 'credentials' | 'api';
export interface CookieAuth {
    cookies: string[];
}
export interface CredentialsAuth {
    username: string;
    password: string;
    email?: string;
    twoFactorSecret?: string;
}
export interface ApiAuth {
    apiKey: string;
    apiSecretKey: string;
    accessToken: string;
    accessTokenSecret: string;
}
export type AuthConfig = CookieAuth | CredentialsAuth | ApiAuth;
export declare const GetUserTweetsSchema: zod.ZodType<any>;
export declare const GetTweetByIdSchema: zod.ZodType<any>;
export declare const SearchTweetsSchema: zod.ZodType<any>;
export declare const SendTweetSchema: zod.ZodType<any>;
export declare const SendTweetWithPollSchema: zod.ZodType<any>;
export declare const LikeTweetSchema: zod.ZodType<any>;
export declare const RetweetSchema: zod.ZodType<any>;
export declare const QuoteTweetSchema: zod.ZodType<any>;
export declare const GetUserProfileSchema: zod.ZodType<any>;
export declare const FollowUserSchema: zod.ZodType<any>;
export declare const GetFollowersSchema: zod.ZodType<any>;
export declare const GetFollowingSchema: zod.ZodType<any>;
export declare const GrokChatSchema: zod.ZodType<any>;
export interface TweetResponse {
    id: string;
    text: string;
    author: {
        id: string;
        username: string;
        name: string;
    };
    createdAt?: string;
    metrics?: {
        likes?: number;
        retweets?: number;
        replies?: number;
        views?: number;
    };
    media?: {
        photos?: {
            url: string;
            alt?: string;
        }[];
        videos?: {
            url: string;
            preview: string;
        }[];
    };
    urls?: string[];
    isRetweet?: boolean;
    isReply?: boolean;
    isQuote?: boolean;
    quotedTweet?: TweetResponse;
    inReplyToTweet?: TweetResponse;
    permanentUrl: string;
}
export interface ProfileResponse {
    id: string;
    username: string;
    name: string;
    bio?: string;
    location?: string;
    website?: string;
    joinedDate?: string;
    isVerified?: boolean;
    isPrivate?: boolean;
    followersCount?: number;
    followingCount?: number;
    tweetsCount?: number;
    profileImageUrl?: string;
    bannerImageUrl?: string;
}
export interface SearchResponse {
    query: string;
    tweets: TweetResponse[];
    nextCursor?: string;
}
export interface FollowResponse {
    success: boolean;
    message: string;
}
export interface GrokChatResponse {
    conversationId: string;
    message: string;
    webResults?: any[];
}
export declare class TwitterMcpError extends Error {
    readonly code: string;
    readonly status?: number | undefined;
    constructor(message: string, code: string, status?: number | undefined);
}
export declare function isCookieAuth(config: AuthConfig): config is CookieAuth;
export declare function isCredentialsAuth(config: AuthConfig): config is CredentialsAuth;
export declare function isApiAuth(config: AuthConfig): config is ApiAuth;
