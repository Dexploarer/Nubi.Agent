# Enhanced Twitter MCP Server 🚀

A fully consolidated Model Context Protocol (MCP) server that provides comprehensive Twitter integration with **smart cookie management** and **persistent authentication** for ElizaOS and other MCP-compatible clients.

## 🌟 Key Features

### 🔐 Smart Authentication System
- **Persistent Cookie Management**: Automatically captures, validates, and reuses authentication cookies
- **Self-Healing Authentication**: Falls back to credentials when cookies expire, then saves new cookies
- **Rate Limit Prevention**: Avoids repeated logins by intelligently managing session persistence
- **Multi-Method Support**: Cookie-based, credential-based, and hybrid authentication modes

### 🐦 Complete Twitter Operations
- ✅ **Tweet Management**: Post, search, like, retweet, quote tweet
- ✅ **User Operations**: Follow, unfollow, get profiles, search users
- ✅ **Timeline Access**: Home timeline, user timelines, search results
- ✅ **Advanced Features**: Thread posting, media uploads, DMs
- ✅ **Grok Integration**: Chat with Twitter's Grok AI
- ✅ **Health Monitoring**: Built-in health checks and status monitoring

### 🛡️ Rate Limiting & Reliability
- **Smart Session Management**: Maintains long-lived authenticated sessions
- **Automatic Recovery**: Handles session expiration gracefully
- **Request Optimization**: Minimizes authentication overhead
- **Error Resilience**: Robust error handling and retry mechanisms

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
cd /root/twitter-mcp-consolidated

# Install dependencies
npm install

# Build the TypeScript project
npm run build
```

### 2. Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Twitter credentials:

```env
# For first-time setup (credentials will be used once to get cookies)
AUTH_METHOD=credentials
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
TWITTER_EMAIL=your_email@example.com

# Or use existing cookies directly
AUTH_METHOD=cookies
TWITTER_COOKIES=["auth_token=your_token; Domain=.twitter.com", "ct0=your_ct0; Domain=.twitter.com", "twid=your_twid; Domain=.twitter.com"]
```

### 3. Run the Server

Choose your preferred mode:

```bash
# Standard MCP server
npm start

# Enhanced server with smart authentication
npm run start:enhanced

# Development mode with hot reload
npm run dev
```

## 🔄 Authentication Flow

### Smart Authentication Process

1. **Cookie Check**: First attempts to use saved cookies from previous sessions
2. **Cookie Validation**: Verifies cookies are still valid and functional
3. **Credential Fallback**: If cookies fail, uses username/password to authenticate
4. **Cookie Capture**: Automatically extracts and saves new session cookies
5. **Future Sessions**: Subsequent runs use the saved cookies for instant authentication

### Benefits

- **Zero Rate Limits**: After first login, no repeated authentication requests
- **Instant Startup**: Cached sessions allow immediate Twitter operations
- **Automatic Maintenance**: Handles cookie expiration and renewal seamlessly
- **Production Ready**: Designed for long-running agent deployments

## 🛠️ Usage with ElizaOS

Add to your ElizaOS configuration:

```json
{
  "mcpServers": {
    "twitter-enhanced": {
      "command": "node",
      "args": ["/root/twitter-mcp-consolidated/build/index.js"],
      "env": {
        "AUTH_METHOD": "credentials",
        "TWITTER_USERNAME": "your_username",
        "TWITTER_PASSWORD": "your_password",
        "TWITTER_EMAIL": "your_email@example.com"
      }
    }
  }
}
```

Or use the enhanced server:

```json
{
  "mcpServers": {
    "twitter-enhanced": {
      "command": "node",
      "args": ["/root/twitter-mcp-consolidated/enhanced-server.js"]
    }
  }
}
```

## 📚 Available Tools

### Core Twitter Operations
- `tweet` - Post a tweet
- `search_tweets` - Search for tweets
- `get_user_timeline` - Get user's timeline
- `like_tweet` - Like a tweet
- `retweet` - Retweet a tweet
- `follow_user` - Follow a user
- `unfollow_user` - Unfollow a user
- `get_user_profile` - Get user profile information
- `search_users` - Search for users

### Advanced Features
- `post_thread` - Post a Twitter thread
- `quote_tweet` - Quote tweet with comment
- `get_home_timeline` - Get home timeline
- `send_direct_message` - Send DM (if available)
- `chat_with_grok` - Chat with Grok AI
- `upload_media` - Upload media files

### System Tools
- `health_check` - Check server health and authentication status
- `get_auth_status` - Get detailed authentication information
- `clear_auth_data` - Clear saved authentication data
- `re_authenticate` - Force re-authentication

## 🔧 Configuration Options

### Environment Variables

```env
# Authentication
AUTH_METHOD=cookies|credentials
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password  
TWITTER_EMAIL=your_email
TWITTER_COOKIES=JSON_array_of_cookies

# Server Settings
LOG_LEVEL=info|debug|warn|error
PORT=3001
DISABLE_HTTP_SERVER=false

# Smart Authentication Features
ENABLE_SMART_AUTHENTICATION=true
AUTO_SAVE_COOKIES=true
COOKIE_VALIDATION_ENABLED=true

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=30
REQUEST_RETRY_DELAY=2000

# Security
SESSION_TIMEOUT=3600000
AUTO_LOGOUT_ON_ERROR=false
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test MCP interface
npm run test:interface

# Test cookie functionality  
npm run test:cookies

# Lint code
npm run lint
```

## 📊 Monitoring & Health

The server includes comprehensive health monitoring:

```bash
# Check server status
curl http://localhost:3001/health

# Get authentication status
curl http://localhost:3001/auth-status
```

Example health response:
```json
{
  "status": "healthy",
  "authentication": {
    "authenticated": true,
    "method": "cookies",
    "hasSavedCookies": true,
    "cookiesValid": true
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

## 🚨 Troubleshooting

### Common Issues

#### Authentication Failed
```bash
# Clear saved data and re-authenticate
npm run clear-auth
# Update credentials in .env and restart
```

#### Cookies Expired
- The system automatically handles this
- Check logs for re-authentication messages
- Verify credentials are still correct

#### Rate Limiting
- Check if cookies are being used properly
- Verify `ENABLE_SMART_AUTHENTICATION=true`
- Review authentication logs

### Debug Mode

Enable detailed logging:
```env
DEBUG_AUTHENTICATION=true
DEBUG_COOKIES=true
VERBOSE_LOGGING=true
LOG_LEVEL=debug
```

## 🔐 Security

- **Credential Protection**: Store credentials securely using environment variables
- **Cookie Encryption**: Cookies are stored securely in environment
- **Session Management**: Automatic session timeout and cleanup
- **Rate Limiting**: Built-in protection against API abuse
- **Error Handling**: Secure error messages without credential exposure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙋‍♀️ Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions
- **Documentation**: Full API documentation in `/docs`

---

**Enhanced Twitter MCP Server** - The most comprehensive and reliable Twitter MCP implementation with smart authentication and persistent sessions.
