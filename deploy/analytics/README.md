# ClickHouse Analytics Integration

## Overview
Complete observability solution for ElizaOS agents with Edge Functions and Socket.IO support.

## Quick Start

### 1. Environment Setup
Add to your `.env`:
```bash
CLICKHOUSE_HOST=https://rtfef3a3gz.us-west-2.aws.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<your-password>
CLICKHOUSE_DATABASE=elizaos_analytics
```

### 2. View Analytics
```bash
cd deploy/analytics
./dashboard.sh            # Unified dashboard
./clickhouse-queries.sh   # Basic metrics
```

## Components

### ElizaOS Agent Plugin
- Location: `/packages/plugin-clickhouse-analytics/`
- Auto-tracks: messages, tool calls, errors, costs
- Already integrated in `/src/index.ts`

### Edge Functions Middleware
- Location: `/supabase/functions/_shared/clickhouse-analytics.ts`
- Tracks: execution time, cold starts, errors, costs
- Usage: Wrap handlers with `edgeAnalytics.middleware()`

### Socket.IO Service
- Location: `/src/services/socket-io-analytics-enhanced.ts`
- Tracks: connections, events, rooms, latency

## Database Schema

### Tables
- `agent_events` - Agent interactions (30-day retention)
- `edge_function_events` - Edge function metrics (30-day retention)
- `socket_events` - Socket.IO events (7-day retention)
- `event_correlation` - Cross-service tracing (14-day retention)

### Materialized Views
- `hourly_stats` - Pre-aggregated agent metrics
- `edge_function_stats` - Function performance rollups
- `socket_connection_stats` - Connection statistics

## Key Features
- **Distributed tracing** via trace_id correlation
- **Automatic batching** (100 events or 5 seconds)
- **Failure resilience** with retry logic
- **Cost tracking** for LLM and compute usage
- **Real-time dashboards** with sub-second queries

## Production Checklist
- [ ] Set environment variables
- [ ] Deploy Edge Function middleware
- [ ] Enable Socket.IO enhanced service
- [ ] Configure retention policies
- [ ] Set up monitoring alerts
- [ ] Create read-only dashboard users

## Security
- Use environment variables for credentials
- Consider separate read/write users
- Hash PII before transmission
- Enable RBAC for team access

## Support
For issues or questions, check the dashboard for real-time metrics and traces.
