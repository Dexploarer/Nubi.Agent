/**
 * Twitter Monitor Plugin for ElizaOS
 *
 * Read-only Twitter monitoring plugin that integrates with ElizaOS
 * Provides real-time mention tracking, sentiment analysis, and user engagement monitoring
 */

import {
  Plugin,
  IAgentRuntime,
  Memory,
  Provider,
  Action,
  Evaluator,
  logger,
} from "@elizaos/core";
import { TwitterMonitorService } from "../services/twitter-monitor-service";
import {
  TwitterMonitorEvent,
  TwitterMention,
  TwitterMonitorEventType,
  TwitterUser,
  TwitterStreamEvent,
} from "../services/twitter-data-types";

/**
 * Twitter Monitor Actions
 */

// Action to search Twitter for specific queries
const searchTwitterAction: Action = {
  name: "SEARCH_TWITTER",
  similes: ["TWITTER_SEARCH", "SEARCH_X", "FIND_TWEETS", "SEARCH_MENTIONS"],
  description: "Search Twitter/X for tweets, mentions, or hashtags",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = message.content?.text || "";

    // Trigger on search-related keywords
    const searchIndicators = [
      "search twitter",
      "search x",
      "find tweets",
      "look for",
      "check twitter",
      "monitor hashtag",
      "track mention",
    ];

    return searchIndicators.some((indicator) =>
      content.toLowerCase().includes(indicator),
    );
  },
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        logger.warn("Twitter Monitor Service not available");
        return;
      }

      // Extract search query from message
      const content = message.content?.text || "";
      const query = extractSearchQuery(content);

      if (!query) {
        logger.warn("No search query found in message");
        return;
      }

      // Perform search
      const results = await twitterService.searchTweets(query, {
        maxResults: 10,
      });

      // Log search results (memory storage not available in plugin context)
      logger.info(`Found ${results.tweets.length} tweets for "${query}"`);

      logger.info(
        `Twitter search completed: ${query} - ${results.tweets.length} results`,
      );

      return {
        success: true,
        text: `Found ${results.tweets.length} tweets for "${query}"`,
        action: "SEARCH_TWITTER",
      };
    } catch (error) {
      logger.error(
        "Twitter search action failed:",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Search Twitter for #AnubisChat mentions" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "I'll search for recent #AnubisChat mentions on Twitter",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Can you find tweets about Solana DeFi?" },
      },
      {
        name: "{{agentName}}",
        content: { text: "Searching Twitter for Solana DeFi discussions..." },
      },
    ],
  ],
};

// Action to get user information from Twitter
const getUserInfoAction: Action = {
  name: "GET_TWITTER_USER",
  similes: ["TWITTER_USER_INFO", "X_USER_PROFILE", "CHECK_TWITTER_USER"],
  description: "Get information about a Twitter/X user",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = message.content?.text || "";

    // Look for username patterns
    const hasUsername =
      /@\w+/.test(content) ||
      content.includes("twitter.com/") ||
      content.includes("x.com/");
    const hasUserQuery = /user|profile|account|who is/i.test(content);

    return hasUsername && hasUserQuery;
  },
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        logger.warn("Twitter Monitor Service not available");
        return;
      }

      const content = message.content?.text || "";
      const username = extractUsername(content);

      if (!username) {
        logger.warn("No username found in message");
        return;
      }

      // Get user information
      const user = await twitterService.getUser(username);

      if (!user) {
        logger.info(`User not found: ${username}`);
        return;
      }

      // Log user info results (memory storage not available in plugin context)
      logger.info(`Twitter user info retrieved: @${user.username}`);

      return {
        success: true,
        text: `User info for @${user.username}: ${user.name} (${user.publicMetrics.followersCount} followers)`,
        action: "GET_TWITTER_USER",
      };
    } catch (error) {
      logger.error(
        "Get Twitter user action failed:",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Who is @elonmusk on Twitter?" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "Let me get information about @elonmusk's Twitter profile",
        },
      },
    ],
  ],
};

/**
 * Twitter Monitor Providers
 */

// Provider for recent mentions of the agent
const mentionsProvider: Provider = {
  name: "twitter_mentions",
  description: "Recent Twitter mentions of the agent",
  get: async (runtime: IAgentRuntime, message: Memory, state?: any) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        return { text: "", values: {}, data: {} };
      }

      // Get recent mentions from the last hour
      const recentMentions = await twitterService.searchTweets(
        "@UnderworldAgent",
        {
          maxResults: 5,
          startTime: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      );

      if (recentMentions.tweets.length === 0) {
        return {
          text: "No recent Twitter mentions found.",
          values: { mentionCount: 0 },
          data: { mentions: [] },
        };
      }

      const mentionSummary = recentMentions.tweets
        .map(
          (tweet) =>
            `- @${tweet.authorUsername}: "${tweet.text.slice(0, 100)}..." (${tweet.publicMetrics.likeCount} likes)`,
        )
        .join("\n");

      return {
        text: `Recent Twitter mentions:\n${mentionSummary}`,
        values: { mentionCount: recentMentions.tweets.length },
        data: { mentions: recentMentions.tweets },
      };
    } catch (error) {
      logger.error(
        "Error getting mentions:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        text: "Unable to fetch Twitter mentions at this time.",
        values: { error: true },
        data: {},
      };
    }
  },
};

