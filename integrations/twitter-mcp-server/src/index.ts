#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { TweetTools } from './tools/tweets.js';
import { ProfileTools } from './tools/profiles.js';
import { GrokTools } from './tools/grok.js';
import { TwitterMcpError, AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logError, logInfo, sanitizeForLogging } from './utils/logger.js';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

// Log command-line arguments and environment variables
console.log('Command-line arguments:', process.argv);
console.log('DISABLE_HTTP_SERVER env var:', process.env.DISABLE_HTTP_SERVER);
console.log('PORT env var:', process.env.PORT);

// Create tools instances
const tweetTools = new TweetTools();
const profileTools = new ProfileTools();
const grokTools = new GrokTools();

// Initialize server
const server = new Server({
  name: 'twitter-mcp-server',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Configure auth from environment variables

// Configure auth from environment variables
function getAuthConfig(): AuthConfig {
  // Determine auth method
  const authMethod = process.env.AUTH_METHOD || 'cookies';

  switch (authMethod) {
    case 'cookies': {
      const cookiesStr = process.env.TWITTER_COOKIES;
      if (!cookiesStr) {
        throw new Error('TWITTER_COOKIES environment variable is required for cookie auth');
      }
      return {
        cookies: JSON.parse(cookiesStr)
      };
    }

    case 'credentials': {
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      if (!username || !password) {
        throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD are required for credential auth');
      }
      return {
        username,
        password,
        email: process.env.TWITTER_EMAIL,
        twoFactorSecret: process.env.TWITTER_2FA_SECRET
      };
    }

    case 'api': {
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecretKey = process.env.TWITTER_API_SECRET_KEY;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
      if (!apiKey || !apiSecretKey || !accessToken || !accessTokenSecret) {
        throw new Error('API credentials are required for API auth');
      }
      return {
        apiKey,
        apiSecretKey,
        accessToken,
        accessTokenSecret
      };
    }

    default:
      throw new Error(`Unsupported auth method: ${authMethod}`);
  }
}

// Get auth config
let authConfig: AuthConfig;
try {
  authConfig = getAuthConfig();
  const method = 'cookies' in authConfig ? 'cookies' : 'username' in authConfig ? 'credentials' : 'api';
  logInfo('Authentication configuration loaded', { method });
} catch (error) {
  logError('Failed to load authentication configuration', error);
  process.exit(1);
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logInfo('Received ListToolsRequest');

  return {
    tools: [
      // Tweet tools
      {
        name: 'get_user_tweets',
        description: 'Fetch tweets from a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Twitter username (without @)'
            },
            count: {
              type: 'number',
              description: 'Number of tweets to fetch (1-200)',
              default: 20
            },
            includeReplies: {
              type: 'boolean',
              description: 'Include replies in results',
              default: false
            },
            includeRetweets: {
              type: 'boolean',
              description: 'Include retweets in results',
              default: true
            }
          },
          required: ['username']
        }
      } as Tool,

      {
        name: 'get_tweet_by_id',
        description: 'Fetch a specific tweet by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Tweet ID'
            }
          },
          required: ['id']
        }
      } as Tool,

      {
        name: 'search_tweets',
        description: 'Search for tweets by keyword',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            count: {
              type: 'number',
              description: 'Number of tweets to return (10-100)',
              default: 20
            },
            searchMode: {
              type: 'string',
              description: 'Search mode: Top, Latest, Photos, or Videos',
              enum: ['Top', 'Latest', 'Photos', 'Videos'],
              default: 'Top'
            }
          },
          required: ['query']
        }
      } as Tool,

      {
        name: 'send_tweet',
        description: 'Post a new tweet',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Tweet content (max 280 characters)'
            },
            replyToTweetId: {
              type: 'string',
              description: 'ID of tweet to reply to (optional)'
            },
            media: {
              type: 'array',
              description: 'Media attachments (optional, max 4 images or 1 video)',
              items: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64 encoded media data'
                  },
                  mediaType: {
                    type: 'string',
                    description: 'MIME type of media (e.g., image/jpeg, video/mp4)'
                  }
                },
                required: ['data', 'mediaType']
              }
            }
          },
          required: ['text']
        }
      } as Tool,

      {
        name: 'send_tweet_with_poll',
        description: 'Post a tweet with a poll',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Tweet content (max 280 characters)'
            },
            replyToTweetId: {
              type: 'string',
              description: 'ID of tweet to reply to (optional)'
            },
            poll: {
              type: 'object',
              description: 'Poll configuration',
              properties: {
                options: {
                  type: 'array',
                  description: 'Poll options (2-4 options)',
                  items: {
                    type: 'object',
                    properties: {
                      label: {
                        type: 'string',
                        description: 'Option label (max 25 characters)'
                      }
                    },
                    required: ['label']
                  },
                  minItems: 2,
                  maxItems: 4
                },
                durationMinutes: {
                  type: 'number',
                  description: 'Poll duration in minutes (5-10080, default 1440)',
                  default: 1440
                }
              },
              required: ['options']
            }
          },
          required: ['text', 'poll']
        }
      } as Tool,

      {
        name: 'like_tweet',
        description: 'Like a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Tweet ID to like'
            }
          },
          required: ['id']
        }
      } as Tool,

      {
        name: 'retweet',
        description: 'Retweet a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Tweet ID to retweet'
            }
          },
          required: ['id']
        }
      } as Tool,

      {
        name: 'post_raid_tweet',
        description: 'Post a raid tweet with community hashtags and return the X link',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Main tweet text' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Optional hashtags; defaults to community tags' }
          },
          required: ['message']
        }
      } as Tool,

      {
        name: 'start_raid_monitor',
        description: 'Start monitoring a tweet for raid engagement metrics',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID to monitor' },
            xLink: { type: 'string', description: 'Permanent X link of the tweet' },
            intervalMs: { type: 'number', description: 'Polling interval in milliseconds', default: 30000 }
          },
          required: ['tweetId', 'xLink']
        }
      } as Tool,

      {
        name: 'get_raid_status',
        description: 'Get current raid stats snapshots for a monitored tweet',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' }
          },
          required: ['tweetId']
        }
      } as Tool,

      {
        name: 'stop_raid_monitor',
        description: 'Stop monitoring a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            tweetId: { type: 'string', description: 'Tweet ID' }
          },
          required: ['tweetId']
        }
      } as Tool,


      {
        name: 'quote_tweet',
        description: 'Quote a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Quote content (max 280 characters)'
            },
            quotedTweetId: {
              type: 'string',
              description: 'ID of tweet to quote'
            },
            media: {
              type: 'array',
              description: 'Media attachments (optional, max 4 images or 1 video)',
              items: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64 encoded media data'
                  },
                  mediaType: {
                    type: 'string',
                    description: 'MIME type of media (e.g., image/jpeg, video/mp4)'
                  }
                },
                required: ['data', 'mediaType']
              }
            }
          },
          required: ['text', 'quotedTweetId']
        }
      } as Tool,

      {
        name: 'post_raid_tweet',
        description: 'Post a raid tweet with community hashtags and return the X link',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Main tweet text' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Optional hashtags; defaults to community tags' }
          },
          required: ['message']
        }
      } as Tool,

      
