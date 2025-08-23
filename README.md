# 🔮 Anubis Agent God Mode

🔮 **The Symbiosis of Anubis** - Advanced ElizaOS agent with dynamic personality evolution and Telegram raid coordination.

NUBI is an advanced ElizaOS-based AI agent built for Anubis.Chat - a community-driven AI platform that embodies the ancient jackal spirit with modern market wisdom.

## Features

- 🧠 **Dynamic Personality Evolution** - AI personality that adapts and evolves based on interactions
- ⚡ **Enhanced Realtime System** - Unified ElizaOS Socket.IO + Supabase Realtime integration
- 🚀 **Telegram Raid Coordination** - Advanced raid management with leaderboards and scoring
- 🔗 **Cross-Platform Identity Linking** - Unified user identities across Discord, Telegram, Twitter
- 🎯 **Contextual Response Generation** - Database-driven context awareness and semantic memory
- 📊 **Community Management** - Real-time analytics and user engagement tracking
- 🛡️ **Anti-Detection Systems** - Human-like response variation patterns
- 🌐 **Multi-Transport Communication** - Discord, Telegram, Twitter, HTTP support

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or PGLite for development)
- API keys for desired platforms (OpenAI, Discord, Telegram, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anubis-chat/nubi
cd nubi
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### Run with ElizaOS

This project uses the ElizaOS CLI and core plugins directly (see `package.json`):

```bash
# Dev mode with hot reload
npm run dev

# Start in production mode
npm run start:production
```

## Architecture

### ElizaOS Core Concepts

- **Agents (Characters)**: Defined in `src/character/nubi-character.ts` using ElizaOS `Character`. Native `plugins` array references official plugins (SQL, Bootstrap, Knowledge, MCP, OpenAI, Telegram, Twitter, Discord) without custom wrappers.
- **Plugins**: Primary capabilities are packaged as an ElizaOS-compliant plugin `src/plugins/nubi-plugin.ts`. Additional optional plugins include `clickhouse-analytics`, `twitter-monitor`, and `sessions-plugin` (exported in `src/plugins/index.ts`).
- **Projects**: The `Project` is defined in `src/index.ts`, registering `nubiCharacter` and loading `nubiPlugin` and `clickhouseAnalyticsPlugin` per ElizaOS conventions.

### Core Services

- **Enhanced Realtime Service** - Unified Socket.IO + Supabase Realtime
- **Database Memory Service** - Semantic memory and vector search
- **Personality Evolution Service** - Dynamic trait adaptation
- **Telegram Raids Services** - Coordination, database, and orchestration
- **Cross-Platform Identity Service** - Identity linking

### ElizaOS Integration

- Native plugin arrays for `actions`, `providers`, `evaluators`, `services`, and `routes`
- Character-driven personality and style
- Uses official ElizaOS plugins where available to avoid redundant integrations

## Configuration

### Environment Variables

Key configuration options:

```bash
# Core API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Platforms
TELEGRAM_BOT_TOKEN=your_telegram_token
DISCORD_API_TOKEN=your_discord_token
TWITTER_API_KEY=your_twitter_key

# Database
DATABASE_URL=your_postgresql_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# NUBI Features
RAIDS_ENABLED=true
AUTO_RAIDS=false
RAID_INTERVAL_HOURS=6

# ClickHouse (optional)
CLICKHOUSE_HOST=
CLICKHOUSE_USER=
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=elizaos_analytics
```

### YAML Configuration

Advanced configuration in `configs/nubi-config.yaml`:

```yaml
personality:
  evolution_rate: 0.1
  traits:
    confidence: 0.8
    creativity: 0.7
    analytical: 0.9
community:
  engagement_threshold: 5
  leaderboard_size: 100
  point_multipliers:
    raids: 2.0
    discussions: 1.5
```

## Testing

```bash
# Unit and integration tests (vitest configured)
npm test

# Type checking
npm run type-check
```

## Deployment

### Production Setup

```bash
NODE_ENV=production
DATABASE_URL=your_production_db
npm run build
npm run start:production
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
RUN npm run build
CMD ["npm","run","start:production"]
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the coding standards and run tests
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Development Guidelines

- Follow ElizaOS agent/project/plugin patterns
- Prefer official ElizaOS plugins over custom wrappers
- Maintain type safety with TypeScript
- Write comprehensive tests
- Use semantic commit messages
- Update documentation for new features

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Anubis.Chat team using ElizaOS framework.