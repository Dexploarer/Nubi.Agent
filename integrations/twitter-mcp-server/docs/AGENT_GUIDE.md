# twitter-mcp-server Guide for AI Agents

This guide is designed to help AI agents (like Claude) effectively use the twitter-mcp-server to interact with Twitter.

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

> **Important**: Grok functionality requires [agent-twitter-client v0.0.19](https://github.com/elizaOS/agent-twitter-client/releases/tag/0.0.19) or higher. If you're using v0.0.18, you'll need to upgrade to use Grok features.

### Utility Tools

- `health_check`: Check the health of the twitter-mcp-server server

## Effective Prompting Patterns

### Reading Tweets

#### Get Tweets from a User

```
Can you get the latest 5 tweets from @elonmusk?
```

This will use the `get_user_tweets` tool to fetch tweets from the specified user.

Example command in the test interface:
```
twitter-mcp-server> tweets elonmusk 5
```

#### Search for Tweets

```
Search Twitter for tweets about "artificial intelligence" and summarize the main themes.
```

This will use the `search_tweets` tool to find tweets matching the query.

Example command in the test interface:
```
twitter-mcp-server> search "artificial intelligence" 10
```

#### Get a Specific Tweet

```
Can you show me the tweet with ID 1234567890123456789?
```

This will use the `get_tweet_by_id` tool to fetch a specific tweet.

Example command in the test interface:
```
twitter-mcp-server> tweet 1234567890123456789
```

### Writing Tweets

#### Post a Simple Tweet

```
Post a tweet saying "Just tried the new twitter-mcp-server integration with Claude. It works great!"
```

This will use the `send_tweet` tool to post a new tweet.

Example command in the test interface:
```
twitter-mcp-server> post Just tried the new twitter-mcp-server integration with Claude. It works great!
```

#### Post a Tweet with Media

```
Post a tweet with this image. The tweet should say "Beautiful sunset today!"
```

This will use the `send_tweet` tool with media attachment.

#### Create a Poll

```
Create a Twitter poll asking "What's your favorite AI assistant?" with options: Claude, ChatGPT, Bard, and Bing. The poll should run for 24 hours.
```

This will use the `send_tweet_with_poll` tool to create a poll.

#### Reply to a Tweet

```
Reply to tweet 1234567890123456789 saying "Great point! I completely agree."
```

This will use the `send_tweet` tool with the `replyToTweetId` parameter.

#### Quote a Tweet

```
Quote tweet 1234567890123456789 saying "This is an important perspective on AI safety."
```

This will use the `quote_tweet` tool.

Example command in the test interface:
```
twitter-mcp-server> quote 1234567890123456789 This is an important perspective on AI safety.
```

### Interacting with Tweets

#### Like a Tweet

```
Like the tweet with ID 1234567890123456789.
```

This will use the `like_tweet` tool.

Example command in the test interface:
```
twitter-mcp-server> like 1234567890123456789
```

#### Retweet

```
Retweet the tweet with ID 1234567890123456789.
```

This will use the `retweet` tool.

Example command in the test interface:
```
twitter-mcp-server> retweet 1234567890123456789
```

### User Profiles

#### Get a User's Profile

```
Show me the profile information for @OpenAI.
```

This will use the `get_user_profile` tool.

Example command in the test interface:
```
twitter-mcp-server> profile OpenAI
```

#### Follow a User

```
Follow the user @elonmusk.
```

This will use the `follow_user` tool.

Example command in the test interface:
```
twitter-mcp-server> follow elonmusk
```

#### Get Followers/Following

```
Show me the first 10 followers of user 12345.
```

This will use the `get_followers` tool.

Example command in the test interface:
```
twitter-mcp-server> followers 12345 10
```

### Grok Integration

#### Chat with Grok

```
Use Grok to explain quantum computing in simple terms.
```

This will use the `grok_chat` tool to interact with Grok.

Example command in the test interface:
```
twitter-mcp-server> grok Explain quantum computing in simple terms.
```

#### Continue a Grok Conversation

```
Continue the Grok conversation and ask it to elaborate on quantum entanglement.
```

This will use the `grok_chat` tool with the previous conversation ID.

#### Leveraging Grok's Twitter Data Access

Grok on Twitter has unique access to Twitter's real-time data that even the standalone Grok API doesn't have. You can leverage this to:

```
Use Grok to analyze the current trending topics on Twitter and explain why they might be trending.
```

```
Ask Grok to analyze the sentiment around cryptocurrency discussions on Twitter in the past week.
```

```
Have Grok identify the most influential voices discussing climate change on Twitter right now.
```

#### Requesting Citations and Search Results

Grok can provide web search results and citations for its responses:

```
Use Grok to research quantum computing breakthroughs and provide citations for the information.
```

This will use the `grok_chat` tool with the `returnSearchResults` and `returnCitations` parameters set to true.

### Grok Research Workflow

```
1. Use Grok to research a complex topic
2. Ask follow-up questions to deepen understanding
3. Request citations and sources for further reading
4. Summarize the key insights from the conversation
```

### Health Check

```
Check the health of the twitter-mcp-server server.
```

This will use the `health_check` tool to verify the server's status.

Example command in the test interface:
```
twitter-mcp-server> health
```

## Complex Tasks

### Thread Creation

To create a thread of tweets:

```
Create a Twitter thread about climate change with 3 tweets:
1. "Climate change is one of the biggest challenges facing humanity today. We need immediate action to reduce carbon emissions."
2. "Renewable energy sources like solar and wind are becoming more affordable and efficient. They're key to a sustainable future."
3. "Individual actions matter too. Reducing meat consumption, using public transport, and minimizing waste all help combat climate change."
```

### Content Analysis

To analyze Twitter content:

```
Search for the latest 20 tweets about "Web3" and analyze the sentiment. Are people generally positive or negative about it?
```

### User Research

To research a Twitter user:

```
Research @OpenAI on Twitter. Get their profile information, their latest 10 tweets, and tell me what topics they typically tweet about.
```

## Best Practices

1. **Be Specific**: Clearly specify what you want to do on Twitter.
2. **Provide Context**: When posting tweets, explain the purpose and content.
3. **Handle Media Properly**: When working with images or videos, be clear about what media to include.
4. **Respect Privacy**: Be cautious about retrieving and sharing personal information.
5. **Follow Twitter's Rules**: Ensure content complies with Twitter's terms of service.
6. **Error Handling**: If an operation fails, check for common issues like authentication problems or rate limiting.
7. **Use the Test Interface**: When developing or debugging, use the test interface to verify functionality.

## Troubleshooting

If you encounter issues:

### Authentication Problems

1. **Cookie Expiration**: Twitter cookies typically expire after a certain period. If authentication fails, the user may need to refresh their cookies.
2. **Cookie Format**: Ensure cookies are properly formatted with the correct domain (`.twitter.com`).
3. **Required Cookies**: Make sure all essential cookies are included: `auth_token`, `ct0`, and `twid`.

Example of properly formatted cookies:
```
["auth_token=value; Domain=.twitter.com", "ct0=value; Domain=.twitter.com", "twid=u%3Dvalue; Domain=.twitter.com"]
```

### Rate Limiting

Twitter limits API calls. If you hit rate limits:
1. Implement exponential backoff (wait longer between retries)
2. Reduce the frequency of requests
3. Prioritize essential operations

### Content Restrictions

Twitter may block certain content:
1. Ensure content follows Twitter's guidelines
2. Avoid posting identical content repeatedly
3. Be cautious with sensitive topics

### API Changes

Twitter occasionally changes its API:
1. If a feature doesn't work, it might be due to API changes
2. Check for updates to the MCP
3. Use the health check to verify connectivity

## Example Workflows

### Research Workflow

```
1. Search Twitter for tweets about "climate change" from the past week
2. Analyze the most engaged tweets on this topic
3. Identify key influencers discussing climate change
4. Summarize the main arguments and perspectives
```

### Engagement Workflow

```
1. Find trending tweets about AI
2. Like relevant tweets that align with the user's interests
3. Reply to a tweet with a thoughtful comment
4. Post an original tweet contributing to the conversation
```

### Content Creation Workflow

```
1. Research a topic on Twitter to understand current discussions
2. Draft a tweet or thread based on this research
3. Create a poll to engage followers on the topic
4. Monitor responses and engage with replies
```

### Grok Research Workflow

```
1. Use Grok to research a complex topic
2. Ask follow-up questions to deepen understanding
3. Request citations and sources for further reading
4. Summarize the key insights from the conversation
```

By following these patterns and best practices, AI agents can effectively use the twitter-mcp-server to provide valuable Twitter integration for users. 