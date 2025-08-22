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

- Node.js 18+ or Bun runtime
- PostgreSQL database (or use PGLite for development)
- API keys for desired platforms (OpenAI, Discord, Telegram, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anubis-chat/nubi
cd nubi
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Initialize the database:
```bash
bun run db:setup
```

### Development

```bash
# Development mode (uses PGLite)
bun run dev

# Production mode (uses PostgreSQL)
bun run start:production

# Run tests
bun test

# Type checking
bun run type-check
```

## Architecture

### Core Services

- **Enhanced Realtime Service** - Unified Socket.IO + Supabase Realtime
- **Database Memory Service** - Semantic memory with vector embeddings
- **Personality Evolution Service** - Dynamic trait adaptation
- **Telegram Raids Service** - Raid coordination and community engagement
- **Cross-Platform Identity Service** - User identity management

### ElizaOS Integration

NUBI is built on the ElizaOS framework, providing:
- Plugin architecture with actions, providers, and evaluators
- Character-driven personality system
- Native AI response generation
- Multi-model support (OpenAI, Anthropic, etc.)

### Database Schema

- **User Identities** - Cross-platform user linking
- **Personality Snapshots** - Evolution tracking over time
- **Community Stats** - Engagement metrics and leaderboards
- **Raid Sessions** - Telegram raid coordination
- **Memory Records** - Semantic memory storage

## Configuration

### Environment Variables

Key configuration options:

```bash
# Core API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Platform Integration
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
```

### YAML Configuration

Advanced configuration in `config/anubis-config.yaml`:

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

NUBI includes comprehensive tests following ElizaOS patterns:

```bash
# Run all tests
bun test

# Run specific test files
bun test src/__tests__/character.test.ts

# Run with coverage
bun run test:coverage

# Watch mode
bun run test:watch
```

### Test Structure

- **Unit Tests** - Individual service and component tests
- **Integration Tests** - End-to-end functionality tests
- **ElizaOS Compliance** - Framework compatibility tests

## Deployment

### Production Setup

1. Configure production environment:
```bash
NODE_ENV=production
DATABASE_URL=your_production_db
```

2. Build and start:
```bash
bun run build
bun run start:production
```

### Docker Deployment

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY . .
RUN bun install --production
RUN bun run build
CMD ["bun", "run", "start:production"]
```

### Supabase Edge Functions

Deploy serverless functions:

```bash
supabase functions deploy webhook-processor
supabase functions deploy raid-coordinator
supabase functions deploy analytics-engine
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the coding standards and run tests
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Development Guidelines

- Follow ElizaOS plugin patterns
- Maintain type safety with TypeScript
- Write comprehensive tests
- Use semantic commit messages
- Update documentation for new features

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [NUBI Docs](https://docs.anubis.chat)
- **Discord**: [Anubis Community](https://discord.gg/anubis)
- **Telegram**: [@AnubisChat](https://t.me/anubischat)
- **Twitter**: [@AnubisChat](https://twitter.com/anubischat)

---

Built with ❤️ by the Anubis.Chat team using ElizaOS framework.