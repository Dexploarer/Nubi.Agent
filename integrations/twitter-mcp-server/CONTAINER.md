# twitter-mcp-server Docker Image

This Docker image provides a Model Context Protocol (MCP) server that integrates with Twitter using the `agent-twitter-client` package, allowing AI models to interact with Twitter without direct API access.

## Usage

### Pull the image

```bash
docker pull ghcr.io/ryanmac/twitter-mcp-server:latest
```

### Run with Docker

```bash
docker run -p 3001:3000 \
  -e AUTH_METHOD=cookies \
  -e TWITTER_COOKIES='["auth_token=YOUR_AUTH_TOKEN; Domain=.twitter.com", "ct0=YOUR_CT0_VALUE; Domain=.twitter.com"]' \
  ghcr.io/ryanmac/twitter-mcp-server:latest
```

### Run with Docker Compose

Create a `.env` file with your configuration:

```
# Port Configuration
MCP_HOST_PORT=3001    # The port on your host machine
MCP_CONTAINER_PORT=3000  # The port inside the container

# Twitter Authentication
AUTH_METHOD=cookies
TWITTER_COOKIES=[]
```

Then run:

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

- `PORT`: The port the server listens on inside the container (default: 3000)
- `AUTH_METHOD`: Authentication method (cookies, credentials, or api)
- `TWITTER_COOKIES`: JSON array of Twitter cookies
- `TWITTER_USERNAME`: Twitter username (for credentials auth)
- `TWITTER_PASSWORD`: Twitter password (for credentials auth)
- `TWITTER_EMAIL`: Twitter email (for credentials auth)
- `TWITTER_2FA_SECRET`: Twitter 2FA secret (for credentials auth)
- `TWITTER_API_KEY`: Twitter API key (for API auth)
- `TWITTER_API_SECRET_KEY`: Twitter API secret key (for API auth)
- `TWITTER_ACCESS_TOKEN`: Twitter access token (for API auth)
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter access token secret (for API auth)

## Features

- Tweet operations (fetch, search, post, like, retweet)
- User operations (profiles, follow, followers)
- Grok integration

For more information, see the [full documentation](https://github.com/ryanmac/twitter-mcp-server).