// Provider for Twitter trending topics relevant to the agent
const trendingProvider: Provider = {
  name: "twitter_trending",
  description: "Current trending topics on Twitter",
  get: async (runtime: IAgentRuntime, message: Memory, state?: any) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        return { text: "", values: {}, data: {} };
      }

      // Search for trending topics related to our interests
      const searches = ["#Solana", "#DeFi", "#AnubisChat", "#Web3"];

      const trendingData = await Promise.all(
        searches.map(async (hashtag) => {
          const results = await twitterService.searchTweets(hashtag, {
            maxResults: 3,
          });
          return {
            hashtag,
            count: results.tweets.length,
            tweets: results.tweets,
          };
        }),
      );

      const trending = trendingData
        .filter((data) => data.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      if (trending.length === 0) {
        return {
          text: "No trending topics found for our focus areas.",
          values: { trendingCount: 0 },
          data: { trending: [] },
        };
      }

      const trendingSummary = trending
        .map((data) => `${data.hashtag}: ${data.count} recent tweets`)
        .join(", ");

      return {
        text: `Currently trending: ${trendingSummary}`,
        values: { trendingCount: trending.length },
        data: { trending },
      };
    } catch (error) {
      logger.error(
        "Error getting trending topics:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        text: "Unable to fetch trending topics at this time.",
        values: { error: true },
        data: {},
      };
    }
  },
};

// Provider for raid analytics
const raidAnalyticsProvider: Provider = {
  name: "twitter_raid_analytics",
  description: "Raid analytics and metrics from Twitter monitoring",
  get: async (runtime: IAgentRuntime, message: Memory, state?: any) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        return { text: "", values: {}, data: {} };
      }

      // Get raid analytics for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const raidMetrics = await twitterService.getRaidAnalytics(
        startDate,
        endDate,
      );

      if (!raidMetrics) {
        return {
          text: "Raid monitoring is not enabled.",
          values: { raidMonitoringEnabled: false },
          data: {},
        };
      }

      if (raidMetrics.totalRaids === 0) {
        return {
          text: "No raid activity detected in the last 24 hours.",
          values: { totalRaids: 0 },
          data: { raidMetrics },
        };
      }

      const successRate = (
        (raidMetrics.successfulRaids / raidMetrics.totalRaids) *
        100
      ).toFixed(1);

      return {
        text: `Raid analytics (24h): ${raidMetrics.totalRaids} total raids, ${raidMetrics.successfulRaids} successful (${successRate}%), average score: ${raidMetrics.averageRaidScore.toFixed(1)}`,
        values: {
          totalRaids: raidMetrics.totalRaids,
          successfulRaids: raidMetrics.successfulRaids,
          successRate: parseFloat(successRate),
          averageScore: raidMetrics.averageRaidScore,
        },
        data: { raidMetrics },
      };
    } catch (error) {
      logger.error(
        "Error getting raid analytics:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        text: "Unable to fetch raid analytics at this time.",
        values: { error: true },
        data: {},
      };
    }
  },
};

// Action to monitor Twitter lists
const monitorListsAction: Action = {
  name: "MONITOR_TWITTER_LISTS",
  similes: ["TWITTER_LISTS", "LIST_MONITORING", "CHECK_LISTS"],
  description: "Monitor Twitter lists for new tweets and activity",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = message.content?.text || "";

    const listIndicators = [
      "monitor lists",
      "check lists",
      "list tweets",
      "twitter lists",
      "list activity",
    ];

    return listIndicators.some((indicator) =>
      content.toLowerCase().includes(indicator),
    );
  },
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        logger.warn("Twitter Monitor Service not available");
        return;
      }

      // Monitor all configured lists
      const listTweets = await twitterService.monitorLists();

      if (listTweets.length === 0) {
        return {
          success: true,
          text: "No Twitter lists configured for monitoring",
          action: "MONITOR_TWITTER_LISTS",
        };
      }

      const totalTweets = listTweets.reduce(
        (sum, list) => sum + list.totalTweets,
        0,
      );
      const listSummary = listTweets
        .map((list) => `List ${list.listId}: ${list.totalTweets} tweets`)
        .join(", ");

      return {
        success: true,
        text: `Monitored ${listTweets.length} lists with ${totalTweets} total tweets. ${listSummary}`,
        action: "MONITOR_TWITTER_LISTS",
      };
    } catch (error) {
      logger.error(
        "Twitter list monitoring failed:",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Monitor our Twitter lists for new activity" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "I'll check our monitored Twitter lists for new tweets",
        },
      },
    ],
  ],
};