// Profile tools
      {
        name: 'get_user_profile',
        description: 'Get a user\'s profile information',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Twitter username (without @)'
            }
          },
          required: ['username']
        }
      } as Tool,

      {
        name: 'follow_user',
        description: 'Follow a Twitter user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Username to follow (without @)'
            }
          },
          required: ['username']
        }
      } as Tool,

      {
        name: 'get_followers',
        description: 'Get a user\'s followers',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID'
            },
            count: {
              type: 'number',
              description: 'Number of followers to fetch (1-200)',
              default: 20
            }
          },
          required: ['userId']
        }
      } as Tool,

      {
        name: 'get_following',
        description: 'Get users a user is following',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID'
            },
            count: {
              type: 'number',
              description: 'Number of following to fetch (1-200)',
              default: 20
            }
          },
          required: ['userId']
        }
      } as Tool,

      // Grok tools
      {
        name: 'grok_chat',
        description: 'Chat with Grok via Twitter',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to send to Grok'
            },
            conversationId: {
              type: 'string',
              description: 'Optional conversation ID for continuing a conversation'
            },
            returnSearchResults: {
              type: 'boolean',
              description: 'Whether to return search results',
              default: true
            },
            returnCitations: {
              type: 'boolean',
              description: 'Whether to return citations',
              default: true
            }
          },
          required: ['message']
        }
      } as Tool,

      // Health check tool
      {
        name: 'health_check',
        description: 'Check the health status of the XMCP server',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      } as Tool
