# Twitter MCP Server with Raid Tweet Functionality

## Overview
Enhanced Twitter MCP server with smart cookie management, persistent authentication, and specialized raid tweet functionality for the NUBI/Anubis community.

## New Features Added

### 1. ESLint Configuration
- Added `.eslintrc.json` with TypeScript support
- Run `npm run lint` for code quality checks
- Minor warnings only, no build-breaking errors

### 2. Health Checks
- **MCP Tool**: `health_check` - Returns authentication status, API connectivity, memory usage
- **HTTP Endpoint**: `GET http://localhost:3000/health` (when `DISABLE_HTTP_SERVER=false`)
- Environment variables:
  - `DISABLE_HTTP_SERVER=false` (enable HTTP health endpoint)
  - `PORT=3000` (default port)

### 3. MCP Prompts
Following the Model Context Protocol specification, added prompts agents can invoke:

- `tweet_compose` - Compose engaging tweets under 280 chars
- `thread_plan` - Plan educational threads (3-8 tweets)  
- `reply_helpful` - Draft constructive replies
- `profile_summary` - Analyze profiles and suggest tweet ideas
- `raid_viral` - **NEW**: Generate viral raid tweets with community hashtags

### 4. Raid Tweet Tool & Prompt

#### MCP Tool: `post_raid_tweet`
**Purpose**: Post a viral tweet with NUBI community hashtags and return the X link for Telegram raid system

**Input**:
```json
{
  "message": "Your main tweet content here",
  "hashtags": ["#AnubisChat", "#Anubis", "#anubisai", "#OpenSource"] // optional, defaults to community tags
}
```

**Output**:
```json
{
  "success": true,
  "tweet": {
    "id": "1234567890123456789",
    "text": "Your tweet text with hashtags",
    "permanentUrl": "https://x.com/username/status/1234567890123456789"
  },
  "x_link": "https://x.com/username/status/1234567890123456789",
  "message": "Raid tweet posted successfully"
}
```

#### MCP Prompt: `raid_viral`
**Purpose**: Structured prompt to generate viral raid tweets following NUBI community patterns

**Arguments**:
- `topic` (required): Core topic or announcement
- `call_to_action` (required): What you want the community to do  
- `urgency` (optional): "low", "medium", "high" - affects emojis and language

**Template Structure**:
```
🚀 [topic] [urgency_emoji]

The NUBI community is [urgency_verb] - this is exactly what we've been building toward!

[call_to_action] and let's show the world what #AnubisChat can do! 

🔥 RT and engage below!

#AnubisChat #Anubis #anubisai #OpenSource

🌐 https://x.com/i/communities/1955910343378505822
```

#### YAML Prompt Configuration
Located at `prompts/raid_tweet.yaml` - provides deterministic template with:
- Dynamic emoji/language based on urgency level
- Guaranteed hashtag inclusion  
- Community link integration
- Character limit validation
- Example scenarios for different urgency levels

## Usage Examples

### For MCP Clients (Claude, etc.)

1. **List available prompts**:
   ```
   Client sends: ListPrompts request
   Server returns: All 5 prompts including raid_viral
   ```

2. **Get the raid prompt**:
   ```
   Client sends: GetPrompt with name="raid_viral"
   Server returns: Full prompt with template and instructions
   ```

3. **Use the raid tool directly**:
   ```json
   {
     "tool": "post_raid_tweet",
     "arguments": {
       "message": "🚀 NUBI just launched new DeFi integrations 🔥\n\nThe NUBI community is buzzing - this is exactly what we've been building toward!\n\nCheck it out and let's show the world what #AnubisChat can do!\n\n🔥 RT and engage below!\n\n🌐 https://x.com/i/communities/1955910343378505822"
     }
   }
   ```

### For Telegram Bot Integration

The bot can now:
1. Use the `raid_viral` prompt to generate consistent viral tweets
2. Call `post_raid_tweet` to post and get the X link
3. Return the X link to Telegram for the raid system
4. Ensure all tweets include the required NUBI hashtags

**Example Flow**:
```
1. Telegram admin: "/setraid New features launched"
2. Bot uses raid_viral prompt with topic="New features launched", call_to_action="Check it out", urgency="high"
3. Bot calls post_raid_tweet MCP tool
4. Bot receives X link: "https://x.com/anubis_cult_bot/status/1234567890"
5. Bot sends X link to Telegram for raid coordination
```

## Configuration

### Environment Variables
```bash
# Authentication (first run with credentials, then cookies are auto-saved)
AUTH_METHOD=credentials
TWITTER_USERNAME=your_username  
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email@example.com

# After first run, cookies are saved:
# AUTH_METHOD=cookies
# TWITTER_COOKIES=["auth_token=...", "ct0=...", "twid=..."]

# Health endpoint
DISABLE_HTTP_SERVER=false
PORT=3000

# Optional features
ENABLE_SMART_AUTHENTICATION=true
AUTO_SAVE_COOKIES=true
```

### Running the Server

```bash
# Install and build
npm install
npm run build

# Start MCP server (for MCP clients)
node build/index.js

# Health check
curl http://localhost:3000/health
```

## Integration Notes

### NUBI Bot Integration
The bot can use this MCP server to:
- Generate consistent, viral raid tweets using the `raid_viral` prompt
- Post tweets and get X links via `post_raid_tweet` tool
- Ensure all tweets include proper community hashtags
- Maintain session persistence to avoid Twitter rate limits

### Community Hashtags
All raid tweets automatically include:
- `#AnubisChat` - Primary community tag
- `#Anubis` - Brand tag  
- `#anubisai` - AI/tech tag
- `#OpenSource` - Philosophy tag

### Character Limit Compliance
- Template ensures tweets stay under 280 characters
- Community link and hashtags are factored into length
- Urgency emojis are optimized for engagement vs length

## Testing

```bash
# Lint code
npm run lint

# Test MCP interface
npm run test:interface

# Build verification  
npm run build
```

The server is now ready for production use with the NUBI Telegram bot system and provides guaranteed viral tweet generation with community hashtag inclusion and X link extraction.