// Action to track raid metrics
const trackRaidAction: Action = {
  name: "TRACK_RAID_METRICS",
  similes: ["RAID_TRACKING", "TRACK_RAID", "RAID_METRICS", "ENGAGEMENT_RAID"],
  description: "Track raid metrics and engagement for specific tweets",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = message.content?.text || "";

    const raidIndicators = [
      "track raid",
      "raid metrics",
      "track engagement",
      "raid analytics",
      "monitor raid",
    ];

    // Also check for tweet URLs or IDs
    const hasTweetId =
      /twitter\.com\/\w+\/status\/(\d+)|x\.com\/\w+\/status\/(\d+)|\b\d{19}\b/.test(
        content,
      );

    return (
      raidIndicators.some((indicator) =>
        content.toLowerCase().includes(indicator),
      ) || hasTweetId
    );
  },
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const twitterService = runtime.getService(
        "twitter_monitor",
      ) as unknown as TwitterMonitorService;

      if (!twitterService) {
        logger.warn("Twitter Monitor Service not available");
        return;
      }

      const content = message.content?.text || "";

      // Extract tweet ID from URL or direct ID
      const tweetIdMatch = content.match(
        /twitter\.com\/\w+\/status\/(\d+)|x\.com\/\w+\/status\/(\d+)|\b(\d{19})\b/,
      );
      const tweetId = tweetIdMatch
        ? tweetIdMatch[1] || tweetIdMatch[2] || tweetIdMatch[3]
        : null;

      if (!tweetId) {
        return {
          success: false,
          text: "Please provide a tweet URL or ID to track raid metrics",
          action: "TRACK_RAID_METRICS",
        };
      }

      // Track raid metrics for the tweet
      const raidMetrics = await twitterService.trackRaidMetrics(tweetId);

      if (!raidMetrics) {
        return {
          success: false,
          text: "Raid monitoring is not enabled or failed to track metrics",
          action: "TRACK_RAID_METRICS",
        };
      }

      return {
        success: true,
        text: `Raid metrics for tweet ${tweetId}: Score ${raidMetrics.raidScore.toFixed(1)}, Velocity ${raidMetrics.velocity.toFixed(1)}/min, Total engagements: ${raidMetrics.engagementData.totalEngagements}`,
        action: "TRACK_RAID_METRICS",
      };
    } catch (error) {
      logger.error(
        "Raid tracking failed:",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Track raid metrics for https://twitter.com/user/status/1234567890123456789",
        },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "I'll track the raid metrics for that tweet and monitor engagement",
        },
      },
    ],
  ],
};

/**
 * Main Twitter Monitor Plugin
 */
export const twitterMonitorPlugin: Plugin = {
  name: "twitter-monitor",
  description: "Read-only Twitter monitoring and analytics for ElizaOS agents",

  services: [TwitterMonitorService],

  actions: [
    searchTwitterAction,
    getUserInfoAction,
    monitorListsAction,
    trackRaidAction,
  ],

  providers: [mentionsProvider, trendingProvider, raidAnalyticsProvider],

  evaluators: [],
};

/**
 * Event Handlers
 */

async function handleNewMention(
  runtime: IAgentRuntime,
  event: TwitterMonitorEvent,
): Promise<void> {
  try {
    const streamEvent = event.data as TwitterStreamEvent;
    const { tweet, user } = streamEvent;

    if (!tweet || !user) return;

    // Log new mention (memory creation not available in event handlers)
    logger.info(
      `New Twitter mention from @${user.username}: ${tweet.text.slice(0, 100)}${tweet.text.length > 100 ? "..." : ""}`,
    );

    // Note: Internal event emission not available in plugin context
    logger.debug("Twitter mention processed");
  } catch (error) {
    logger.error(
      "Error handling new Twitter mention:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handleEngagementMilestone(
  runtime: IAgentRuntime,
  event: TwitterMonitorEvent,
): Promise<void> {
  try {
    logger.info(`Twitter engagement milestone: ${JSON.stringify(event.data)}`);

    // Note: Event emission not available in plugin context
    logger.debug("Twitter engagement milestone processed");
  } catch (error) {
    logger.error(
      "Error handling engagement milestone:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Helper Functions
 */

function extractSearchQuery(content: string): string {
  // Extract search query from natural language
  const patterns = [
    /search (?:twitter|x) for ['""]?([^'""]+)['""]?/i,
    /find tweets about ['""]?([^'""]+)['""]?/i,
    /look for ['""]?([^'""]+)['""]?/i,
    /monitor hashtag ['""]?([^'""]+)['""]?/i,
    /track ['""]?([^'""]+)['""]?/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: extract hashtags or @mentions
  const hashtags = content.match(/#\w+/g);
  if (hashtags) {
    return hashtags[0];
  }

  const mentions = content.match(/@\w+/g);
  if (mentions) {
    return mentions[0];
  }

  return "";
}

function extractUsername(content: string): string {
  // Extract username from @mention or URL
  const mentionMatch = content.match(/@(\w+)/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  const urlMatch = content.match(/(?:twitter\.com|x\.com)\/(\w+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return "";
}

export default twitterMonitorPlugin;
