/**
 * Twitter Data Types for Read-Only Monitoring
 *
 * Defines interfaces for monitoring Twitter/X data without write operations
 */

export interface TwitterMention {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: Date;
  publicMetrics: {
    retweetCount: number;
    likeCount: number;
    replyCount: number;
    quoteCount: number;
  };
  inReplyToTweetId?: string;
  conversationId: string;
  contextAnnotations?: TwitterContextAnnotation[];
  referencedTweets?: TwitterReferencedTweet[];
}

export interface TwitterContextAnnotation {
  domain: {
    id: string;
    name: string;
    description?: string;
  };
  entity: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface TwitterReferencedTweet {
  type: "retweeted" | "quoted" | "replied_to";
  id: string;
}

export interface TrendingTopic {
  name: string;
  url: string;
  tweetVolume?: number;
  rank: number;
  category?: string;
  location: string;
  timestamp: Date;
}

export interface EngagementMetrics {
  tweetId: string;
  timestamp: Date;
  metrics: {
    impressions?: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks?: number;
    urlClicks?: number;
    profileClicks?: number;
  };
  growthRate?: {
    likesPerHour: number;
    retweetsPerHour: number;
    repliesPerHour: number;
  };
}

export interface TwitterStreamEvent {
  eventType: "mention" | "reply" | "quote" | "retweet" | "like";
  tweet?: TwitterMention;
  user?: TwitterUser;
  timestamp: Date;
  matchingRules: TwitterStreamRule[];
}

export interface TwitterStreamRule {
  id: string;
  value: string; // The rule query
  tag?: string; // Custom tag for the rule
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  profileImageUrl?: string;
  verified: boolean;
  verifiedType?: "blue" | "business" | "government";
  publicMetrics: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
    likeCount: number;
  };
  createdAt: Date;
  location?: string;
  website?: string;
}

export interface TwitterTimelineEntry {
  tweet: TwitterMention;
  user: TwitterUser;
  timestamp: Date;
  relevanceScore: number; // Custom scoring for importance
  category: "mention" | "trending" | "relevant" | "followup";
}

export interface TwitterMonitorConfig extends Record<string, unknown> {
  enabled: boolean;
  bearerToken: string;
  // Cookie-based authentication (same as MCP)
  authToken: string;
  csrfToken: string;
  ct0: string;
  username: string;
  password: string;
  email: string;
  streamRules: string[];
  monitoredUsers: string[];
  monitoredHashtags: string[];
  // List monitoring
  monitoredLists: string[];
  listUpdateInterval: number; // minutes
  // Raid monitoring
  raidMonitoring: {
    enabled: boolean;
    trackHashtags: string[];
    trackUsers: string[];
    engagementThresholds: {
      likes: number;
      retweets: number;
      replies: number;
    };
    timeWindows: {
      short: number; // minutes
      medium: number; // minutes  
      long: number; // minutes
    };
  };
  rateLimits: {
    tweetsPerWindow: number;
    usersPerWindow: number;
    searchesPerWindow: number;
    listsPerWindow: number;
    windowMinutes: number;
  };
  filters: {
    minFollowerCount: number;
    excludeRetweets: boolean;
    excludeReplies: boolean;
    languages: string[];
  };
}

export interface TwitterSearchResult {
  tweets: TwitterMention[];
  users: TwitterUser[];
  meta: {
    resultCount: number;
    nextToken?: string;
    newestId?: string;
    oldestId?: string;
  };
  query: string;
  timestamp: Date;
}

export interface TwitterList {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  subscriberCount: number;
  ownerId: string;
  ownerUsername: string;
  isPrivate: boolean;
  createdAt: Date;
}

export interface TwitterListTweets {
  listId: string;
  tweets: TwitterMention[];
  lastUpdated: Date;
  totalTweets: number;
}

export interface RaidMetrics {
  tweetId: string;
  hashtags: string[];
  engagementData: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    totalEngagements: number;
  };
  timeline: {
    timestamp: Date;
    engagementSnapshot: EngagementMetrics;
  }[];
  participants: {
    userId: string;
    username: string;
    engagementType: 'like' | 'retweet' | 'reply' | 'quote';
    timestamp: Date;
  }[];
  raidScore: number;
  velocity: number; // engagements per minute
  peakTime: Date;
}

export interface TwitterListTweets {
  listId: string;
  tweets: TwitterMention[];
  lastUpdated: Date;
  totalTweets: number;
}

export interface TwitterAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalMentions: number;
    totalEngagements: number;
    averageEngagementRate: number;
    topMentioners: TwitterUser[];
    popularHashtags: string[];
    sentimentBreakdown: {
      positive: number;
      negative: number;
      neutral: number;
    };
    // Raid analytics
    raidMetrics?: {
      totalRaids: number;
      successfulRaids: number;
      averageRaidScore: number;
      topRaidTweets: RaidMetrics[];
    };
  };
}

// Error types for monitoring
export interface TwitterMonitorError {
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
  recoverable: boolean;
}

// Event types for internal processing
export type TwitterMonitorEventType =
  | "new_mention"
  | "trending_topic"
  | "engagement_milestone"
  | "rate_limit_warning"
  | "connection_error"
  | "stream_reconnect";

export interface TwitterMonitorEvent {
  type: TwitterMonitorEventType;
  data: any;
  timestamp: Date;
  priority: "low" | "medium" | "high" | "critical";
}
