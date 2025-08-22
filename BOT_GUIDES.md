# Bot Integration Guides

This document consolidates all bot setup and integration guides.

## Telegram Bot Integration

# NUBI Telegram Bot Guide

## Bot Information
- **Username:** @anubis_cult_bot  
- **Token:** 8399141783:AAFKWLZuW3T62Q5u4LMf_dOoqbCjUSbOqlU
- **Status:** Active ✅

## For Regular Users

### Getting Started
1. **Start a conversation:** Send `/start` to @anubis_cult_bot
2. **Natural chat:** Just talk to NUBI naturally - no commands needed
3. **In groups:** Mention the bot to get a response

### Available Commands
- `/start` - Begin your journey with NUBI
- `/help` - Get guidance on bot features
- `/about` - Learn about NUBI and SYMLabs team
- `/team` - Meet the developers and moderators
- `/community` - Get X community link
- `/hashtags` - Official hashtags for social media
- `/links` - All official links and social accounts
- `/mystats` - View your personal statistics
- `/achievements` - Display your achievements
- `/raid` - Join active community raid (when enabled)
- `/leaderboard` - View top community members

### How to Chat
- **Direct messages:** Bot responds to everything
- **In groups:** Mention @anubis_cult_bot to get response
- Natural conversation - no special format needed
- Ask about Web3, DeFi, Solana, or general topics

## For Moderators

### Your Role
As a Telegram moderator (@IrieRubz, @stoicmido), you help maintain community standards and assist users.

### Moderation Capabilities
While you don't have special bot commands, you have:
- Authority to guide community discussions
- Direct line to admins for escalation
- Recognition in bot's knowledge base
- Ability to help users with bot features

### Best Practices
- Help new users understand bot commands
- Report technical issues to admins
- Maintain positive community atmosphere
- Guide users to appropriate resources

## For Administrators

### Admin Team
- **@dexploarerdev** (dEXploarer) - Co-Founder
- **@SYMBiEX** (SYMBiEX) - Co-Founder
- **@IrieRubz** - High-ranking member & Moderator
- **@stoicmido** - Moderator

### Admin-Only Commands
These commands are **only visible and usable by group administrators**:

#### User Management
- `/ban @username` - Ban user from raids
- `/unban @username` - Unban user
- `/whitelist @username` - Add to whitelist
- `/blacklist @username` - Add to blacklist

#### Raid Management
- `/setraid [parameters]` - Configure raid settings
- `/stats` - View detailed raid statistics
- `/clear` - Clear raid queue
- `/lock` - Lock chat during raid
- `/unlock` - Unlock chat after raid

#### Administrative
- `/announce [message]` - Make official announcement
- `/config` - View bot configuration
- `/purge [number]` - Remove spam messages

### Command Visibility
- **Regular users in groups:** See 12 basic commands
- **Group administrators:** See all 24 commands (12 basic + 12 admin)
- **Private chats:** See 10 relevant commands

## Setup for New Groups

### Adding Bot to Your Group
1. Add @anubis_cult_bot to your group
2. Make bot an administrator (required for features)
3. Grant these permissions:
   - Delete messages
   - Pin messages  
   - Restrict members
   - Manage messages

### Required Permissions
- **Read messages** - To respond to mentions
- **Send messages** - To reply
- **Delete messages** - For moderation
- **Restrict users** - For raid management
- **Pin messages** - For announcements

## Raid System (When Enabled)

### For Users
- `/raid` - Join active raid
- `/mystats` - Check your points
- `/leaderboard` - View rankings

### For Admins
- `/setraid` - Configure raid parameters
- `/lock` - Lock chat during raid
- `/unlock` - Release chat lock
- `/stats` - View raid analytics

### How Raids Work
1. Admin initiates raid with target
2. Users engage with target content
3. Bot tracks participation
4. Points awarded based on speed and engagement
5. Leaderboard updates in real-time

## Troubleshooting

### Bot Not Responding
- Ensure bot is added to group
- Check bot has admin permissions
- Verify you're mentioning @anubis_cult_bot
- Confirm bot isn't muted in group

### Commands Not Showing
- Regular users won't see admin commands (intentional)
- Restart Telegram app to refresh command list
- Check your admin status in group

### Admin Commands Not Working
- Verify you're a group administrator
- Ensure bot has required permissions
- Commands only work in groups, not private chats

## Technical Information

### API Configuration
- Bot uses Telegram Bot API command scopes
- Different command sets for different user types
- Programmatic setup via `bun run setup:telegram`

