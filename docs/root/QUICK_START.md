# Quick Start Guide

## 🚀 Get NUBI Running in 5 Minutes

### Prerequisites
- Node.js 18+
- Git
- OpenAI API Key

### Step 1: Clone and Setup

```bash
# Clone repository
git clone https://github.com/Dexploarer/dex-analytics.git
cd dex-analytics

# Install dependencies
cd anubis
npm install
```

### Step 2: Configure Environment

Create `.env` file in `/anubis`:

```env
# Minimum Required
OPENAI_API_KEY=sk-your-key-here

# Optional but Recommended
TELEGRAM_BOT_TOKEN=your-bot-token  # For Telegram
DISCORD_API_TOKEN=your-discord-token  # For Discord
```

### Step 3: Run the Agent

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run start
```

### Step 4: Verify It's Working

You should see:
```
🚀 Initializing NUBI - The Symbiotic Essence of Anubis
✨ Symbiotic Essence Features: {
  personalityDimensions: 10,
  emotionalStates: 7,
  plugins: 3
}
🎯 NUBI Agent ready for deployment
```

## 🎮 Platform Setup

### Telegram Bot

1. Create bot with [@BotFather](https://t.me/botfather)
2. Get bot token
3. Add to `.env`:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

4. Start bot:
```bash
npm run start
```

5. Add bot to your group and interact!

### Discord Bot

1. Create application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Create bot and get token
3. Add to `.env`:
```env
DISCORD_API_TOKEN=your.discord.token.here
```

4. Generate invite link with permissions:
   - Send Messages
   - Read Message History
   - Add Reactions

5. Invite bot to server and start chatting!

### Twitter Integration

1. Navigate to Twitter MCP server:
```bash
cd twitter-mcp-server
npm install
```

2. Configure `.env`:
```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email@example.com
```

3. Run MCP server:
```bash
npm run start:enhanced
```

## 📊 Analytics Setup (Optional)

### ClickHouse Analytics

1. Get ClickHouse Cloud account
2. Add credentials to `.env`:
```env
CLICKHOUSE_HOST=https://your-cluster.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
```

3. Create tables:
```bash
cd analytics
# Run setup scripts
```

4. View dashboard:
```bash
./dashboard.sh
```

## 🧪 Test the Agent

### Test Message Processing

Send these messages to test NUBI's personality:

1. **Simple greeting**: "gm"
   - Expected: Short, friendly response

2. **Technical question**: "What's better, Solana or Ethereum?"
   - Expected: Technical insight with personality

3. **Market question**: "What do you think about memecoins?"
   - Expected: Market wisdom with historical perspective

### Test Commands (Telegram)

```
/start - Initialize bot
/help - Get help
/raid status - Check raid status (if enabled)
/leaderboard - View rankings
```

## 🛠️ Common Configurations

### Adjust Personality

Edit `/anubis/src/nubi-character.ts`:

```typescript
// Make responses longer
system: "respond with detailed explanations"

// Change personality traits
bio: ["Your custom bio here"]

// Add knowledge
knowledge: ["Custom knowledge entries"]
```

### Enable/Disable Features

In `.env`:

```env
# Disable analytics
CLICKHOUSE_HOST=

# Disable raids
TELEGRAM_RAIDS_ENABLED=false

# Use different AI model
OPENAI_MODEL=gpt-4-turbo
```

### Change Response Style

Modify system prompt in `nubi-character.ts`:

```typescript
system: `you're NUBI, [your custom personality description]

key points:
- [your custom behavior rules]
- [your interaction style]
`
```

## 📁 Project Structure

```
dex-analytics/
├── anubis/              # Main agent
│   ├── src/            # Source code
│   ├── package.json    # Dependencies
│   └── .env           # Your config
├── analytics/          # ClickHouse tools
├── twitter-mcp-server/ # Twitter integration
└── docs/              # Documentation
```

## 🔍 Monitoring

### Check Logs

```bash
# See all logs
npm run dev

# Filter by service
npm run dev | grep "service-name"

# Save logs to file
npm run start > agent.log 2>&1
```

### Health Check

```bash
# Check if agent is running
ps aux | grep node

# Check memory usage
top -p $(pgrep -f "node.*anubis")
```

## 🚨 Troubleshooting

### Agent Won't Start
- Check Node version: `node --version` (needs 18+)
- Verify `.env` file exists
- Check API keys are valid

### No Responses
- Verify OpenAI API key is active
- Check rate limits
- Review error logs

### Platform Issues
- Telegram: Verify bot token with BotFather
- Discord: Check bot permissions
- Twitter: Validate credentials

## 🎯 Next Steps

1. **Customize Character**: Edit `nubi-character.ts`
2. **Add Services**: Create new services in `/services`
3. **Enable Analytics**: Set up ClickHouse
4. **Deploy**: Use Docker or PM2 for production

## 📚 Resources

- [Full Documentation](./COMPREHENSIVE_DOCUMENTATION.md)
- [Service Architecture](./SERVICE_ARCHITECTURE.md)
- [Telegram Raids Guide](./TELEGRAM_RAIDS_GUIDE.md)
- [GitHub Repository](https://github.com/Dexploarer/dex-analytics)

---

*Need help? Check the comprehensive documentation or open an issue on GitHub.*
