# twitter-mcp-server Implementation Guide

This guide provides step-by-step instructions for developers who want to integrate `twitter-mcp-server` into their own projects. It covers installation, configuration, client implementation, and usage of the various Twitter tools.

## Table of Contents

- [twitter-mcp-server Implementation Guide](#twitter-mcp-server-implementation-guide)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [Basic Installation](#basic-installation)
    - [Grok Functionality Installation](#grok-functionality-installation)
  - [Client Implementation](#client-implementation)
    - [Basic Client](#basic-client)
    - [Advanced Client](#advanced-client)
  - [Authentication](#authentication)
    - [1. Cookie Authentication (Recommended)](#1-cookie-authentication-recommended)
    - [2. Username/Password Authentication](#2-usernamepassword-authentication)
    - [3. API Authentication](#3-api-authentication)
  - [Using Twitter Tools](#using-twitter-tools)
    - [Tweet Operations](#tweet-operations)
    - [Profile Operations](#profile-operations)
    - [Grok AI Operations](#grok-ai-operations)
  - [Error Handling](#error-handling)
  - [Advanced Usage](#advanced-usage)
    - [Custom Tool Implementations](#custom-tool-implementations)
    - [Handling Rate Limits](#handling-rate-limits)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Health Check](#health-check)

## Installation

### Basic Installation

For basic Twitter functionality (tweets, profiles, etc.), you can install the package directly from npm:

```bash
npm install twitter-mcp-server
```

This will install version 0.0.18 of the underlying `agent-twitter-client` package, which supports all basic Twitter operations.

### Grok Functionality Installation

To enable Grok AI functionality, you need to install version 0.0.19 or higher of the `agent-twitter-client` package, which is currently only available on GitHub:

```bash
# First install the MCP package
npm install twitter-mcp-server

# Then install agent-twitter-client v0.0.19 from GitHub using the tar.gz URL
npm install https://github.com/elizaOS/agent-twitter-client/archive/0.0.19.tar.gz
```

> **Note**: The above method is the most reliable way to install v0.0.19. Other methods like `npm install github:elizaOS/agent-twitter-client#v0.0.19` may not work consistently.

Alternatively, you can specify both in your `package.json`:

```json
{
  "dependencies": {
    "twitter-mcp-server": "latest",
    "agent-twitter-client": "https://github.com/elizaOS/agent-twitter-client/archive/0.0.19.tar.gz"
  }
}
```

Then run:

```bash
npm install
```

## Client Implementation

### Basic Client

Here's a minimal implementation of a client that connects to the MCP server:

```javascript
// mcp-client.js
const { spawn } = require("child_process");
const net = require("net");
const { randomUUID } = require("crypto");

class McpClient {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.debug = options.debug || false;
    this.startServer = options.startServer !== false; // Default to true
    this.serverProcess = null;
    this.socket = null;
    this.connected = false;
    this.requestCallbacks = new Map();
  }

  async start() {
    if (this.startServer) {
      await this.startMcpServer();
    }
    await this.connect();
    return this;
  }

  async startMcpServer() {
    return new Promise((resolve, reject) => {
      try {
        this.log("Starting MCP server...");
        this.serverProcess = spawn("npx", ["twitter-mcp-server"], {
          env: { ...process.env, PORT: this.port },
          stdio: this.debug ? "inherit" : "ignore",
        });

        this.serverProcess.on("error", (error) => {
          this.log(`Server process error: ${error.message}`);
          reject(error);
        });

        // Give the server time to start
        setTimeout(resolve, 2000);
      } catch (error) {
        this.log(`Failed to start MCP server: ${error.message}`);
        reject(error);
      }
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.log(`Connecting to MCP server on port ${this.port}...`);
      this.socket = new net.Socket();

      this.socket.on("data", (data) => {
        this.handleResponse(data.toString());
      });

      this.socket.on("error", (error) => {
        this.log(`Socket error: ${error.message}`);
        this.connected = false;
        reject(error);
      });

      this.socket.on("close", () => {
        this.log("Connection closed");
        this.connected = false;
      });

      this.socket.connect(this.port, "127.0.0.1", () => {
        this.log("Connected to MCP server");
        this.connected = true;
        resolve();
      });
    });
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("Not connected to MCP server"));
        return;
      }

      const id = request.id || randomUUID();
      request.id = id;

      this.requestCallbacks.set(id, { resolve, reject });

      const requestStr = JSON.stringify(request) + "\n";
      this.log(`Sending request: ${requestStr}`);

      this.socket.write(requestStr, (error) => {
        if (error) {
          this.requestCallbacks.delete(id);
          reject(error);
        }
      });
    });
  }

  handleResponse(data) {
    this.log(`Received response: ${data}`);

    try {
      const responses = data
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      for (const response of responses) {
        const callback = this.requestCallbacks.get(response.id);
        if (callback) {
          this.requestCallbacks.delete(response.id);

          if (response.error) {
            callback.reject(new Error(response.error.message));
          } else {
            callback.resolve(response);
          }
        }
      }
    } catch (error) {
      this.log(`Error parsing response: ${error.message}`);
    }
  }

  async callTool(name, arguments = {}) {
    const request = {
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments,
      },
    };

    return this.sendRequest(request);
  }

  async stop() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  log(message) {
    if (this.debug) {
      console.log(`[MCP Client] ${message}`);
    }
  }
}

module.exports = { McpClient };
```

### Advanced Client

For a more robust implementation with automatic reconnection and better error handling:

```javascript
// advanced-mcp-client.js
const { McpClient } = require("./mcp-client");

class AdvancedMcpClient extends McpClient {
  constructor(options = {}) {
    super(options);
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.autoReconnect = options.autoReconnect !== false;
    this.retryCount = 0;
  }

  async callTool(name, arguments = {}, retryCount = 0) {
    try {
      if (!this.connected) {
        await this.reconnect();
      }

      return await super.callTool(name, arguments);
    } catch (error) {
      if (retryCount < this.maxRetries && this.autoReconnect) {
        this.log(
          `Retrying tool call (${retryCount + 1}/${this.maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.callTool(name, arguments, retryCount + 1);
      }
      throw error;
    }
  }

  async reconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    if (this.serverProcess && !this.serverProcess.connected) {
      this.serverProcess.kill();
      this.serverProcess = null;

      if (this.startServer) {
        await this.startMcpServer();
      }
    }

    await this.connect();
  }

  // Helper methods for common operations
  async searchTweets(query, count = 10) {
    return this.callTool("search_tweets", { query, count });
  }

  async getUserTweets(
    username,
    count = 10,
    includeReplies = false,
    includeRetweets = false
  ) {
    return this.callTool("get_user_tweets", {
      username,
      count,
      includeReplies,
      includeRetweets,
    });
  }

  async sendTweet(text, replyToTweetId = null) {
    const args = { text };
    if (replyToTweetId) {
      args.replyToTweetId = replyToTweetId;
    }
    return this.callTool("send_tweet", args);
  }

  async getUserProfile(username) {
    return this.callTool("get_user_profile", { username });
  }

  async grokChat(message, conversationId = null) {
    const args = { message };
    if (conversationId) {
      args.conversationId = conversationId;
    }
    return this.callTool("grok_chat", args);
  }
}

module.exports = { AdvancedMcpClient };
```

## Authentication

Before using the client, you need to set up authentication. Create a `.env` file in your project root with one of the following authentication methods:

### 1. Cookie Authentication (Recommended)

```
AUTH_METHOD=cookies
TWITTER_COOKIES=["auth_token=your_auth_token; Domain=.twitter.com", "ct0=your_ct0_value; Domain=.twitter.com", "twid=u%3Dyour_user_id; Domain=.twitter.com"]
```

To obtain cookies:

1. Log in to Twitter in your browser
2. Open Developer Tools (F12)
3. Go to the Application tab > Cookies
4. Copy the values of `auth_token`, `ct0`, and `twid` cookies
5. Make sure to include the `Domain=.twitter.com` part for each cookie

### 2. Username/Password Authentication

```
AUTH_METHOD=credentials
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email@example.com  # Optional
TWITTER_2FA_SECRET=your_2fa_secret    # Optional, required if 2FA is enabled
```

### 3. API Authentication

```
AUTH_METHOD=api
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET_KEY=your_api_secret_key
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

## Using Twitter Tools

### Tweet Operations

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

async function tweetOperations() {
  const client = new AdvancedMcpClient({ debug: true });
  await client.start();

  try {
    // Get tweets from a user
    const userTweets = await client.getUserTweets("elonmusk", 5);
    console.log("User tweets:", userTweets.result.tweets);

    // Search for tweets
    const searchResults = await client.callTool("search_tweets", {
      query: "artificial intelligence",
      count: 5,
    });
    console.log("Search results:", searchResults.result.tweets);

    // Get a specific tweet by ID
    const tweetId = userTweets.result.tweets[0].id;
    const tweetDetails = await client.callTool("get_tweet_by_id", {
      id: tweetId,
    });
    console.log("Tweet details:", tweetDetails.result);

    // Send a tweet
    const newTweet = await client.sendTweet(
      "Testing the twitter-mcp-server!"
    );
    console.log("New tweet:", newTweet.result);

    // Like a tweet
    await client.callTool("like_tweet", { id: tweetId });
    console.log("Tweet liked");

    // Retweet a tweet
    await client.callTool("retweet", { id: tweetId });
    console.log("Tweet retweeted");

    // Quote a tweet
    await client.callTool("quote_tweet", {
      id: tweetId,
      text: "Check out this interesting tweet!",
    });
    console.log("Tweet quoted");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.stop();
  }
}

tweetOperations();
```

### Profile Operations

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

async function profileOperations() {
  const client = new AdvancedMcpClient({ debug: true });
  await client.start();

  try {
    // Get a user's profile
    const profile = await client.getUserProfile("elonmusk");
    console.log("User profile:", profile.result);

    // Follow a user
    await client.callTool("follow_user", { username: "twitter" });
    console.log("User followed");

    // Get a user's followers
    const followers = await client.callTool("get_followers", {
      username: "elonmusk",
      count: 5,
    });
    console.log("Followers:", followers.result.users);

    // Get users a user is following
    const following = await client.callTool("get_following", {
      username: "elonmusk",
      count: 5,
    });
    console.log("Following:", following.result.users);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.stop();
  }
}

profileOperations();
```

### Grok AI Operations

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

async function grokOperations() {
  // Make sure you've installed agent-twitter-client v0.0.19 or higher
  // npm install https://github.com/elizaOS/agent-twitter-client/archive/0.0.19.tar.gz

  const client = new AdvancedMcpClient({ debug: true });
  await client.start();

  try {
    // Start a new conversation with Grok
    const response1 = await client.grokChat(
      "What are the trending topics on Twitter today?"
    );
    console.log("Grok response:", response1.result.response);

    // Continue the conversation using the conversation ID
    const conversationId = response1.result.conversationId;
    const response2 = await client.grokChat(
      "Tell me more about the first topic",
      conversationId
    );
    console.log("Grok follow-up response:", response2.result.response);

    // Ask about a specific Twitter user
    const response3 = await client.grokChat(
      "What can you tell me about @elonmusk?",
      conversationId
    );
    console.log("Grok user info response:", response3.result.response);
  } catch (error) {
    console.error("Error:", error.message);
    // Check if it's a version compatibility issue
    if (error.message.includes("grok_chat is not a valid tool")) {
      console.error(
        "Make sure you have installed agent-twitter-client v0.0.19 or higher:"
      );
      console.error(
        "npm install https://github.com/elizaOS/agent-twitter-client/archive/0.0.19.tar.gz"
      );
    }
  } finally {
    await client.stop();
  }
}

grokOperations();
```

## Error Handling

Implement robust error handling to manage common issues:

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

async function robustTwitterOperations() {
  const client = new AdvancedMcpClient({
    debug: true,
    maxRetries: 3,
    retryDelay: 2000,
    autoReconnect: true,
  });

  try {
    await client.start();

    try {
      const result = await client.getUserTweets("elonmusk", 5);
      console.log("Success:", result.result);
    } catch (error) {
      if (error.message.includes("rate limit")) {
        console.error("Rate limit exceeded. Try again later.");
      } else if (error.message.includes("authentication")) {
        console.error("Authentication failed. Check your credentials.");
      } else {
        console.error("Operation failed:", error.message);
      }
    }
  } catch (error) {
    console.error("Failed to start client:", error.message);
  } finally {
    await client.stop();
  }
}

robustTwitterOperations();
```

## Advanced Usage

### Custom Tool Implementations

You can extend the client to implement custom tools or modify existing ones:

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

class CustomMcpClient extends AdvancedMcpClient {
  constructor(options = {}) {
    super(options);
  }

  // Custom method to get tweets and automatically like them
  async getTweetsAndLike(username, count = 5) {
    const tweetsResponse = await this.getUserTweets(username, count);
    const tweets = tweetsResponse.result.tweets;

    const likePromises = tweets.map((tweet) =>
      this.callTool("like_tweet", { id: tweet.id })
        .then(() => console.log(`Liked tweet: ${tweet.id}`))
        .catch((error) =>
          console.error(`Failed to like tweet ${tweet.id}:`, error.message)
        )
    );

    await Promise.all(likePromises);
    return tweets;
  }

  // Custom method to analyze a user's recent tweets with Grok
  async analyzeTweetsWithGrok(username, count = 5) {
    const tweetsResponse = await this.getUserTweets(username, count);
    const tweets = tweetsResponse.result.tweets;

    const tweetTexts = tweets.map((tweet) => tweet.text).join("\n\n");
    const prompt = `Analyze these recent tweets from ${username}:\n\n${tweetTexts}`;

    const grokResponse = await this.grokChat(prompt);
    return {
      tweets,
      analysis: grokResponse.result.response,
    };
  }
}

async function customOperations() {
  const client = new CustomMcpClient({ debug: true });
  await client.start();

  try {
    // Use custom method
    const likedTweets = await client.getTweetsAndLike("twitter");
    console.log(`Liked ${likedTweets.length} tweets`);

    // Use Grok analysis (requires v0.0.19+)
    const analysis = await client.analyzeTweetsWithGrok("elonmusk");
    console.log("Tweet analysis:", analysis.analysis);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.stop();
  }
}

customOperations();
```

### Handling Rate Limits

Implement a rate limiter to avoid hitting Twitter's API limits:

```javascript
const { AdvancedMcpClient } = require("./advanced-mcp-client");

class RateLimitedClient extends AdvancedMcpClient {
  constructor(options = {}) {
    super(options);
    this.requestQueue = [];
    this.processing = false;
    this.requestsPerMinute = options.requestsPerMinute || 15;
    this.interval = 60000 / this.requestsPerMinute;
  }

  async callTool(name, arguments = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        name,
        arguments,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.requestQueue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const request = this.requestQueue.shift();

    try {
      const result = await super.callTool(request.name, request.arguments);
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }

    setTimeout(() => {
      this.processQueue();
    }, this.interval);
  }
}

async function rateLimitedOperations() {
  const client = new RateLimitedClient({
    debug: true,
    requestsPerMinute: 15, // Adjust based on Twitter's limits
  });

  await client.start();

  try {
    // Queue multiple requests that will be processed at the rate limit
    const promises = [
      client.getUserTweets("twitter"),
      client.getUserTweets("elonmusk"),
      client.getUserTweets("github"),
      client.searchTweets("javascript"),
      client.searchTweets("python"),
    ];

    const results = await Promise.all(promises);
    console.log(`Successfully processed ${results.length} requests`);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.stop();
  }
}

rateLimitedOperations();
```

## Troubleshooting

### Common Issues

1. **Version Compatibility for Grok**

   If you encounter errors when using Grok functionality:

   ```
   Error: Unknown tool: grok_chat
   ```

   Make sure you've installed the correct version of `agent-twitter-client`:

   ```bash
   npm install https://github.com/elizaOS/agent-twitter-client/archive/0.0.19.tar.gz
   ```

   You can verify the installed version:

   ```bash
   npm list agent-twitter-client
   ```

2. **Authentication Failures**

   If you see authentication errors:

   ```
   Error: Authentication failed
   ```

   - Check that your credentials in the `.env` file are correct
   - For cookie authentication, ensure cookies are properly formatted with the correct domain
   - Try refreshing your cookies by logging out and back into Twitter
   - Make sure your `.env` file is in the correct location (project root)

3. **Connection Issues**

   If the client fails to connect to the MCP server:

   ```
   Error: Connection refused
   ```

   - Check if the port is already in use by another process
   - Ensure you have permission to start servers on the specified port
   - Try a different port:

     ```javascript
     const client = new McpClient({ port: 3001 });
     ```

4. **Rate Limiting**

   If you encounter rate limit errors:

   ```
   Error: Rate limit exceeded
   ```

   - Implement the rate limiter shown in the Advanced Usage section
   - Add delays between requests
   - Reduce the number of requests you're making

5. **Debugging**

   Enable debug mode to see detailed logs:

   ```javascript
   const client = new McpClient({ debug: true });
   ```

   You can also check the MCP server logs:

   ```bash
   LOG_LEVEL=debug npx twitter-mcp-server
   ```

### Health Check

Use the health check tool to verify that the MCP server is running correctly:

```javascript
async function checkHealth() {
  const client = new McpClient({ debug: true });
  await client.start();

  try {
    const health = await client.callTool("health_check");
    console.log("Health status:", health.result);

    if (health.result.status === "ok") {
      console.log("MCP server is healthy");
    } else {
      console.log("MCP server has issues:", health.result.message);
    }
  } catch (error) {
    console.error("Health check failed:", error.message);
  } finally {
    await client.stop();
  }
}

checkHealth();
```

This implementation guide should help you get started with integrating `twitter-mcp-server` into your projects. For more detailed information about the available tools and their parameters, refer to the [Developer Guide](DEVELOPER_GUIDE.md).
