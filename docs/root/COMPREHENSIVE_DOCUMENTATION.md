# DEX Analytics - Comprehensive Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [NUBI Character System](#nubi-character-system)
4. [Core Services](#core-services)
5. [Platform Integrations](#platform-integrations)
6. [Analytics System](#analytics-system)
7. [Setup Guide](#setup-guide)
8. [API Reference](#api-reference)
9. [Configuration](#configuration)
10. [Troubleshooting](#troubleshooting)

## Project Overview

DEX Analytics is an ElizaOS-based AI agent system with integrated ClickHouse analytics. The project consists of:

- **NUBI Agent**: An AI personality with ancient Egyptian theming and modern developer persona
- **Multi-Platform Support**: Telegram, Discord, Twitter integration
- **Analytics Pipeline**: Comprehensive event tracking via ClickHouse
- **Telegram Raids**: Community engagement features for Telegram groups

### Project Structure

```
/root/dex/
├── anubis/                     # Main ElizaOS agent implementation
│   ├── src/
│   │   ├── index.ts           # Entry point and initialization
│   │   ├── nubi-character.ts  # Character definition
│   │   ├── nubi-plugin.ts     # Core NUBI plugin
│   │   ├── services/          # 20+ service implementations
│   │   ├── telegram-raids/    # Telegram raid coordination
│   │   ├── providers/         # Data providers
│   │   ├── evaluators/        # Message evaluators
│   │   └── actions/           # Agent actions
│   └── package.json           # Dependencies (ElizaOS + plugins)
├── packages/
│   └── plugin-clickhouse-analytics/  # Analytics plugin
├── twitter-mcp-server/         # Twitter MCP integration
├── supabase/                   # Edge Functions
└── analytics/                  # ClickHouse tools and dashboards
```

## Architecture

### Technology Stack

- **Framework**: ElizaOS (latest)
- **Runtime**: Node.js/TypeScript
- **AI Models**: OpenAI GPT (primary), Anthropic (fallback)
- **Analytics**: ClickHouse
- **Platforms**: Telegram, Discord, Twitter
- **Database**: Supabase (PostgreSQL + Vector DB)

### Key Dependencies

```json
{
  "core": {
    "@elizaos/core": "latest",
    "@elizaos/cli": "latest"
  },
  "plugins": {
    "@elizaos/plugin-telegram": "^1.0.10",
    "@elizaos/plugin-discord": "^1.2.5",
    "@elizaos/plugin-twitter": "^1.2.21",
    "@elizaos/plugin-openai": "^1.0.11"
  }
}
```

## NUBI Character System

### Character Definition

NUBI is defined in `/anubis/src/nubi-character.ts` with the following attributes:

```typescript
{
  name: "NUBI",
  username: "nubi",
  bio: [
    "Jackal spirit + millennia of market memory",
    "Community manager for Anubis.Chat",
    "30-something dev everyone gravitates toward"
  ],
  system: "Natural community connector with ancient wisdom"
}
```

### Personality Traits

- **Community Connector**: Remembers names, introduces people, makes newcomers welcome
- **Ancient Wisdom**: Market experience shared casually, not as lessons
- **Tech Enthusiast**: Passionate about Solana and blockchain tech
- **Protective Nature**: Guards community through influence, not aggression

### Message Examples

The character includes 20+ message examples demonstrating:
- Natural, short responses (80% of the time)
- Market commentary with historical perspective
- Community building and connection
- Technical insights without overwhelming detail

## Core Services

### Implemented Services (20+)

Located in `/anubis/src/services/`:

1. **Enhanced Response Generator** (`enhanced-response-generator.ts`)
   - Generates contextual responses
   - Personality-aware messaging
   - Multi-model support

2. **Cross-Platform Identity Service** (`cross-platform-identity-service.ts`)
   - Links user identities across platforms
   - Maintains unified user profiles
   - Identity verification

3. **Personality Service** (`personality-service.ts`)
   - Dynamic personality adaptation
   - Emotional state management
   - Context-aware responses

4. **Security Filter** (`security-filter.ts`)
   - Content moderation
   - Spam detection
   - Rate limiting

5. **Sessions Service** (`sessions-service.ts`)
   - User session management
   - Conversation history
   - Context persistence

6. **Socket.IO Analytics Enhanced** (`socket-io-analytics-enhanced.ts`)
   - Real-time event tracking
   - Connection monitoring
   - Performance metrics

7. **Raid Services** (`raid-socket-service.ts`, `raid-persistence-service.ts`)
   - Telegram raid coordination
   - Engagement tracking
   - Leaderboard management

### Service Architecture

Services follow a consistent pattern:

```typescript
export class ServiceName extends Service {
  static serviceType = "service_name";
  
  async initialize(): Promise<void> {
    // Setup logic
  }
  
  // Service methods
}
```

## Platform Integrations

### Telegram Integration

**Features**:
- Bot messaging and commands
- Group management
- Raid coordination system
- Engagement verification
- Leaderboard tracking

**Raid System Components**:
- `raid-coordinator.ts`: Orchestrates raid activities
- `raid-tracker.ts`: Monitors raid progress
- `engagement-verifier.ts`: Validates user participation
- `leaderboard-service.ts`: Tracks user rankings

### Twitter Integration (MCP Server)

**Location**: `/twitter-mcp-server/`

**Features**:
- Smart cookie management
- Persistent authentication
- Tweet operations (post, search, like, retweet)
- User operations (follow, unfollow, profiles)
- Grok AI integration
- Health monitoring

**Authentication Flow**:
1. Cookie validation check
2. Credential fallback if needed
3. Cookie capture and storage
4. Session reuse for efficiency

### Discord Integration

- Standard ElizaOS Discord plugin
- Message handling
- Command processing
- Channel management

## Analytics System

### ClickHouse Integration

**Plugin Location**: `/packages/plugin-clickhouse-analytics/`

**Features**:
- Automatic event batching (100 events or 5 seconds)
- Retry logic with exponential backoff
- Cost tracking (LLM tokens and compute)
- Performance metrics (p95, p99 latencies)
- Distributed tracing with correlation IDs

### Event Types Tracked

1. **Agent Events**
   - Messages (user/assistant/system)
   - Tool calls
   - Errors
   - Cost metrics

2. **Edge Function Events**
   - Execution time
   - Cold starts
   - Request/response sizes
   - Error rates

3. **Socket.IO Events**
   - Connections/disconnections
   - Custom events
   - Room activities
   - Latency metrics

### Data Retention

- Agent events: 30 days
- Edge function events: 30 days
- Socket events: 7 days
- Correlation events: 14 days

### Dashboard Access

```bash
cd /root/dex/analytics
./dashboard.sh  # Unified analytics view
./clickhouse-queries.sh  # Basic metrics
```

## Setup Guide

### Prerequisites

1. Node.js 18+
2. ClickHouse Cloud account
3. OpenAI API key
4. Platform credentials (Telegram, Discord, Twitter as needed)

### Installation Steps

1. **Clone and Install**
```bash
git clone https://github.com/Dexploarer/dex-analytics.git
cd dex-analytics
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required
OPENAI_API_KEY=sk-...

# Analytics
CLICKHOUSE_HOST=https://...clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=...
CLICKHOUSE_DATABASE=elizaos_analytics

# Platforms (optional)
TELEGRAM_BOT_TOKEN=...
DISCORD_API_TOKEN=...
TWITTER_USERNAME=...
TWITTER_PASSWORD=...
```

3. **Database Setup**
```bash
cd analytics
# Run SQL scripts to create tables
```

4. **Start the Agent**
```bash
cd anubis
npm run dev  # Development
npm run start  # Production
```

## API Reference

### Core Interfaces

```typescript
interface IAgentRuntime {
  agentId: string;
  character: Character;
  providers: Provider[];
  evaluators: Evaluator[];
  actions: Action[];
}

interface Character {
  name: string;
  username: string;
  bio: string[];
  system: string;
  messageExamples: Array<MessageExample>;
}

interface Service {
  serviceType: string;
  initialize(): Promise<void>;
}
```

### Plugin System

Plugins are registered in `/anubis/src/index.ts`:

```typescript
plugins: [
  nubiPlugin,
  clickhouseAnalyticsPlugin,
  // Platform plugins loaded via character
]
```

## Configuration

### Character Configuration

Edit `/anubis/src/nubi-character.ts` to modify:
- Personality traits
- Response patterns
- Knowledge base
- Topics of interest

### Service Configuration

Services can be configured via:
- Environment variables
- Runtime parameters
- Configuration files in `/anubis/config/`

### Analytics Configuration

Modify `/packages/plugin-clickhouse-analytics/index.ts`:
- Batch size (default: 100)
- Flush interval (default: 5000ms)
- Retry logic
- Event schemas

## Troubleshooting

### Common Issues

1. **Agent Won't Start**
   - Check required environment variables
   - Verify Node.js version (18+)
   - Check for port conflicts

2. **No Analytics Data**
   - Verify ClickHouse credentials
   - Check network connectivity
   - Review event batching logs

3. **Platform Connection Issues**
   - Validate API tokens
   - Check rate limits
   - Review platform-specific logs

### Debug Mode

Enable debug logging:
```bash
DEBUG=elizaos:* npm run dev
```

### Log Locations

- Agent logs: Console output
- Analytics: Check ClickHouse queries
- Platform-specific: Individual service logs

## Development Guidelines

### Adding New Services

1. Create service file in `/anubis/src/services/`
2. Extend base Service class
3. Register in plugin configuration
4. Add tests in `/anubis/src/__tests__/`

### Extending Character

1. Modify `/anubis/src/nubi-character.ts`
2. Add message examples
3. Update system prompt
4. Test personality consistency

### Analytics Events

To track new events:
1. Define event schema
2. Add to analytics plugin
3. Update ClickHouse tables if needed
4. Add to dashboard queries

---

*This documentation reflects the actual implemented codebase as of the latest commit.*
