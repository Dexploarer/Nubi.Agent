import { Character } from "@elizaos/core";

export const nubiMcpConfig: Partial<Character> = {
  settings: {
    mcp: {
      servers: {
        xmcpx: {
          type: "stdio",
          command: "npx",
          args: ["@promptordie/xmcpx"],
          env: {
            // Twitter Authentication
            TWITTER_USERNAME: process.env.TWITTER_USERNAME,
            TWITTER_PASSWORD: process.env.TWITTER_PASSWORD,
            TWITTER_EMAIL: process.env.TWITTER_EMAIL,
            AUTH_METHOD: "cookies",
            TWITTER_AUTH_TOKEN: process.env.TWITTER_AUTH_TOKEN,
            TWITTER_CSRF_TOKEN: process.env.TWITTER_CSRF_TOKEN,
            TWITTER_CT0: process.env.TWITTER_CT0,

            // Server Configuration
            PORT: "3011",
            NODE_ENV: "production",
            DISABLE_HTTP_SERVER: "false",

            // Database Configuration
            DATABASE_URL: process.env.POSTGRES_URL,

            // AI Configuration
            GOOGLE_GENERATIVE_AI_API_KEY:
              process.env.GOOGLE_GENERATIVE_AI_API_KEY,

            // Logging
            LOG_LEVEL: "info",
            LOG_FILE: "/root/xmcpx-server/logs/xmcpx.log",
          },
        },
        supabase: {
          type: "stdio",
          command: "npx",
          args: [
            "-y",
            "@supabase/mcp-server-supabase@latest",
            "--access-token",
            process.env.SUPABASE_ACCESS_TOKEN || "",
          ],
          env: {
            // Supabase Configuration
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          },
        },
      },
    },
  },
};

// MCP Tools that will be available to the agent
export const xmcpxTools = {
  twitter: {
    // Post tweets
    postTweet: {
      description: "Post a tweet to Twitter/X",
      parameters: {
        text: "string",
        mediaUrls: "string[]?",
      },
    },

    // Search tweets
    searchTweets: {
      description: "Search for tweets on Twitter/X",
      parameters: {
        query: "string",
        limit: "number?",
      },
    },

    // Get user profile
    getUserProfile: {
      description: "Get a user's profile information",
      parameters: {
        username: "string",
      },
    },

    // Get trending topics
    getTrending: {
      description: "Get trending topics on Twitter/X",
      parameters: {
        limit: "number?",
      },
    },

    // Reply to tweet
    replyToTweet: {
      description: "Reply to a specific tweet",
      parameters: {
        tweetId: "string",
        text: "string",
      },
    },

    // Like/Unlike tweet
    likeTweet: {
      description: "Like or unlike a tweet",
      parameters: {
        tweetId: "string",
        like: "boolean",
      },
    },

    // Retweet
    retweet: {
      description: "Retweet a tweet",
      parameters: {
        tweetId: "string",
      },
    },

    // Follow/Unfollow user
    followUser: {
      description: "Follow or unfollow a user",
      parameters: {
        username: "string",
        follow: "boolean",
      },
    },

    // Get mentions
    getMentions: {
      description: "Get recent mentions of the authenticated user",
      parameters: {
        limit: "number?",
      },
    },

    // Get timeline
    getTimeline: {
      description: "Get the home timeline",
      parameters: {
        limit: "number?",
      },
    },

    // Ask Grok AI
    askGrok: {
      description: "Ask a question to Grok AI on X/Twitter",
      parameters: {
        question: "string",
        conversationId: "string?",
      },
    },
  },
};
