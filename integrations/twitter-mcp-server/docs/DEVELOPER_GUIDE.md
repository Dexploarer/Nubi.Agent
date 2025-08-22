# twitter-mcp-server Developer Guide

This guide provides comprehensive information for developers who want to use, extend, or contribute to the twitter-mcp-server server.

## Architecture Overview

The twitter-mcp-server server is built with a modular architecture:

```
twitter-mcp-server/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── types.ts                 # Type definitions
│   ├── authentication.ts        # Authentication manager
│   ├── twitter-client.ts        # Twitter client wrapper
│   ├── health.ts                # Health check functionality
│   ├── test-interface.ts        # Interactive testing interface
│   ├── tools/                   # MCP tool implementations
│   │   ├── tweets.ts            # Tweet-related tools
│   │   ├── profiles.ts          # Profile-related tools
│   │   └── grok.ts              # Grok integration tools
│   ├── utils/                   # Utility functions
│   │   ├── formatters.ts        # Response formatters
│   │   ├── validators.ts        # Input validators
│   │   └── logger.ts            # Logging utilities
│   └── types/                   # Type declarations
│       └── agent-twitter-client.d.ts # Twitter client type declarations
├── tests/                       # Load testing
│   ├── load-test.yml            # Load test configuration
│   └── load-test-functions.js   # Load test functions
└── docs/
    ├── TESTING.md               # Testing guide
    ├── AGENT_GUIDE.md           # Guide for AI agents
    └── DEVELOPER_GUIDE.md       # This file
```

### Key Components

