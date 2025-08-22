# NUBI Agent Architecture - Clean & Integrated

## Overview
This document describes the production-ready, debt-free architecture of the NUBI Agent system.

## Architecture Principles

1. **Single Responsibility** - Each service has one clear purpose
2. **Dependency Injection** - All services registered and managed centrally
3. **No Duplicates** - Single source of truth for each functionality
4. **Proper Lifecycle** - Initialize → Start → Stop with health checks
5. **Event-Driven** - Services communicate via events
6. **Database-Backed** - All data persisted properly

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                      │
│                     (src/app.ts)                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                 Service Registry                         │
│            (src/core/service-registry.ts)               │
└────────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼──────────┐ ┌──────▼──────────┐ ┌──────▼──────────┐
│  Telegram    │ │   Engagement    │ │      MCP        │
│   Raids      │ │   Analytics     │ │    Twitter      │
│  Service     │ │    Service      │ │    Service      │
└──────────────┘ └─────────────────┘ └─────────────────┘
    │                    │                    │
┌───▼──────────────────────────────────────────────────┐
│              Database Layer (PostgreSQL)              │
└───────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────┐
│           Time-Series Layer (ClickHouse)              │
└───────────────────────────────────────────────────────┘
```

## Core Services

### 1. Service Registry (`src/core/service-registry.ts`)
- **Purpose**: Central management of all services
- **Features**:
  - Service registration with dependencies
  - Lifecycle management (init, start, stop)
  - Health monitoring
  - Event emission
  - Topological sorting for dependencies

### 2. Telegram Raids Service (`src/services/telegram/raids.service.ts`)
- **Purpose**: Manage Twitter raids via Telegram
- **Features**:
  - Command handling (/raid, /active, /stats, /leaderboard)
  - URL detection and auto-raids
  - Interactive buttons
  - Points system
  - Database persistence
  - MCP integration
- **No Duplicates**: Consolidated from multiple scattered implementations

### 3. Engagement Analytics Service (`src/services/engagement-analytics-service.ts`)
- **Purpose**: Track ALL Twitter engagement
- **Features**:
  - Monitors all tweets (not just raids)
  - @NUBI mention detection
  - Session tracking
  - Real-time metrics
  - Database storage (PostgreSQL + ClickHouse)
  - Auto-response system
- **Integration**: Hooks into runtime.processAction

### 4. Application Manager (`src/app.ts`)
- **Purpose**: Wire everything together
- **Features**:
  - Service initialization
  - Dependency management
  - Health monitoring
  - Graceful shutdown

## Database Schema

### PostgreSQL Tables
```sql
-- Engagement metrics
engagement_metrics (
    id, tweet_id, timestamp, type, author, content,
    likes, retweets, replies, engagement_rate,
    session_id, raid_id, source
)

-- Mention alerts
mention_alerts (
    id, tweet_id, author, content, timestamp,
    urgency, sentiment, responded, response_id
)

-- Session engagement
session_engagement (
    session_id, user_id, platform, start_time,
    tweets_count, likes_count, total_engagement
)

-- Telegram raids
telegram_raids (
    id, tweet_id, tweet_url, participants,
    engagement_rate, virality, reach, active
)
```

### ClickHouse Tables
```sql
-- Time-series data
engagement_timeseries (
    timestamp, tweet_id, likes, retweets,
    views, engagement_rate, source, raid_id
)

-- Mention stream
mention_stream (
    timestamp, tweet_id, author, content,
    sentiment, urgency, responded
)
```

## API Endpoints

### Health & Status
- `GET /health` - System health check
- `GET /api/v1/agent/status` - Agent status

### Engagement Analytics
- `GET /api/v1/engagement/dashboard` - Analytics dashboard
- `GET /api/v1/engagement/mentions` - @NUBI mentions
- `GET /api/v1/engagement/sessions/:id` - Session data
- `GET /api/v1/engagement/raids/:id` - Raid analytics
- `POST /api/v1/engagement/respond` - Respond to mention

## Integration Points

### 1. ElizaOS Runtime
```typescript
// Hook into runtime for all Twitter actions
runtime.processAction = async (action, data, state) => {
    // Track all Twitter interactions
    // Auto-start raids on agent tweets
    // Update session engagement
}
```

### 2. MCP Twitter Server
- Uses cookie-based authentication
- No API keys required
- Tools: post_tweet, like_tweet, retweet, get_tweet_info

### 3. Session Management
- Links all actions to sessions
- Tracks user journey across platforms
- Calculates engagement metrics per session

## Environment Configuration

```bash
# Required
TELEGRAM_BOT_TOKEN=xxx
TWITTER_USERNAME=xxx
TWITTER_EMAIL=xxx
TWITTER_PASSWORD=xxx

# Database
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=eliza
PG_USER=postgres
PG_PASSWORD=xxx

# Analytics
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=xxx

# Optional
TELEGRAM_ALLOWED_CHATS=chatid1,chatid2
```

## Removed Technical Debt

### Eliminated Duplicates
- ❌ `telegram-raids-integration.ts` and `-fixed.ts` → ✅ Single service
- ❌ `socket-io-events-service.ts` and `-fixed.ts` → ✅ Consolidated
- ❌ Multiple raid implementations → ✅ One source of truth
- ❌ Scattered functionality → ✅ Organized by domain

### Fixed Architecture Issues
- ❌ No central service management → ✅ Service Registry
- ❌ Missing dependency injection → ✅ Proper DI
- ❌ No error boundaries → ✅ Try-catch + graceful degradation
- ❌ Incomplete database integration → ✅ Full persistence

### Improved Code Quality
- ❌ Circular dependencies → ✅ Clean dependency graph
- ❌ Memory leaks → ✅ Proper cleanup
- ❌ Hardcoded values → ✅ Environment configuration
- ❌ Missing types → ✅ Full TypeScript

## Testing Strategy

### Unit Tests
- Service initialization
- Command handlers
- Database operations
- Metric calculations

### Integration Tests
- End-to-end raid flow
- MCP integration
- Database persistence
- Session tracking

### Load Tests
- Concurrent raids
- High-volume mentions
- Database performance

## Deployment

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
```

### Kubernetes
- ConfigMaps for environment
- Secrets for credentials
- Horizontal Pod Autoscaling
- Health/Liveness probes

## Monitoring

### Metrics
- Service health status
- API response times
- Database query performance
- Engagement rates
- Raid participation

### Alerts
- Service failures
- High-urgency mentions
- Database connection issues
- Rate limit warnings

## Summary

This architecture provides:
- ✅ **No duplicates** - Single source of truth
- ✅ **No technical debt** - Clean, maintainable code
- ✅ **Full integration** - All services work together
- ✅ **Proper persistence** - Database-backed
- ✅ **Scalable** - Can handle growth
- ✅ **Monitored** - Full observability
- ✅ **Tested** - Comprehensive test coverage
- ✅ **Production-ready** - Deploy with confidence

The system is now clean, integrated, and ready for production use.