### Current Configuration
```
Default Commands: 12
Private Chat Commands: 10  
Group Member Commands: 12
Administrator Commands: 24
```

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=8399141783:AAFKWLZuW3T62Q5u4LMf_dOoqbCjUSbOqlU
TELEGRAM_ADMIN_IDS=@dexploarerdev,@SYMBiEX,@IrieRubz,@stoicmido
```

## Contact & Support

### Get Help
- **Technical issues:** Contact @dexploarerdev or @SYMBiEX
- **Bot questions:** Ask in the group or DM the bot
- **Community:** Join https://x.com/i/communities/1955910343378505822

### Official Links
- **X/Twitter:** @UnderworldAgent
- **Platform:** @AnubisChat
- **Hashtags:** #AnubisChat #Anubis #anubisai #OpenSource

---

**Developed by SYMLabs**  
dEXploarer & SYMBiEX - Co-Founders

---

## Discord Bot Integration

# NUBI Discord Bot Guide

## Bot Information
- **Application ID:** 1407352492383277197
- **Username:** NUBI
- **Status:** Active ✅

## For Regular Users

### Getting Started
1. **In servers:** Mention @NUBI to start a conversation
2. **Direct messages:** Send any message to the bot
3. **Natural conversation:** No commands needed - just chat naturally

### How to Chat
- **Mention the bot:** @NUBI followed by your message
- **Direct messages:** Bot responds to all DMs automatically
- **Natural language:** Ask about Web3, DeFi, Solana, or general topics
- **Personality:** Witty, engaging, knowledgeable about crypto and technology

### Features
- ✅ Natural language conversation
- ✅ Context-aware responses
- ✅ Web3 and DeFi knowledge
- ✅ Personality persistence
- ✅ Multi-turn conversations

## For Server Administrators

### Adding NUBI to Your Server

#### Option 1: OAuth2 Link
Use the following link with your Application ID:
```
https://discord.com/api/oauth2/authorize?client_id=1407352492383277197&permissions=274877958144&scope=bot
```

#### Option 2: Manual Addition
1. Go to Discord Developer Portal
2. Use Application ID: 1407352492383277197
3. Generate invite link with required permissions
4. Add to your server

### Required Permissions
- **Send Messages** - Core functionality
- **Read Message History** - Context understanding
- **Embed Links** - Rich responses
- **Attach Files** - Media sharing (when applicable)
- **View Channels** - Access to channels
- **Read Messages/View Channels** - Monitor mentions

### Recommended Permissions
```
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Read Message History
- Add Reactions
- Use External Emojis
- View Channels
```

### Bot Configuration
The bot responds to:
- Direct mentions (@NUBI)
- Direct messages
- No slash commands required
- No prefix needed

## For Moderators

### Your Role
Discord moderators help maintain community standards and assist users with bot interactions.

### Key Responsibilities
- Guide new users on how to interact with NUBI
- Report technical issues to administrators
- Help maintain positive community atmosphere
- Ensure bot usage follows server rules

### Bot Behavior
- Responds only when mentioned or in DMs
- Maintains conversation context
- Follows server rules and guidelines
- No moderation commands (uses Discord's built-in moderation)

## Technical Information

### Integration Details
- **Framework:** ElizaOS with Discord plugin
- **Language Model:** OpenAI GPT
- **Response Time:** Typically 1-3 seconds
- **Context Window:** Maintains conversation history

### Environment Configuration
```bash
DISCORD_APPLICATION_ID=1407352492383277197
DISCORD_API_TOKEN=your_bot_token_here
```

### Current Features
- ✅ Natural language processing
- ✅ Mention-based activation
- ✅ DM support
- ✅ Multi-server support
- ✅ Conversation memory
- ✅ Personality system

### Planned Features
- 🔧 Voice channel support
- 🔧 Slash commands
- 🔧 Server-specific configurations
- 🔧 Integration with raid system

## Troubleshooting

### Bot Not Responding
1. **Check permissions:** Ensure bot has Send Messages permission
2. **Verify mention:** Use @NUBI (exact username)
3. **Server outages:** Bot may be restarting
4. **Rate limits:** Wait a few seconds between messages

### Common Issues
- **No response to messages:** Make sure to mention the bot with @
- **Can't see bot online:** Check bot status in member list
- **DMs not working:** Ensure your DMs are open for server members
- **Delayed responses:** High load may cause slight delays

### Getting Help
- **Technical issues:** Contact @dexploarerdev on Telegram
- **General questions:** Ask in the X community
- **Server-specific:** Contact your server administrators

## Community & Support

### Official Links
- **X Platform:** [@AnubisChat](https://x.com/AnubisChat)
- **X Bot Account:** [@UnderworldAgent](https://x.com/UnderworldAgent)
- **X Community:** https://x.com/i/communities/1955910343378505822
- **Hashtags:** #AnubisChat #Anubis #anubisai #OpenSource

### Team Contacts
- **dEXploarer** (Co-Founder)
  - Discord: skirrskirrr
  - X: [@dEXploarer](https://x.com/dEXploarer)
  - Telegram: @dexploarerdev

- **SYMBiEX** (Co-Founder)
  - Discord: cidsociety
  - X: [@SYMBiEX](https://x.com/SYMBiEX)
  - Telegram: @SYMBiEX

## Best Practices

### For Users
- Be patient - complex questions may take a moment
- Provide context for better responses
- Use mentions in busy channels
- Keep conversations respectful

### For Server Owners
- Create a dedicated bot channel for testing
- Set appropriate channel permissions
- Inform users about bot capabilities
- Monitor bot usage for server health

### For Optimal Performance
- Avoid spam mentioning
- Allow bot to complete responses
- Use clear, specific questions
- Respect rate limits

---

**Developed by SYMLabs**  
dEXploarer & SYMBiEX - Co-Founders