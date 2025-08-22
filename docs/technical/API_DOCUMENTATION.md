# NUBI Agent API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [API Endpoints](#api-endpoints)
5. [WebSocket Events](#websocket-events)
6. [Error Handling](#error-handling)
7. [SDKs and Libraries](#sdks-and-libraries)

## Overview

The NUBI Agent API provides programmatic access to interact with the AI agent, manage raids, track analytics, and integrate with various platforms.

### Base URLs
- Production: `https://api.nubi.ai/v1`
- Staging: `https://staging-api.nubi.ai/v1`
- WebSocket: `wss://ws.nubi.ai`

### API Versioning
The API uses URL path versioning. Current version: `v1`

## Authentication

### API Key Authentication
```http
Authorization: Bearer YOUR_API_KEY
```

### OAuth 2.0 Flow
```http
GET /oauth/authorize?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&response_type=code
POST /oauth/token
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1234567890,
  "scope": ["read", "write", "admin"],
  "platform": "telegram"
}
```

## Rate Limiting

| Tier | Requests/Min | Requests/Hour | Burst |
|------|-------------|---------------|-------|
| Free | 20 | 1000 | 30 |
| Pro | 60 | 5000 | 100 |
| Enterprise | 300 | 30000 | 500 |

### Rate Limit Headers
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

## API Endpoints

### Agent Interactions

#### Send Message
```http
POST /agent/message
Content-Type: application/json

{
  "message": "Hello NUBI",
  "platform": "telegram",
  "user_id": "user_123",
  "context": {
    "channel_id": "channel_456",
    "thread_id": "thread_789"
  }
}

Response: 200 OK
{
  "response": "Greetings, digital wanderer...",
  "message_id": "msg_abc123",
  "tokens_used": 45,
  "personality_state": "neutral",
  "suggestions": ["Ask about raids", "Check stats"]
}
```

#### Get Agent Status
```http
GET /agent/status

Response: 200 OK
{
  "status": "online",
  "personality": "neutral",
  "active_sessions": 145,
  "response_time_ms": 230,
  "version": "1.2.3"
}
```

### Raid Management

#### Create Raid
```http
POST /raids/create
Content-Type: application/json

{
  "target": "@target_channel",
  "duration_minutes": 60,
  "min_participants": 10,
  "rewards": {
    "xp_per_action": 10,
    "bonus_completion": 100
  },
  "objectives": [
    {"type": "messages", "count": 50},
    {"type": "reactions", "count": 100}
  ]
}

Response: 201 Created
{
  "raid_id": "raid_xyz789",
  "status": "pending",
  "start_time": "2024-01-15T10:00:00Z",
  "join_url": "https://t.me/nubi_raids/xyz789"
}
```

#### Get Raid Status
```http
GET /raids/{raid_id}

Response: 200 OK
{
  "raid_id": "raid_xyz789",
  "status": "active",
  "participants": 25,
  "progress": {
    "messages": 30,
    "reactions": 67,
    "completion_percentage": 48.5
  },
  "leaderboard": [
    {"user_id": "user_123", "score": 250, "rank": 1}
  ]
}
```

#### Join Raid
```http
POST /raids/{raid_id}/join
Content-Type: application/json

{
  "user_id": "user_123",
  "platform": "telegram"
}

Response: 200 OK
{
  "success": true,
  "participant_id": "part_456",
  "objectives": [...],
  "current_rank": 15
}
```

### Analytics

#### Track Event
```http
POST /analytics/track
Content-Type: application/json

{
  "event": "message_sent",
  "user_id": "user_123",
  "properties": {
    "platform": "telegram",
    "message_type": "command",
    "command": "/stats"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}

Response: 202 Accepted
{
  "event_id": "evt_abc123",
  "processed": true
}
```

#### Get Analytics
```http
GET /analytics/summary?from=2024-01-01&to=2024-01-31&metrics=dau,messages,raids

Response: 200 OK
{
  "period": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  },
  "metrics": {
    "dau": {
      "average": 1250,
      "peak": 2100,
      "trend": "+15%"
    },
    "messages": {
      "total": 45000,
      "per_user": 36,
      "platforms": {
        "telegram": 25000,
        "discord": 15000,
        "twitter": 5000
      }
    },
    "raids": {
      "completed": 25,
      "participation_rate": 0.65,
      "average_participants": 45
    }
  }
}
```

### User Management

#### Get User Profile
```http
GET /users/{user_id}

Response: 200 OK
{
  "user_id": "user_123",
  "username": "CryptoNinja",
  "platforms": [
    {
      "type": "telegram",
      "id": "tg_123",
      "joined": "2024-01-01T00:00:00Z"
    }
  ],
  "stats": {
    "total_xp": 5420,
    "level": 12,
    "raids_completed": 15,
    "messages_sent": 234
  },
  "achievements": [
    {"id": "first_raid", "unlocked": "2024-01-05T10:00:00Z"}
  ]
}
```

#### Update User Preferences
```http
PATCH /users/{user_id}/preferences
Content-Type: application/json

{
  "personality_preference": "technical",
  "notification_settings": {
    "raids": true,
    "mentions": true,
    "daily_summary": false
  },
  "language": "en"
}

Response: 200 OK
{
  "success": true,
  "updated_fields": ["personality_preference", "notification_settings", "language"]
}
```

### Session Management

#### Create Session
```http
POST /sessions/create
Content-Type: application/json

{
  "user_id": "user_123",
  "platform": "telegram",
  "metadata": {
    "device": "mobile",
    "app_version": "2.1.0"
  }
}

Response: 201 Created
{
  "session_id": "sess_abc123",
  "token": "jwt_token_here",
  "expires_at": "2024-01-16T10:00:00Z"
}
```

#### Get Session Context
```http
GET /sessions/{session_id}/context

Response: 200 OK
{
  "session_id": "sess_abc123",
  "context": {
    "recent_messages": [...],
    "active_raid": "raid_xyz789",
    "personality_state": "excited",
    "last_interaction": "2024-01-15T10:45:00Z"
  }
}
```

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://ws.nubi.ai');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'YOUR_TOKEN'
}));
```

### Event Types

#### Message Events
```json
{
  "type": "message",
  "data": {
    "message_id": "msg_123",
    "user_id": "user_456",
    "content": "Hello NUBI",
    "platform": "telegram",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### Raid Events
```json
{
  "type": "raid.update",
  "data": {
    "raid_id": "raid_xyz789",
    "status": "active",
    "participants": 30,
    "progress": 65
  }
}
```

#### Analytics Events
```json
{
  "type": "analytics.metric",
  "data": {
    "metric": "active_users",
    "value": 125,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 60 seconds.",
    "details": {
      "limit": 60,
      "reset_at": "2024-01-15T10:01:00Z"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Invalid or missing auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Temporary outage |

## SDKs and Libraries

### Node.js/TypeScript
```typescript
import { NubiClient } from '@nubi/sdk';

const client = new NubiClient({
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

// Send message
const response = await client.agent.sendMessage({
  message: 'Hello NUBI',
  platform: 'telegram',
  userId: 'user_123'
});

// Track event
await client.analytics.track({
  event: 'user_action',
  properties: { action: 'raid_joined' }
});
```

### Python
```python
from nubi import NubiClient

client = NubiClient(
    api_key='YOUR_API_KEY',
    environment='production'
)

# Send message
response = client.agent.send_message(
    message='Hello NUBI',
    platform='telegram',
    user_id='user_123'
)

# Get analytics
analytics = client.analytics.get_summary(
    from_date='2024-01-01',
    to_date='2024-01-31',
    metrics=['dau', 'messages']
)
```

### cURL Examples
```bash
# Send message
curl -X POST https://api.nubi.ai/v1/agent/message \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello NUBI","platform":"telegram","user_id":"user_123"}'

# Get raid status
curl -X GET https://api.nubi.ai/v1/raids/raid_xyz789 \
  -H "Authorization: Bearer YOUR_API_KEY"

# Track analytics event
curl -X POST https://api.nubi.ai/v1/analytics/track \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"page_view","properties":{"page":"/dashboard"}}'
```

## Webhooks

### Webhook Configuration
```http
POST /webhooks/configure
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["raid.started", "raid.completed", "message.received"],
  "secret": "webhook_secret_123"
}
```

### Webhook Payload
```json
{
  "event": "raid.completed",
  "timestamp": "2024-01-15T11:00:00Z",
  "data": {
    "raid_id": "raid_xyz789",
    "participants": 45,
    "success": true
  },
  "signature": "sha256=abc123..."
}
```

### Signature Verification
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

---

*For additional support, visit [docs.nubi.ai](https://docs.nubi.ai) or contact support@nubi.ai*
