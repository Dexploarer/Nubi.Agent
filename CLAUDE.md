# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NUBI is an advanced ElizaOS-based AI agent built for Anubis.Chat - a community-driven AI platform. The agent embodies the personality of an ancient jackal spirit with modern market wisdom, serving as a community manager with deep crypto/Solana knowledge.

## Development Commands

### Essential Commands
```bash
# Development mode (PGLite database)
bun run dev

# Production mode (PostgreSQL)
bun run start:production

# Type checking
bun run type-check

# Code formatting
bun run format

# Run all tests
bun run test

# Run single test file
bun test src/__tests__/specific-test.test.ts

# Lint and format code
bun run lint

# Check everything (types, format, tests)
bun run check-all
```

### Database Configuration
- **Development**: Uses PGLite (embedded PostgreSQL in WebAssembly) at `./.eliza/.elizadb`
- **Production**: Uses full PostgreSQL via `POSTGRES_URL` environment variable
- **Database Poolers**: Supabase transaction pooler (port 6543) and session pooler (port 5432)
- Automatic adapter selection based on available environment variables

### Testing Framework
- Uses **Bun test** (not Jest) - this is critical for compatibility
- Test files: `*.test.ts` in `src/__tests__/`
- Cypress for E2E tests: `bun run cy:run`
- Coverage reports: `bun run test:coverage`

## Architecture Overview

### Core System Components

1. **ElizaOS Integration**
   - Built on ElizaOS framework with full plugin architecture
   - Uses ElizaOS logger (`import { logger } from "@elizaos/core"`) throughout codebase
   - Character definition in `src/character/nubi-character.ts`
   - Main plugin configuration in `src/plugins/nubi-plugin.ts`

2. **Modular Architecture** (`MODULAR_ARCHITECTURE.md`)
   - **Core** (`src/core/`): ElizaOS re-exports and base utilities
   - **Identity** (`src/identity/`): Cross-platform user identity management
   - **Messaging** (`src/messaging/`): Message bus and transport management
   - **Character** (`src/character/`): NUBI personality and configuration
   - **Services** (`src/services/`): Core service implementations
   - **Plugins** (`src/plugins/`): Plugin system and implementations
   - **Orchestration** (`src/orchestration/`): Strategic action orchestration
   - **App** (`src/app/`): Application lifecycle and coordination

3. **Database Layer with Pooler Management**
   - **DatabasePoolerManager**: Intelligent dual-pool architecture
   - **Transaction Pool** (port 6543): Fast CRUD operations, 20 max connections
   - **Session Pool** (port 5432): Complex queries with JOINs, 5 max connections
   - **Intelligent Routing**: Automatic query complexity detection and pool selection
   - **DatabaseMemoryService**: Enhanced context retrieval with semantic search
   - Connection pooling with centralized database manager
   - Parallel query execution for performance optimization

4. **UX Integration System (Real-time Communication)**
   - **Socket.IO Integration**: Bidirectional real-time communication
   - **Two-Layer Processing Pipeline**:
     - **Layer 1**: Security filtering, rate limiting, XSS prevention
     - **Layer 2**: Message classification, intelligent routing, prompt injection
   - **Message Classification**: 7 specialized prompt types (community-manager, raid-coordinator, crypto-analyst, meme-lord, support-agent, personality-core, emergency-handler)
   - **Security Features**: Content filtering, spam detection, user session management
   - **Analytics Pipeline**: Real-time analytics with ClickHouse integration

5. **Service Architecture**
   - **SocketIOServerService**: Real-time WebSocket server with session management
   - **MessageRouter**: Dynamic system prompt routing based on message analysis
   - **CrossPlatformIdentityService**: User identity linking across platforms
   - **CommunityManagementService**: Community engagement and moderation
   - All services extend ElizaOS `Service` class

6. **Telegram Raid System with ElizaOS Integration**
   - Complete raid coordination system in `src/telegram-raids/`
   - **OptimizedRaidDatabase**: Batch operations with database pooler integration
   - **ElizaOS Memory Integration**: Raid participant tracking and analytics via ElizaOS memory patterns
   - **XMCPX MCP Server**: Twitter/X integration with ElizaOS memory client (`/root/xmcpx-server/`)
   - **Raid Success Evaluator**: ElizaOS-native evaluator for tracking raid performance metrics
   - Engagement verification, leaderboards, moderation with semantic search capabilities
   - Rate limiting and anti-abuse measures
   - Integration with X/Twitter for social media raids through MCP protocol

