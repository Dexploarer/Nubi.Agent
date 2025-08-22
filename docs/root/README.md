# 🚀 DEX Analytics - ElizaOS Agent with ClickHouse Observability

[![ElizaOS](https://img.shields.io/badge/ElizaOS-Agent-blue)](https://elizaos.ai)
[![ClickHouse](https://img.shields.io/badge/ClickHouse-Analytics-yellow)](https://clickhouse.com)
[![License](https://img.shields.io/badge/License-MIT-green)]()

## Overview

A production-ready ElizaOS agent (NUBI) with comprehensive ClickHouse analytics integration, providing real-time observability across AI agents, Edge Functions, and Socket.IO connections.

## ✨ Features

### 🤖 AI Agent (NUBI)
- Advanced personality system with emotional intelligence
- Multi-platform support (Telegram, Discord, Twitter)
- Community management and raid coordination
- Anti-detection patterns for natural conversation

### 📊 Analytics Integration
- **Real-time metrics** across all services
- **Distributed tracing** with correlation IDs
- **Cost tracking** for LLM and compute usage
- **Performance monitoring** (p95, p99 latencies)
- **Error tracking** with stack traces
- **Session flow visualization**

### 🔌 Components
- **ElizaOS Agent Plugin** - Automatic event tracking for messages, tools, errors
- **Edge Function Middleware** - Performance and cost monitoring for Supabase
- **Socket.IO Service** - Connection lifecycle and event analytics
- **Unified Dashboard** - Cross-service observability

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- ClickHouse Cloud account
- Supabase project (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/Dexploarer/dex-analytics.git
cd dex-analytics

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Configuration

Add to your `.env`:
```bash
# ClickHouse Analytics
CLICKHOUSE_HOST=https://your-cluster.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
CLICKHOUSE_DATABASE=elizaos_analytics

# ElizaOS Agent
OPENAI_API_KEY=your-key
TELEGRAM_BOT_TOKEN=your-token  # Optional
```

### Running the Agent

```bash
# Development
npm run dev

# Production
npm run start
```

### View Analytics

```bash
cd analytics
./dashboard.sh  # Real-time unified dashboard
```

## 📁 Project Structure

```
dex-analytics/
├── analytics/              # ClickHouse tools and dashboards
│   ├── dashboard.sh       # Unified analytics dashboard
│   └── *.sql             # Database schemas
├── anubis/                # ElizaOS agent (NUBI)
│   ├── src/              # Agent source code
│   └── supabase/         # Edge Functions
├── packages/             
│   └── plugin-clickhouse-analytics/  # Analytics plugin
└── twitter-mcp-server/   # Twitter integration via MCP
```

## 📊 Analytics Dashboard

The unified dashboard provides:
- System overview (events, latency, costs)
- Real-time activity monitoring
- Edge Function performance metrics
- Socket.IO connection stats
- Tool performance analysis
- Error tracking and debugging
- Cost breakdown by service
- Session flow visualization

## 🔧 Development

### Adding Custom Events

```typescript
import { edgeAnalytics } from "../_shared/clickhouse-analytics";

// In your Edge Function
serve(edgeAnalytics.middleware()(handler));
```

### Schema Overview

- `agent_events` - Agent interactions (30-day retention)
- `edge_function_events` - Function metrics (30-day retention)  
- `socket_events` - Socket.IO events (7-day retention)
- `event_correlation` - Cross-service tracing (14-day retention)

## 🔒 Security

- Environment variables for credentials
- No sensitive data in repository
- Automatic PII hashing option
- Read-only dashboard users recommended

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📜 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [ElizaOS](https://elizaos.ai) - AI agent framework
- [ClickHouse](https://clickhouse.com) - Real-time analytics database
- [Supabase](https://supabase.com) - Backend infrastructure

---

Built with ❤️ for the AI agent community
