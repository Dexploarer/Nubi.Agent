import { Tweet, Profile } from 'agent-twitter-client';
import { TweetResponse, ProfileResponse, SearchResponse } from '../types.js';
/**
 * Format a Tweet object from agent-twitter-client to TweetResponse
 */
export declare function formatTweet(tweet: Tweet): TweetResponse;
/**
 * Format a Profile object from agent-twitter-client to ProfileResponse
 */
export declare function formatProfile(profile: Profile): ProfileResponse;
/**
 * Format search results
 */
export declare function formatSearch(query: string, tweets: Tweet[]): SearchResponse;