,

      {

        name: 'auth_status',

        description: 'Get detailed authentication status and diagnostics',

        inputSchema: {

          type: 'object',

          properties: {},

          required: []

        }

      } as Tool
    ]
  };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request: { params: unknown }) => {
  // Add type assertion for request.params
  const { name, arguments: args } = request.params as { name: string; arguments: unknown };

  logInfo('Received CallToolRequest', {
    tool: name,
    args: sanitizeForLogging(args as Record<string, unknown> || {} as Record<string, unknown>)
  });

  try {
    switch (name) {
      // Tweet tools
      case 'get_user_tweets':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.getUserTweets(authConfig, args))
          }] as TextContent[]
        };

      case 'get_tweet_by_id':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.getTweetById(authConfig, args))
          }] as TextContent[]
        };

      case 'search_tweets':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.searchTweets(authConfig, args))
          }] as TextContent[]
        };

      case 'send_tweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.sendTweet(authConfig, args))
          }] as TextContent[]
        };

      case 'send_tweet_with_poll':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.sendTweetWithPoll(authConfig, args))
          }] as TextContent[]
        };

      case 'like_tweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.likeTweet(authConfig, args))
          }] as TextContent[]
        };

      case 'retweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.retweet(authConfig, args))
          }] as TextContent[]
        };

      case 'quote_tweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.quoteTweet(authConfig, args))
          }] as TextContent[]
        };


      case 'post_raid_tweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.postRaidTweet(authConfig, args))
          }] as TextContent[]
        };

      case 'start_raid_monitor':
        {
          const { raidMonitorService } = await import('./raid/monitor.js');
          const a: any = args || {};
          const res = await raidMonitorService.startMonitor(authConfig, a.tweetId, a.xLink, a.intervalMs ?? 30000);
          return { content: [{ type: 'text', text: JSON.stringify(res) }] as TextContent[] };
        }

      case 'get_raid_status':
        {
          const { raidMonitorService } = await import('./raid/monitor.js');
          const a: any = args || {};
          const res = raidMonitorService.getStatus(a.tweetId);
          return { content: [{ type: 'text', text: JSON.stringify(res) }] as TextContent[] };
        }

      case 'stop_raid_monitor':
        {
          const { raidMonitorService } = await import('./raid/monitor.js');
          const a: any = args || {};
          const res = raidMonitorService.stopMonitor(a.tweetId);
          return { content: [{ type: 'text', text: JSON.stringify(res) }] as TextContent[] };
        }


      case 'post_raid_tweet':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await tweetTools.postRaidTweet(authConfig, args))
          }] as TextContent[]
        };

      // Profile tools
      case 'get_user_profile':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await profileTools.getUserProfile(authConfig, args))
          }] as TextContent[]
        };

      case 'follow_user':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await profileTools.followUser(authConfig, args))
          }] as TextContent[]
        };

      case 'get_followers':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await profileTools.getFollowers(authConfig, args))
          }] as TextContent[]
        };

      case 'get_following':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await profileTools.getFollowing(authConfig, args))
          }] as TextContent[]
        };

      // Grok tools
      case 'grok_chat':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await grokTools.grokChat(authConfig, args))
          }] as TextContent[]
        };

      // Health check
      case 'health_check':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await performHealthCheck(authConfig))
          }] as TextContent[]
        };

      case 'auth_status':
        const { getAuthenticationStatus } = await import('./health.js');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(await getAuthenticationStatus(), null, 2)
          }] as TextContent[]
        };

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    logError(`Error executing tool ${name}`, error, { tool: name });

    if (error instanceof McpError) {
      throw error;
    }

    if (error instanceof TwitterMcpError) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
          isError: true
        }] as TextContent[]
      };
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Error handler
server.onerror = (error) => {
  logError('MCP Server Error', error);
};

