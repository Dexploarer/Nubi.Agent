# MCP Integration Guide - XMCPX Server

This guide explains how to set up and use the XMCPX (Twitter MCP) server with your ElizaOS agent.

## Overview

The XMCPX server provides Twitter functionality to your agent through the Model Context Protocol (MCP). It enables your agent to:

- Search Twitter for current information
- Post tweets and replies
- Monitor Twitter conversations
- Manage Twitter authentication with persistent sessions
- Access Twitter data through a secure, authenticated interface

## Quick Setup

### 1. Install Dependencies

The MCP plugin and XMCPX server are already configured in your project:

```bash
bun install
```

### 2. Configure Environment Variables

Create a `.env.mcp` file with your Twitter credentials:

```bash
# Twitter API Configuration
TWITTER_COOKIE_STRING="your_twitter_cookie_string"
TWITTER_CSRF_TOKEN="your_csrf_token"
TWITTER_AUTH_TOKEN="your_auth_token"

# Database Configuration (optional - for persistent storage)
DATABASE_URL="postgresql://username:password@localhost:5432/xmcpx_db"

# Logging Configuration
LOG_LEVEL="info"

# Session Management
SESSION_TIMEOUT=3600
COOKIE_REFRESH_INTERVAL=1800

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900
```

### 3. Run Setup Script

```bash
bun run setup:mcp
```

This script will:
- Validate your MCP configuration
- Check environment setup
- Install dependencies
- Test the MCP server connection

## Configuration Details

### Character Configuration

The NUBI character is already configured with MCP support in `src/character/nubi-character.ts`:

```typescript
export const nubiCharacter: Character = {
  // ... other configuration
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap", 
    "@elizaos/plugin-knowledge",
    "@elizaos/plugin-mcp", // MCP plugin enabled
    // ... other plugins
  ],
  settings: {
    // ... other settings
    mcp: {
      servers: {
        xmcpx: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@promptordie/xmcpx@latest'],
          env: {
            // Environment variables passed to the MCP server
            TWITTER_COOKIE_STRING: process.env.TWITTER_COOKIE_STRING || '',
            TWITTER_CSRF_TOKEN: process.env.TWITTER_CSRF_TOKEN || '',
            // ... other configuration
          },
        },
      },
    },
  },
};
```

### MCP Server Configuration

The XMCPX server is configured as a STDIO server, which means:

- It runs as a local process
- Communicates through standard input/output
- Automatically starts when your agent starts
- Handles Twitter authentication and session management

## Usage Examples

### Starting Your Agent

```bash
# Development mode
bun run dev

# Production mode
bun run start:production
```

### Agent Capabilities

Once configured, your agent can:

1. **Search Twitter**: "Search for the latest Solana news"
2. **Post Content**: "Post a tweet about the new feature"
3. **Monitor Conversations**: "Check what people are saying about Anubis.Chat"
4. **Engage with Community**: "Reply to the latest tweet about Solana"

### Example Interactions

```
User: "What's trending on Twitter about Solana?"
Agent: *searches Twitter and provides current trending topics*

User: "Post a tweet about the new Anubis.Chat features"
Agent: *composes and posts a tweet about the platform*

User: "Check the latest replies to our announcement"
Agent: *fetches and summarizes recent replies*
```

## Troubleshooting

### Common Issues

1. **Server not connecting**
   - Check that `@elizaos/plugin-mcp` is in your plugins array
   - Verify the command and args in the MCP configuration
   - Ensure the XMCPX package is accessible via npx

2. **Authentication errors**
   - Verify your Twitter credentials in `.env.mcp`
   - Check that cookies and tokens are valid
   - Ensure rate limits aren't exceeded

3. **Tools not available**
   - Confirm the MCP plugin is loaded
   - Check the agent logs for MCP server startup messages
   - Verify the server configuration in character settings

### Debug Mode

Enable debug logging by setting:

```bash
LOG_LEVEL="debug"
XMCPX_LOG_LEVEL="debug"
```

### Testing MCP Server

Test the MCP server independently:

```bash
bun run mcp:test
```

## Security Considerations

1. **Credential Management**
   - Never commit `.env.mcp` to version control
   - Use environment variables for sensitive data
   - Rotate Twitter tokens regularly

2. **Rate Limiting**
   - The server includes built-in rate limiting
   - Configure appropriate limits for your use case
   - Monitor usage to avoid Twitter API limits

3. **Session Management**
   - Sessions are managed automatically
   - Cookies are refreshed periodically
   - Persistent storage is optional but recommended

## Advanced Configuration

### Custom Environment Variables

You can customize the MCP server behavior by setting additional environment variables:

```bash
# Custom database for XMCPX
XMCPX_DATABASE_URL="postgresql://user:pass@localhost:5432/xmcpx"

# Custom logging
XMCPX_LOG_LEVEL="debug"
XMCPX_LOG_FILE="logs/xmcpx.log"

# Custom rate limiting
XMCPX_RATE_LIMIT_REQUESTS=50
XMCPX_RATE_LIMIT_WINDOW=600
```

### Multiple MCP Servers

You can add additional MCP servers to your configuration:

```typescript
settings: {
  mcp: {
    servers: {
      xmcpx: {
        // XMCPX configuration
      },
      firecrawl: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'firecrawl-mcp'],
        env: {
          FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || '',
        },
      },
    },
  },
},
```

## Support and Resources

- **XMCPX Documentation**: [GitHub Repository](https://github.com/Dexploarer/xmcpx)
- **ElizaOS MCP Guide**: [Official Documentation](https://docs.elizaos.ai/guides/mcp-setup-guide)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

## Next Steps

1. Configure your Twitter credentials
2. Run the setup script: `bun run setup:mcp`
3. Start your agent: `bun run dev`
4. Test Twitter functionality with your agent
5. Monitor logs for any issues
6. Customize configuration as needed

Your agent is now ready to use Twitter through the XMCPX MCP server!
