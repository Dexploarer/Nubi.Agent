/**
 * X-Integration Module - Twitter/X Platform Integration
 *
 * This module provides Twitter/X platform integration services including
 * content generation, posting, and community management features.
 */

// Core services
export { XPostingService } from "./x-posting-service";
export type { TweetResult } from "./x-posting-service";
export { XContentGenerator } from "./x-content-generator";
export type { ContentTemplate } from "./x-content-generator";

// Content strategy types
export type { ContentStrategy } from "./anubis-chat-content";

// Types
export interface XIntegrationConfig {
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  username?: string;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface ContentGenerationOptions {
  category?: string;
  tone?: "confident" | "helpful" | "amused" | "passionate" | "contemplative";
  includeHashtags?: boolean;
  maxLength?: number;
  targetAudience?: string;
}

export interface PostingResult {
  success: boolean;
  tweetId?: string;
  url?: string;
  content: string;
  timestamp: number;
  error?: string;
}

// Utility functions
export function createXIntegrationConfig(
  enabled: boolean = false,
  options: Partial<XIntegrationConfig> = {},
): XIntegrationConfig {
  return {
    enabled,
    rateLimit: {
      requests: 100,
      window: 900, // 15 minutes
    },
    ...options,
  };
}

export function validateXConfig(config: XIntegrationConfig): boolean {
  if (!config.enabled) return false;

  // Check for required credentials
  const hasCredentials = !!(
    config.apiKey &&
    config.apiSecret &&
    config.accessToken &&
    config.accessTokenSecret
  );

  return hasCredentials;
}

export function formatTweetContent(
  content: string,
  hashtags: string[] = [],
  maxLength: number = 280,
): string {
  const baseContent = content.trim();
  const hashtagString = hashtags.length > 0 ? `\n\n${hashtags.join(" ")}` : "";
  const fullContent = baseContent + hashtagString;

  return fullContent.length > maxLength
    ? fullContent.substring(0, maxLength - 3) + "..."
    : fullContent;
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function createTweetUrl(username: string, tweetId: string): string {
  return `https://x.com/${username}/status/${tweetId}`;
}
