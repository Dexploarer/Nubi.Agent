# Start Telegram Raid

Initiate a new Telegram raid using XMCPX MCP server integration.

**Usage**: `/project:start-raid [target_url] [raid_type] [duration_minutes]`

## Task

Start a new Telegram raid with the following parameters:

Parameters: $ARGUMENTS

## Raid Initiation Process

1. **Parse Parameters**
   - Target URL (Twitter/X post or "create" for new tweet)
   - Raid type (like, retweet, reply, quote, follow, multi)
   - Duration in minutes (default: 60)

2. **Use XMCPX MCP Tools**
   - `/mcp__xmcpx__startRaid` - Initiate the raid
   - Configure objectives and parameters
   - Set up tracking and monitoring

3. **ElizaOS Memory Integration**
   - Store raid context in ElizaOS memory
   - Initialize participant tracking
   - Set up progress monitoring

## XMCPX Start Raid Parameters

```json
{
  "targetUrl": "https://x.com/username/status/123456789",
  "raidType": "multi",
  "duration": 60,
  "objectives": {
    "likes": 50,
    "retweets": 25,
    "replies": 10,
    "quotes": 5,
    "follows": 20
  },
  "message": "🚀 New NUBI raid started! Let's show our community power!",
  "hashtags": ["#NUBI", "#AnubisChat", "#CommunityPower"]
}
```

## Raid Types

- **like**: Focus on likes only
- **retweet**: Focus on retweets only  
- **reply**: Focus on replies with hashtags
- **quote**: Focus on quote tweets
- **follow**: Focus on following the target account
- **multi**: Multiple objectives (likes, retweets, replies, quotes, follows)

## Multi-Parameter Raid Configuration

For multi-parameter raids, set balanced objectives:
- **Likes**: 40-60% of expected participants
- **Retweets**: 20-35% of expected participants  
- **Replies**: 8-15% of expected participants
- **Quotes**: 3-8% of expected participants
- **Follows**: 15-25% of expected participants

## Post-Initiation Actions

1. **Monitor Progress**
   - Use `/project:monitor-raid` command
   - Track real-time participation
   - Monitor completion rates

2. **Community Notification**
   - Announce raid in Telegram channels
   - Provide participation instructions
   - Share raid objectives and rewards

3. **Analytics Setup**
   - Initialize raid success evaluator
   - Set up progress tracking
   - Configure leaderboard updates

The raid will automatically track participants, verify actions, and calculate rewards based on the configured objectives.