// Start the server
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    logInfo('Starting XMCP server on stdio transport...');
    await server.connect(transport);
    logInfo('XMCP server running on stdio');

    // Perform initial health check
    try {
      const healthStatus = await performHealthCheck(authConfig);
      logInfo('Initial health check completed', { status: healthStatus.status });

      if (healthStatus.status === 'unhealthy') {
        logError('Initial health check failed', new Error('Health check returned unhealthy status'), { healthStatus });
      }
    } catch (error) {
      logError('Initial health check failed with error', error);
    }

    // Start HTTP server for health checks
    const port = process.env.PORT || 3000;
    console.log(`Attempting to start HTTP server on port ${port}`);

    // Check if HTTP server should be disabled
    const disableHttpServer = process.env.DISABLE_HTTP_SERVER === 'true' ||
      process.argv.includes('--no-http-server');
    console.log(`Should HTTP server be disabled? ${disableHttpServer}`);

    if (!disableHttpServer) {
      const httpServer = http.createServer(async (req, res) => {
        if (req.url === '/health') {
          try {
            const healthStatus = await performHealthCheck(authConfig);
            res.writeHead(healthStatus.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(healthStatus));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'unhealthy', error: String(error) }));
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      httpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Please specify a different port using the PORT environment variable.`);
          logError(`Port ${port} is already in use`, error);
        } else {
          logError('HTTP server error', error);
        }
      });

      httpServer.listen(port, () => {
        logInfo(`HTTP server for health checks running on port ${port}`);
      });
    } else {
      console.log('HTTP server is disabled by configuration');
    }
  } catch (error) {
    logError('Failed to start XMCP server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logInfo('Shutting down XMCP server...');
  await server.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logError('Error starting XMCP server', error);
  process.exit(1);
});


// MCP Prompts: pre-written templates to guide the agent for Twitter tasks
const prompts = [
  {
    name: 'tweet_compose',
    description: 'Compose a clear, engaging tweet under 280 characters. Optionally include hashtags and mentions.',
    arguments: [
      { name: 'topic', description: 'What the tweet is about', required: true },
      { name: 'tone', description: 'Tone like informative, playful, professional', required: false },
      { name: 'hashtags', description: 'Comma-separated hashtags to include', required: false }
    ],
    messages: [
      { role: 'system', content: 'You are crafting a concise tweet that fits within 280 characters and follows Twitter best practices.' },
      { role: 'user', content: 'Write a tweet about {{topic}} in a {{tone}} tone. Include hashtags: {{hashtags}}' }
    ]
  },
  {
    name: 'thread_plan',
    description: 'Plan a multi-tweet educational thread (3–8 tweets) with a hook and numbered steps.',
    arguments: [
      { name: 'topic', description: 'Theme of the thread', required: true },
      { name: 'tweets', description: 'Number of tweets (3–8)', required: false }
    ],
    messages: [
      { role: 'system', content: 'Create a numbered Twitter thread with a hook, 3–8 concise tweets, and a strong conclusion.' },
      { role: 'user', content: 'Create a thread about {{topic}} with {{tweets}} tweets.' }
    ]
  },
  {
    name: 'reply_helpful',
    description: 'Draft a helpful, non-combative reply to a user tweet, adding value and citing sources if relevant.',
    arguments: [
      { name: 'context', description: 'Summary or excerpt of the tweet to reply to', required: true },
      { name: 'goal', description: 'Intent of the reply (clarify, add resource, correct misconception)', required: false }
    ],
    messages: [
      { role: 'system', content: 'Be concise, polite, and add value. If correcting, do it constructively with a reference when possible.' },
      { role: 'user', content: 'Draft a reply to: {{context}}. Goal: {{goal}}' }
    ]
  },
  {
    name: 'raid_viral',
    description: 'Generate a viral raid tweet with NUBI community hashtags. Automatically posts and returns X link.',
    arguments: [
      { name: 'topic', description: 'Core topic or announcement', required: true },
      { name: 'call_to_action', description: 'What you want the community to do', required: true },
      { name: 'urgency', description: 'Urgency level: low, medium, high', required: false }
    ],
    messages: [
      { 
        role: 'system', 
        content: `You are generating a viral raid tweet for the NUBI/Anubis community. Use this exact template:
        
🚀 {{topic}} {{urgency_emoji}}

The NUBI community is {{urgency_verb}} - this is exactly what we've been building toward!

{{call_to_action}} and let's show the world what #AnubisChat can do! 

🔥 RT and engage below!

Where urgency_emoji is ✨ (low), 🔥 (medium), or ⚡️🚨 (high)
And urgency_verb is growing (low), buzzing (medium), or exploding (high)

Then call the post_raid_tweet tool to post it and get the X link.` 
      },
      { 
        role: 'user', 
        content: 'Create a viral raid tweet about {{topic}} with call to action: {{call_to_action}}. Urgency: {{urgency}}. Post it and return the X link.' 
      }
    ]
  },
  {
        name: 'profile_summary',
    description: 'Summarize a Twitter profile and suggest 3 tweet ideas tailored to their audience.',
    arguments: [
      { name: 'username', description: 'Twitter username without @', required: true }
    ],
    messages: [
      { role: 'system', content: 'Summarize profile themes, audience interests, and propose three tweet ideas aligned with their content.' },
      { role: 'user', content: 'Summarize @{{username}} and propose 3 tweet ideas relevant to their audience.' }
    ]
  }
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));

server.setRequestHandler(GetPromptRequestSchema, async (req: any) => {
  const name = req.params?.name;
  const prompt = prompts.find(p => p.name === name);
  if (!prompt) {
    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
  return { prompt };
});