### Key Architectural Patterns

1. **Clean Imports**: All major modules have index files for organized exports
   - `src/services/index.ts`
   - `src/providers/index.ts`
   - `src/evaluators/index.ts`
   - `src/telegram-raids/index.ts`

2. **Type Safety**: Eliminated `any` types, replaced with proper TypeScript interfaces
   - Database operations use typed results
   - Message interfaces for transport layer
   - Proper context interfaces for providers

3. **ElizaOS Compliance**
   - Uses ElizaOS logger exclusively
   - Follows ElizaOS service patterns
   - Compatible with ElizaOS plugin system

4. **UX Processing Pipeline**
   ```
   WebSocket/Socket.IO → Layer 1 Security → Layer 2 Classification → ElizaOS
   ```

## Response Generation System

NUBI uses a sophisticated multi-layered response system:

- **Personality Evolution**: Dynamic trait adjustment (10 dimensions in config)
- **Emotional State Processing**: Context-aware emotional responses  
- **Anti-Detection Mechanisms**: Human-like variation patterns (typo rate, contradiction rate, etc.)
- **Context Providers**: Database-driven contextual awareness
- **Memory Systems**: Semantic, conversational, and personality memory
- **Message Classification**: Intelligent routing based on content analysis

## Configuration Files

- `configs/nubi-config.yaml`: Main agent configuration with personality traits
- `configs/raid-config.yaml`: Telegram raid settings
- `supabase/config.toml`: Supabase edge functions configuration
- Database migrations in `supabase/migrations/`

## ElizaOS Framework Compliance

### Architecture Patterns
- **Plugin System**: All functionality extends ElizaOS via plugins with proper component structure
- **Service Lifecycle**: Services extend `Service` base class with proper `start()` and `stop()` methods
- **Evaluator Implementation**: Use ElizaOS `Evaluator` interface with `validate()` and `handler()` methods
- **Provider Integration**: Providers supply dynamic context data using ElizaOS patterns
- **Memory System**: Leverage ElizaOS built-in memory APIs with semantic search capabilities

### ElizaOS-Optimized Raid System
- **Raid Success Evaluator**: `src/evaluators/raid-success-evaluator.ts` - Tracks raid metrics using ElizaOS memory patterns
- **Enhanced Memory Service**: `src/services/database-memory-service.ts` - Extended with raid-specific methods (`storeRaidParticipant`, `getRaidContext`, `trackRaidProgress`)
- **Context Provider Enhancement**: `src/providers/enhanced-context-provider.ts` - Enriched with Twitter data and raid context
- **XMCPX Integration**: `/root/xmcpx-server/` - MCP server with ElizaOS memory client integration for Twitter raid coordination

## Important Development Notes

### Database Operations
- Always use `DatabasePoolerManager` for database operations when available
- **Transaction Pool**: Use for simple CRUD operations (INSERT, UPDATE, DELETE, simple SELECT)
- **Session Pool**: Use for complex queries with JOINs, analytics, vector operations
- Services should implement connection pooling patterns
- Use typed query results, not raw database responses

### ElizaOS Service Development
- **Extend Service Class**: All services must extend ElizaOS `Service` base class
- **Service Type**: Define `static serviceType` constant for service identification
- **Lifecycle Methods**: Implement `start()` and `stop()` methods for proper initialization/cleanup
- **Runtime Integration**: Access runtime via constructor injection: `constructor(runtime: IAgentRuntime)`
- **Service Registration**: Register services in plugin `services` array with dependency order

### Memory and Context Patterns
- **Semantic Search**: Use `runtime.useModel(ModelType.TEXT_EMBEDDING)` for embedding generation
- **Memory Storage**: Use `runtime.createMemory()` with proper ElizaOS Memory interface
- **Memory Retrieval**: Use `runtime.searchMemories()` with embedding-based search
- **Context Building**: Leverage `enhancedContextProvider` for rich context with raid data enrichment
- **State Management**: Use proper ElizaOS State and Memory types throughout

