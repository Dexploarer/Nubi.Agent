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
   - Character definition in `src/nubi-character.ts`
   - Main plugin configuration in `src/nubi-plugin.ts`

2. **Database Layer**
   - Centralized `DatabaseConnectionManager` with connection pooling (max 20 connections)
   - Services use connection manager instead of individual database clients
   - Parallel query execution for performance optimization
   - Vector embeddings support with multiple dimensions

3. **Service Architecture**
   - **DatabaseMemoryService**: Enhanced context retrieval with semantic search
   - **EnhancedResponseGenerator**: Contextually aware response generation
   - **MessageBusService**: Multi-transport communication (Discord, Telegram, X/Twitter, HTTP)
   - **CrossPlatformIdentityService**: User identity linking across platforms
   - All services extend ElizaOS `Service` class

4. **Telegram Raid System**
   - Complete raid coordination system in `src/telegram-raids/`
   - Engagement verification, leaderboards, moderation
   - Rate limiting and anti-abuse measures
   - Integration with X/Twitter for social media raids

5. **Performance Optimizations**
   - Database queries executed in parallel using `Promise.all()`
   - Connection pooling with centralized database manager
   - Async operation optimization throughout services
   - Broadcast operations parallelized across transports

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

## Response Generation System

NUBI uses a sophisticated multi-layered response system documented in `NUBI_RESPONSE_ARCHITECTURE.md`:

- **Personality Evolution**: Dynamic trait adjustment (8 dimensions)
- **Emotional State Processing**: Context-aware emotional responses
- **Anti-Detection Mechanisms**: Human-like variation patterns
- **Context Providers**: Database-driven contextual awareness
- **Memory Systems**: Semantic, conversational, and personality memory

## Configuration Files

- `config/anubis-config.yaml`: Main agent configuration
- `config/anubis-raid-config.yaml`: Telegram raid settings
- `supabase/config.toml`: Supabase edge functions configuration
- Database migrations in `supabase/migrations/`

## Important Development Notes

### Database Operations
- Always use `DatabaseConnectionManager` for database operations
- Services should implement connection pooling patterns
- Use typed query results, not raw database responses

### Testing Considerations
- Database tests may fail without proper PostgreSQL connection
- Mock services appropriately in tests
- Use `bun test` framework, not Jest

### Performance Patterns
- Execute independent database queries in parallel
- Use centralized connection management
- Implement proper error handling with connection cleanup

### Code Style
- Use ElizaOS logger: `import { logger } from "@elizaos/core"`
- Follow TypeScript strict mode requirements
- Prefer async/await over callbacks
- Use proper interface definitions over `any` types

## Supabase Integration

- Edge functions in `supabase/functions/` for serverless operations
- Identity linking system with cross-platform user management
- Database migrations for schema management
- Analytics and webhook processing capabilities

## Environment Variables

Key environment variables (see `DATABASE.md` for complete reference):
- `POSTGRES_URL`: Production PostgreSQL connection
- `PGLITE_DATA_DIR`: Development database location (default: `./.eliza/.elizadb`)
- `NODE_ENV`: Environment mode
- Various API keys for Discord, Telegram, Twitter integrations