1. **Authentication Manager**: Handles Twitter authentication using cookies, credentials, or API keys.
2. **Twitter Client**: Wraps the agent-twitter-client package to provide a clean interface.
3. **MCP Tools**: Implements the Model Context Protocol tools for tweets, profiles, and Grok.
4. **Utilities**: Provides formatting, validation, and logging functionality.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Twitter credentials (see [Authentication](#authentication))

### Installation

```bash
# Clone the repository
git clone https://github.com/ryanmac/twitter-mcp-server.git
cd twitter-mcp-server

# Install dependencies
npm install

# Create a .env file with your Twitter credentials
touch .env
```

Edit the `.env` file with your Twitter credentials (see [Authentication](#authentication)).

### Building

```bash
# Build the project
npm run build

# Start the server
npm start
```

## Authentication

The twitter-mcp-server supports three authentication methods:

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

## Available Tools

The twitter-mcp-server provides the following tools:

### Tweet Tools

- `get_user_tweets`: Fetch tweets from a specific user
- `get_tweet_by_id`: Fetch a specific tweet by ID
- `search_tweets`: Search for tweets
- `send_tweet`: Post a new tweet
- `send_tweet_with_poll`: Post a tweet with a poll
- `like_tweet`: Like a tweet
- `retweet`: Retweet a tweet
- `quote_tweet`: Quote a tweet

### Profile Tools

- `get_user_profile`: Get a user's profile
- `follow_user`: Follow a user
- `get_followers`: Get a user's followers
- `get_following`: Get users a user is following

### Grok Tools

- `grok_chat`: Chat with Grok via Twitter

This tool enables interaction with Twitter's Grok AI assistant, providing access to:
- Real-time Twitter data analysis
- Web search capabilities
- Conversation history management
- Citations for information sources

> **Important**: Grok functionality requires [agent-twitter-client v0.0.19](https://github.com/elizaOS/agent-twitter-client/releases/tag/0.0.19) or higher. The current package uses v0.0.18 for basic functionality, but you'll need to upgrade to v0.0.19 to use Grok features.

The implementation directly interfaces with Twitter's internal Grok API endpoints, handling authentication, conversation creation, and response parsing. It supports both new conversations and continuing existing ones via conversation IDs.

#### Grok Implementation Details

The Grok functionality is implemented in `src/twitter-client.ts` and uses Twitter's GraphQL and REST APIs:
- `https://x.com/i/api/graphql/6cmfJY3d7EPWuCSXWrkOFg/CreateGrokConversation` for creating new conversations
- `https://api.x.com/2/grok/add_response.json` for sending messages and receiving responses

The implementation handles various response formats, including:
- Streaming responses with multiple JSON chunks
- Single JSON responses
- Rate limiting responses
- Error responses

#### Grok Rate Limiting

Grok has rate limits enforced by Twitter:
- Non-premium accounts: 25 messages per 2 hours
- The implementation detects rate limiting and provides appropriate error messages

### Utility Tools

- `health_check`: Check the health of the twitter-mcp-server server

## Extending the MCP

### Adding a New Tool

To add a new tool to the MCP:

1. Define the input schema in `src/types.ts`:

```typescript
export const MyNewToolSchema = z.object({
  param1: z.string().min(1, 'Param1 is required'),
  param2: z.number().int().min(1).max(100).default(10)
});
```

2. Add the tool implementation in the appropriate file in `src/tools/`:

```typescript
async myNewTool(authConfig: AuthConfig, args: unknown) {
  const params = validateInput(MyNewToolSchema, args);
  // Implement the tool functionality
  return {
    result: 'Success',
    data: { /* ... */ }
  };
}
```

3. Register the tool in `src/index.ts`:

```typescript
{
  name: 'my_new_tool',
  description: 'Description of the new tool',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of param1'
      },
      param2: {
        type: 'number',
        description: 'Description of param2',
        default: 10
      }
    },
    required: ['param1']
  }
} as Tool,
```

4. Add the tool handler in the `CallToolRequestSchema` handler:

```typescript
case 'my_new_tool':
  return {
    content: [{ 
      type: 'text',
      text: JSON.stringify(await toolsInstance.myNewTool(authConfig, args))
    }] as TextContent[]
  };
```

5. Add the command to the test interface in `src/test-interface.ts` if applicable:

```typescript
case 'my_new_tool':
  if (!args[1]) {
    console.log('Error: Parameter is required');
    break;
  }
  console.log(`Executing my_new_tool with ${args[1]}...`);
  const result = await toolsInstance.myNewTool(authConfig, { 
    param1: args[1],
    param2: args[2] ? parseInt(args[2]) : 10
  });
  console.log(JSON.stringify(result, null, 2));
  break;
```

### Modifying Existing Tools

To modify an existing tool:

1. Locate the tool implementation in `src/tools/`
2. Update the implementation as needed
3. Update the tool schema in `src/types.ts` if necessary
4. Update the tool registration in `src/index.ts` if necessary
5. Update the test interface command in `src/test-interface.ts` if necessary

## Error Handling

The MCP uses a centralized error handling approach:

1. **TwitterMcpError**: Custom error class for MCP-specific errors
2. **Input Validation**: Uses Zod schemas to validate inputs
3. **Error Logging**: Logs errors with context for debugging

Example of proper error handling:

```typescript
try {
  // Attempt an operation
} catch (error) {
  if (error instanceof TwitterMcpError) {
    // Handle MCP-specific errors
    throw error;
  }
  // Handle other errors
  throw new TwitterMcpError(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
    'operation_error',
    500
  );
}
```

## Logging

The MCP uses Winston for logging:

```typescript
import { logInfo, logError, logWarning, logDebug } from './utils/logger.js';

// Log information
logInfo('Operation completed', { context: 'value' });

// Log errors
try {
  // Attempt an operation
} catch (error) {
  logError('Operation failed', error, { context: 'value' });
}
```

Log files:
- `error.log`: Contains error-level messages
- `combined.log`: Contains all log messages

## Testing

### Unit Testing

The MCP includes unit tests for core functionality:

```bash
# Run unit tests
npm test
```

### Integration Testing

Integration tests are available to test the MCP against the Twitter API:

```bash
# Run integration tests (requires valid Twitter credentials)
RUN_INTEGRATION_TESTS=true npm test
```

### Manual Testing

The MCP includes an interactive test interface for manual testing:

```bash
# Run the test interface
npm run test:interface
```

## Deployment

### Docker Deployment

The MCP includes a Dockerfile and docker-compose.yml for containerized deployment:

```bash
# Build the Docker image
docker build -t twitter-mcp-server .

# Run the container
docker run -p 3000:3000 \
  -e AUTH_METHOD=cookies \
  -e TWITTER_COOKIES='["auth_token=value; Domain=.twitter.com", "ct0=value; Domain=.twitter.com", "twid=u%3Dvalue; Domain=.twitter.com"]' \
  twitter-mcp-server
```

#### Using Docker Compose

For a more comprehensive setup, you can use Docker Compose:

1. Create a `.env` file with your Twitter credentials
2. Run with docker-compose:

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The docker-compose.yml file includes:
- Environment variable configuration
- Volume mounting for logs
- Network configuration
- Restart policy

#### Docker Development Workflow

For development with Docker:

1. Make changes to the code
2. Rebuild the Docker image:
   ```bash
   docker-compose build
   ```
3. Restart the container:
   ```bash
   docker-compose up -d
   ```
4. View logs:
   ```bash
   docker-compose logs -f
   ```

### Environment Variables

In addition to authentication variables, you can set:

- `LOG_LEVEL`: Set logging level (error, warn, info, debug)
- `NODE_ENV`: Set environment (development, production)
- `RUN_INTEGRATION_TESTS`: Enable/disable integration tests
- `RUN_WRITE_TESTS`: Enable/disable write tests (posting, liking, etc.)

### Health Monitoring

The MCP includes a health check tool that can be used for monitoring:

```bash
# Check the health of the MCP using the test interface
npm run test:interface
twitter-mcp-server> health
```

## Development Environment

### VSCode Configuration

The repository includes VSCode configuration files to enhance the development experience:

#### Recommended Extensions

The `.vscode/extensions.json` file recommends the following extensions:
- ESLint: For code linting
- Prettier: For code formatting
- TypeScript Next: For TypeScript language features
- Jest: For test running and debugging
- DotENV: For .env file syntax highlighting
- NPM Intellisense: For npm package autocompletion
- Path Intellisense: For file path autocompletion
- Docker: For Docker file support

#### Editor Settings

The `.vscode/settings.json` file includes settings for:
- Format on save
- ESLint auto-fix on save
- TypeScript configuration
- File exclusions
- Search exclusions
- Import path preferences

#### Debugging

The `.vscode/launch.json` file includes configurations for:
- Debugging the MCP server
- Debugging the test interface
- Debugging individual Jest tests

To start debugging:
1. Open the Debug panel in VSCode
2. Select a debug configuration
3. Press F5 or click the green play button

#### Tasks

The `.vscode/tasks.json` file includes tasks for:
- Building the project
- Starting the server
- Running linting
- Running tests
- Running the test interface

To run a task:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type "Run Task"
3. Select the task to run

## Security Considerations

### Authentication Security

- Store credentials securely, preferably using environment variables or a secure vault
- Use cookie authentication when possible, as it's the most reliable method
- Rotate API keys regularly
- Never commit credentials to version control

### Input Validation

All inputs are validated using Zod schemas to prevent injection attacks and other security issues.

### Rate Limiting

Twitter imposes rate limits on API calls. The MCP does not currently implement rate limiting, so be careful not to exceed Twitter's limits.

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Check that your credentials are correct and up-to-date
   - Ensure cookies are properly formatted with the correct domain
   - Try refreshing your cookies by logging out and back into Twitter

2. **API Rate Limiting**:
   - Twitter limits API calls, which can cause failures
   - Implement exponential backoff for retries
   - Monitor rate limit headers in responses

3. **Zod Validation Errors**:
   - Check that your input data matches the expected schema
   - Look for missing required fields or invalid data types
   - Check for string length or number range violations

### Debugging

1. **Enable Debug Logging**:
   ```
   LOG_LEVEL=debug npm start
   ```

2. **Check Log Files**:
   - `error.log`: Contains error-level messages
   - `combined.log`: Contains all log messages

3. **Use the Test Interface**:
   ```
   npm run test:interface
   ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -am 'Add my feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 