### UX Integration Development
- **WebSocket Services**: Use `SocketIOServerService` and `SocketIOClientService`
- **Message Processing**: Leverage `MessageRouter` for intelligent classification
- **Security**: All messages pass through 2-layer filtering before reaching ElizaOS
- **Session Management**: Automatic session cleanup and timeout handling
- **Analytics**: Real-time tracking with `SocketIOAnalyticsService`

### Testing Considerations
- Database tests may fail without proper PostgreSQL connection
- Mock services appropriately in tests using `MockRuntime` from `src/__tests__/test-utils.ts`
- Use `bun test` framework, not Jest
- Socket.IO tests require proper cleanup in afterEach hooks
- ElizaOS components require proper interface compliance testing

### Performance Patterns
- Execute independent database queries in parallel using `Promise.all()`
- Use centralized connection management with pooler routing
- Implement proper error handling with connection cleanup
- Leverage intelligent query routing for optimal performance
- Use ElizaOS built-in embedding and semantic search for efficient memory operations

### Code Style
- Use ElizaOS logger: `import { logger } from "@elizaos/core"`
- Follow TypeScript strict mode requirements
- Prefer async/await over callbacks
- Use proper interface definitions over `any` types
- Import ElizaOS types from `@elizaos/core`: `IAgentRuntime`, `Memory`, `State`, `ActionResult`

## Supabase Integration

- Edge functions in `supabase/functions/` for serverless operations
- Identity linking system with cross-platform user management
- Database migrations for schema management
- Analytics and webhook processing capabilities
- Dual pooler architecture for optimized query performance

## MCP Server Integration (XMCPX)

The NUBI system includes a comprehensive MCP (Model Context Protocol) server for Twitter/X integration:

### XMCPX Server (`/root/xmcpx-server/`)
- **Published Package**: `@promptordie/xmcpx@1.2.0` on npm
- **MCP Tools**: 9 comprehensive tools for Twitter raid coordination
- **ElizaOS Integration**: Built-in memory client for storing participant data and analytics
- **Database Integration**: PostgreSQL schema for raid management
- **Authentication**: Cookie-based Twitter auth with credential management

### Key XMCPX Tools
- `startRaid`: Initiate Twitter raids with multi-parameter objectives
- `monitorRaid`: Real-time raid progress monitoring
- `verifyParticipation`: Verify user actions (likes, retweets, replies, etc.)
- `endRaid`: Complete raids and generate analytics
- `getRaidStats`: Retrieve comprehensive raid statistics
- `getLeaderboard`: Get top performer rankings
- `parseTelegramRaidMessage`: Parse raid commands from Telegram

### MCP Character Configuration
- **NUBI MCP Config**: `src/character/nubi-mcp-config.ts`
- **Server Registration**: Both XMCPX and Supabase MCP servers
- **Environment Integration**: Automatic credential and database URL configuration

## Environment Variables

Key environment variables:
- `POSTGRES_URL`: Production PostgreSQL connection
- `SUPABASE_TRANSACTION_POOLER_URL`: Transaction pooler connection (port 6543)
- `SUPABASE_SESSION_POOLER_URL`: Session pooler connection (port 5432)  
- `PGLITE_DATA_DIR`: Development database location (default: `./.eliza/.elizadb`)
- `NODE_ENV`: Environment mode
- `OPENAI_API_KEY`: Required for AI responses
- `TELEGRAM_BOT_TOKEN`: For Telegram integration
- `DISCORD_API_TOKEN`: For Discord integration
- `TWITTER_USERNAME`: Twitter/X username for XMCPX authentication
- `TWITTER_PASSWORD`: Twitter/X password for XMCPX authentication  
- `TWITTER_EMAIL`: Twitter/X email for XMCPX authentication
- `CLICKHOUSE_HOST`: For analytics (optional)
- `SOCKET_PREPROCESSING_ENABLED`: Enable UX preprocessing pipeline
- `SOCKET_CONTENT_FILTERING`: Enable content filtering
- `SOCKET_RATE_LIMITING`: Enable rate limiting