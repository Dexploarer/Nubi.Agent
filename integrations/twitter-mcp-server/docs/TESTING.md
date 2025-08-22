# twitter-mcp-server Testing Guide

This document provides comprehensive instructions for testing the twitter-mcp-server server to ensure it functions correctly before deployment or after making changes.

## Prerequisites

Before testing, ensure you have:

1. Node.js 18+ installed
2. The project dependencies installed (`npm install`)
3. Twitter credentials configured (see [Authentication Methods](#authentication-methods))

## Authentication Methods

The twitter-mcp-server supports three authentication methods:

### 1. Cookie Authentication (Recommended)

Create a `.env` file with:

```
AUTH_METHOD=cookies
TWITTER_COOKIES=["auth_token=your_auth_token; Domain=.twitter.com", "ct0=your_ct0_value; Domain=.twitter.com"]
```

To obtain cookies:
1. Log in to Twitter in your browser
2. Open Developer Tools (F12)
3. Go to the Application tab > Cookies
4. Copy the values of `auth_token` and `ct0` cookies

### 2. Username/Password Authentication

Create a `.env` file with:

```
AUTH_METHOD=credentials
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email@example.com  # Optional
TWITTER_2FA_SECRET=your_2fa_secret    # Optional, required if 2FA is enabled
```

### 3. API Authentication

Create a `.env` file with:

```
AUTH_METHOD=api
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET_KEY=your_api_secret_key
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

## Testing Methods

### 1. Interactive Test Interface

The twitter-mcp-server includes an interactive command-line interface for testing:

```bash
npm run test:interface
```

This launches a REPL where you can test various MCP functions:

```
🐦 twitter-mcp-server Test Interface 🐦

Type a command to test the MCP functionality. Type "help" to see available commands.

twitter-mcp-server> help

Available commands:
  health                     Run a health check
  profile <username>         Get a user profile
  tweets <username> [count]  Get tweets from a user
  tweet <id>                 Get a specific tweet by ID
  search <query> [count]     Search for tweets
  post <text>                Post a new tweet
  like <id>                  Like a tweet
  retweet <id>               Retweet a tweet
  quote <id> <text>          Quote a tweet
  follow <username>          Follow a user
  followers <userId> [count] Get a user's followers
  following <userId> [count] Get users a user is following
  grok <message>             Chat with Grok
  help                       Show available commands
  exit                       Exit the test interface

twitter-mcp-server>
```

#### Example Commands

```
twitter-mcp-server> health
twitter-mcp-server> profile twitter
twitter-mcp-server> tweets elonmusk 5
twitter-mcp-server> search "artificial intelligence" 3
twitter-mcp-server> post Hello from twitter-mcp-server!
```

### 2. Automated Tests

Run the automated test suite:

```bash
npm test
```

This runs Jest tests that verify the functionality of various components:

- Validators
- Twitter client
- Health check
- Authentication

### 3. Integration Testing

For integration testing with actual Twitter API calls:

```bash
RUN_INTEGRATION_TESTS=true npm test
```

This runs tests that make actual API calls to Twitter, which is useful for verifying end-to-end functionality.

### 4. Testing with Claude Desktop

To test with Claude Desktop:

1. Configure Claude Desktop to use your local MCP:

Edit your Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "twitter-mcp-server": {
      "command": "node",
      "args": ["/path/to/your/twitter-mcp-server/build/index.js"],
      "env": {
        "AUTH_METHOD": "cookies",
        "TWITTER_COOKIES": "[\"auth_token=your_auth_token; Domain=.twitter.com\", \"ct0=your_ct0_value; Domain=.twitter.com\"]"
      }
    }
  }
}
```

2. Restart Claude Desktop
3. Test with prompts like:
   - "Search Twitter for tweets about AI"
   - "Get the latest tweets from @OpenAI"
   - "Post a tweet saying 'Hello from Claude!'"

## Testing Checklist

Use this checklist to ensure comprehensive testing:

### Basic Functionality
- [ ] Health check returns "healthy" status
- [ ] Can retrieve a user profile
- [ ] Can retrieve tweets from a user
- [ ] Can search for tweets

### Write Operations (if applicable)
- [ ] Can post a tweet
- [ ] Can like a tweet
- [ ] Can retweet a tweet
- [ ] Can quote a tweet
- [ ] Can follow a user

### Grok Integration
- [ ] Can send a message to Grok
- [ ] Can continue a conversation with Grok

### Error Handling
- [ ] Invalid inputs are properly rejected
- [ ] Authentication errors are properly handled
- [ ] API errors are properly handled

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. **Cookie Authentication**:
   - Ensure cookies are fresh (they expire after some time)
   - Verify the format of the cookies string
   - Make sure you have the essential cookies (`auth_token` and `ct0`)

2. **Credential Authentication**:
   - Check if your account has 2FA enabled (you'll need the `TWITTER_2FA_SECRET`)
   - Verify your username and password are correct
   - Check if your account is locked due to too many login attempts

3. **API Authentication**:
   - Verify your API keys have the necessary permissions
   - Check if you've exceeded rate limits
   - Ensure your API keys are active and not revoked

### API Errors

Common API errors:

- **Rate Limiting**: Twitter limits how many requests you can make in a time period
- **Content Restrictions**: Twitter may block certain content
- **Media Upload Issues**: Check media format and size

### Logging

Check the log files for detailed error information:

- `error.log`: Contains error-level messages
- `combined.log`: Contains all log messages

## Advanced Testing

### Load Testing

For load testing, you can use tools like Artillery:

```bash
npm install -g artillery
artillery run tests/load-test.yml
```

### Security Testing

Test with invalid inputs to ensure proper validation:

```
twitter-mcp-server> profile ""
twitter-mcp-server> tweets invalid_username
twitter-mcp-server> post ""
```

## Conclusion

By following this testing guide, you can ensure that your twitter-mcp-server server is functioning correctly and ready for production use. Regular testing, especially after updates to the codebase or the Twitter API, will help maintain reliability. 