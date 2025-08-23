# Analyze Raid Performance

Analyze Telegram raid performance using ElizaOS memory patterns and XMCPX MCP tools.

**Usage**: `/project:analyze-raid-performance [raid_id]`

## Task

Analyze raid performance and generate comprehensive metrics:

Raid ID: $ARGUMENTS

## Analysis Steps

1. **Retrieve Raid Context**
   - Use ElizaOS memory search for raid data
   - Get participant information and actions
   - Collect engagement metrics

2. **MCP Tool Integration**
   - Connect to XMCPX MCP server
   - Use `getRaidStats` tool for Twitter metrics
   - Get leaderboard data with `getLeaderboard`

3. **Performance Metrics**
   - Participant count and verification rates
   - Action completion rates (likes, retweets, replies)
   - Response time analysis
   - Engagement scoring

4. **Generate Report**
   - Success rate calculation
   - Top performer identification
   - Improvement recommendations

## ElizaOS Memory Queries

```typescript
// Search for raid memories
const raidMemories = await runtime.searchMemories({
  embedding: await runtime.useModel(ModelType.TEXT_EMBEDDING, {
    text: raidId
  }),
  roomId: roomId,
  count: 50,
  match_threshold: 0.7,
  tableName: "memories",
});

// Filter for raid participants and metrics
const participants = raidMemories
  .filter(m => m.content.type === "raid_participant")
  .map(m => m.content);

const analytics = raidMemories
  .find(m => m.content.type === "raid_analytics");
```

## XMCPX Tools Usage

Use these MCP tools for comprehensive analysis:
- `/mcp__xmcpx__getRaidStats` - Get detailed raid statistics
- `/mcp__xmcpx__getLeaderboard` - Get top performer rankings
- `/mcp__xmcpx__monitorRaid` - Get current raid status

## Report Structure

1. **Executive Summary**
   - Total participants
   - Success rate
   - Key achievements

2. **Detailed Metrics**
   - Action breakdown by type
   - Verification rates
   - Timeline analysis

3. **Participant Analysis**
   - Top performers
   - Engagement patterns
   - Participation trends

4. **Recommendations**
   - Optimization opportunities
   - Strategy improvements
   - Next steps

Generate actionable insights for improving future raid coordination.