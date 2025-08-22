# Telegram Raids Integration - Complete Documentation

## Overview
This integration adds Twitter raid coordination capabilities to ElizaOS via Telegram, using cookie-based authentication through MCP (Model Context Protocol) instead of traditional Twitter API keys.

## Architecture

### Components
1. **ElizaOS Core** (`@elizaos/core`) - The main agent runtime
2. **Telegram Plugin** (`@elizaos/plugin-telegram`) - Original Telegram functionality (PRESERVED)
3. **MCP Plugin** (`@elizaos/plugin-mcp`) - Enables Twitter actions via MCP
4. **Twitter MCP Server** (`@promptordie/xmcp`) - Cookie-based Twitter authentication
5. **Enhanced Telegram Raids Service** - Custom raid management system

## Key Features

### ✅ NO Existing Commands Removed
All original Telegram plugin commands remain intact:
- `/start` - Bot initialization
- `/help` - Display help
- `/status` - Show bot status
- `/settings` - Bot configuration
- All other existing commands continue to work

### 🆕 New Raid Commands Added
- `/raid <text>` - Post a tweet and start a raid
- `/raid <url>` - Start a raid on an existing tweet
- `/active` - Show all active raids
- `/stats [raid-id]` - Display raid statistics
- `/leaderboard` - Global points leaderboard
- `/end <raid-id>` - Manually end a raid
- `/boost <raid-id]` - Boost a raid (double points)

### 🤖 Auto-Detection Features
- **URL Detection**: Automatically detects Twitter URLs with raid keywords
- **Agent Auto-Raid**: When the agent posts tweets, raids start automatically
- **Smart Parsing**: Recognizes both twitter.com and x.com URLs

### 📊 Interactive Features
- **Join Raid** - Become a raid participant (+5 points)
- **Like** - Like the tweet via MCP (+10 points)
- **Retweet** - Retweet via MCP (+15 points)
- **Reply** - Reply to the tweet (+20 points)
- **Quote** - Quote tweet (+25 points)
- **Stats** - View real-time statistics
- **Boost** - Double points for 5 minutes

## End-to-End Flow

### 1. Tweet Creation Flow
```
User: /raid Let's pump this token! 🚀
  ↓
System: Calls MCP post_tweet
  ↓
MCP Server: Authenticates with cookies
  ↓
Twitter: Tweet posted successfully
  ↓
System: Extracts tweet ID and URL
  ↓
Telegram: Interactive raid message sent
  ↓
Users: Click buttons to participate
```

### 2. URL Raid Flow
```
User: "Let's raid this tweet: https://twitter.com/user/status/123"
  ↓
System: Detects URL + raid keyword
  ↓
MCP: Fetches tweet information
  ↓
System: Creates raid for existing tweet
  ↓
Telegram: Interactive raid message sent
```

### 3. Agent Auto-Raid Flow
```
Agent: Posts tweet via MCP
  ↓
System: Hooks into processAction
  ↓
Auto-Raid: Created with autoStarted flag
  ↓
Telegram: Notifications sent to all configured chats
```

## Data Persistence

### Raid Data (`raid-data.json`)
- Raid ID, tweet details, participants
- Action tracking (likes, retweets, replies)
- Statistics and growth metrics
- Active/inactive status

### Leaderboard (`leaderboard.json`)
- User points and rankings
- Total raids participated
- Action history
- Persistent across restarts

## Monitoring & Updates

### Real-time Monitoring
- **Interval**: Every 30 seconds
- **Updates**: Tweet stats via MCP
- **Calculations**: Growth rates, engagement metrics
- **Display**: Live message updates

### Stale Raid Cleanup
- **Interval**: Every 2 hours
- **Threshold**: Raids inactive for 2+ hours
- **Action**: Automatically marked as ended

## Environment Configuration

```bash
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TWITTER_USERNAME=your_twitter_username
TWITTER_EMAIL=your_twitter_email
TWITTER_PASSWORD=your_twitter_password

# Optional
TELEGRAM_ALLOWED_CHATS=chatid1,chatid2  # For auto-raids
```

## MCP Configuration

The system uses cookie-based authentication via `agent-twitter-client`:
- No Twitter API keys required
- Authenticates with username/email/password
- Extracts and manages cookies
- Provides full Twitter functionality

## Integration Points

### With Existing Telegram Plugin
- Runs alongside, doesn't replace
- Separate bot instance for raids
- No command conflicts
- Original functionality preserved

### With MCP Plugin
- Uses MCP tools for Twitter actions
- `post_tweet` - Create tweets
- `like_tweet` - Like tweets
- `retweet` - Retweet posts
- `get_tweet_info` - Fetch stats

## Error Handling

### MCP Server Issues
- Queues actions with retry logic
- Exponential backoff
- User notifications on failure

### Twitter Rate Limits
- Caches responses
- Reduces polling frequency
- Uses last known stats

### Telegram API Errors
- Retries message updates
- Maintains state consistency
- Logs errors for debugging

## Performance Optimizations

### Message Updates
- Debounced to prevent spam
- Maximum 1 update per 5 seconds
- Batch updates when possible

### API Calls
- Batched for multiple raids
- Cached responses
- Optimized polling intervals

## Testing Checklist

- [x] Original Telegram commands work
- [x] MCP Twitter integration functional
- [x] Cookie-based auth working
- [x] Raid creation from text
- [x] Raid creation from URL
- [x] Auto-raid on agent tweets
- [x] Interactive buttons responsive
- [x] Points system accurate
- [x] Leaderboard updates correctly
- [x] Stats monitoring active
- [x] Data persists across restarts
- [x] Error handling robust
- [x] Performance optimized

## Usage Examples

### Start a Raid with New Tweet
```
/raid Check out this amazing project! 🚀 #crypto
```

### Start a Raid on Existing Tweet
```
/raid https://twitter.com/elonmusk/status/1234567890
```
Or just paste the URL with a raid keyword:
```
Let's raid this: https://x.com/user/status/123
```

### Check Active Raids
```
/active
```

### View Leaderboard
```
/leaderboard
```

### End a Raid
```
/end abc-def-123
```

## Security Considerations

- Cookies stored securely
- No API keys in code
- Environment variables for sensitive data
- Rate limiting to prevent abuse
- User permission checks

## Deployment

1. Install dependencies:
```bash
npm install telegraf agent-twitter-client uuid
```

2. Configure environment variables

3. Add to ElizaOS character:
```javascript
import telegramPlugin from '@elizaos/plugin-telegram';
import mcpPlugin from '@elizaos/plugin-mcp';
import telegramRaidsPlugin from './telegram-raids-integration';

const character = {
    plugins: [
        telegramPlugin,      // Original Telegram
        mcpPlugin,          // MCP for Twitter
        telegramRaidsPlugin // Raids extension
    ]
};
```

4. Start the agent

## Summary

This integration successfully:
- ✅ Preserves ALL existing Telegram functionality
- ✅ Adds comprehensive raid management
- ✅ Uses cookie-based Twitter auth (no API keys)
- ✅ Provides real-time engagement tracking
- ✅ Implements gamification with points
- ✅ Auto-detects and auto-starts raids
- ✅ Persists data across restarts
- ✅ Handles errors gracefully
- ✅ Optimizes performance

The system is production-ready and fully tested.
