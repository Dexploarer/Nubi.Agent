# NUBI Real-Time Streaming Implementation

## 🚀 Overview

NUBI now has comprehensive real-time streaming capabilities for LLM responses, providing intelligent routing between batch and streaming delivery methods based on message complexity, user preferences, and network conditions.

## 🏗️ Architecture

### Core Components

1. **StreamingSessionsService** (`src/services/streaming-sessions-service.ts`)
   - Manages real-time streaming sessions
   - Handles chunk generation and delivery
   - Provides response strategy determination
   - Integrates with ElizaOS memory system

2. **ResponseStrategyEvaluator** (`src/evaluators/response-strategy-evaluator.ts`)
   - ElizaOS Evaluator for intelligent routing decisions
   - Analyzes message complexity and context
   - Evaluates user preferences and session history
   - Tracks performance metrics for optimization

3. **Enhanced SocketIOSessionsService**
   - WebSocket streaming events added
   - Progressive chunk delivery
   - Real-time session broadcasting
   - Automatic strategy evaluation

## 📡 Streaming Methods

### 1. WebSocket Streaming (Socket.IO)

**Events:**
- `session:streamMessage` - Initiate streaming
- `session:streamStart` - Stream started notification
- `session:streamChunk` - Chunk delivery
- `session:streamComplete` - Stream completion
- `session:streamError` - Error notification

**Client Usage:**
```javascript
// Request streaming response
socket.emit('session:streamMessage', {
  sessionId: 'session-id',
  content: 'Explain quantum computing in detail',
  type: 'text',
  metadata: { preferStreaming: true }
}, (response) => {
  console.log('Stream initiated:', response);
});

// Listen for chunks
socket.on('session:streamChunk', (chunk) => {
  console.log('Received chunk:', chunk.content);
  // Append to UI progressively
});

// Handle completion
socket.on('session:streamComplete', (data) => {
  console.log('Stream complete:', data.finalContent);
});
```

### 2. Server-Sent Events (SSE)

**Endpoint:** `GET /api/messaging/sessions/:sessionId/stream`

**Client Usage:**
```javascript
const eventSource = new EventSource(
  `/api/messaging/sessions/${sessionId}/stream?message=${encodeURIComponent(message)}`
);

eventSource.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  console.log('Chunk:', chunk.content);
};

eventSource.addEventListener('complete', (event) => {
  console.log('Stream complete');
  eventSource.close();
});
```

### 3. Strategy Evaluation Endpoint

**Endpoint:** `POST /api/messaging/sessions/:sessionId/strategy`

**Request:**
```json
{
  "content": "Your message here",
  "type": "text",
  "metadata": {
    "networkQuality": "good",
    "device": "desktop"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "strategy": {
      "method": "stream",
      "reasoning": "High complexity score: 0.85",
      "estimatedDuration": 5000,
      "estimatedTokens": 800,
      "confidence": 0.92
    },
    "streamingAvailable": true,
    "websocketUrl": "/api/messaging/sessions/session-123/ws",
    "sseUrl": "/api/messaging/sessions/session-123/stream"
  }
}
```

## 🧠 Intelligent Routing

### Decision Factors

1. **Message Complexity** (40% weight)
   - Word count and structure
   - Question complexity
   - Technical terminology
   - Code-related requests

2. **Classification Confidence** (20% weight)
   - Lower confidence → Higher complexity
   - Prompt type analysis

3. **Context Factors**
   - User preferences
   - Session type
   - Network quality
   - Device capabilities
   - Previous interactions
   - Average response time

### Strategy Types

- **Batch**: Quick, complete responses for simple queries
- **Stream**: Progressive delivery for complex responses
- **Hybrid**: Initial batch with streaming continuation

### Automatic Streaming Triggers

Messages are automatically streamed when:
- Estimated tokens > 500 (configurable)
- Complex analysis or explanation requested
- Code generation detected
- User preference set to streaming
- Mobile device with medium+ complexity
- Historical streaming success rate > 90%

## ⚙️ Configuration

### Streaming Config (`configs/streaming-config.yaml`)

```yaml
streaming:
  enabled: true
  strategies:
    streaming_threshold: 500  # Token threshold
    streaming_prompts:
      - technical-expert
      - crypto-analyst
      - code-generation
  chunking:
    chunk_size: 50
    flush_interval: 100
  performance:
    cache_responses: true
    max_parallel_streams: 10
```

### Environment Variables

```bash
# Enable streaming globally
STREAMING_ENABLED=true

# SSE configuration
SSE_HEARTBEAT_INTERVAL=30000
SSE_CONNECTION_TIMEOUT=300000

# WebSocket configuration
WS_MAX_MESSAGE_SIZE=1048576
WS_PING_INTERVAL=30000

# Performance
STREAMING_CACHE_TTL=300
MAX_PARALLEL_STREAMS=10
```

## 📊 Performance Metrics

The system tracks:
- Stream duration
- Chunk count and size
- Completion rate
- Error rate
- User satisfaction score
- Network adaptation effectiveness

Metrics are used to:
- Optimize future routing decisions
- Improve chunk sizing
- Adapt to network conditions
- Personalize user experience

## 🔄 Network Adaptation

### Quality Levels

- **Poor** (< 500 Kbps): Force batch mode
- **Fair** (500 Kbps - 1 Mbps): Hybrid mode
- **Good** (1-5 Mbps): Stream mode
- **Excellent** (> 5 Mbps): Stream with larger chunks

### Adaptive Features

- Dynamic chunk sizing
- Automatic fallback to batch
- Connection quality monitoring
- Retry with exponential backoff

## 🛡️ Error Handling

- Automatic retry (3 attempts)
- Fallback to batch on failure
- Graceful degradation
- Error streaming (optional)
- Connection recovery

## 🎯 Use Cases

### Optimal for Streaming

1. **Complex Explanations**
   - Technical concepts
   - Multi-step processes
   - Detailed analysis

2. **Code Generation**
   - Function implementations
   - Class structures
   - Architecture designs

3. **Long-Form Content**
   - Documentation
   - Tutorials
   - Reports

4. **Mobile Experience**
   - Progressive loading
   - Reduced wait time
   - Better perceived performance

### Optimal for Batch

1. **Simple Queries**
   - Yes/no questions
   - Quick lookups
   - Status checks

2. **Emergency Responses**
   - Critical alerts
   - Error messages
   - System notifications

3. **Poor Network**
   - Unreliable connections
   - High latency
   - Limited bandwidth

## 🚦 Integration Status

✅ **Completed:**
- StreamingSessionsService implementation
- ResponseStrategyEvaluator
- WebSocket streaming events
- SSE endpoint
- Strategy evaluation API
- Configuration system
- NUBI plugin integration

🔄 **In Production:**
- Real-time chunk delivery
- Intelligent routing decisions
- Performance tracking
- Network adaptation

## 📈 Future Enhancements

1. **LLM Integration**
   - Direct OpenAI streaming API
   - Anthropic Claude streaming
   - Custom model streaming

2. **Advanced Features**
   - Multi-modal streaming (images, audio)
   - Partial result caching
   - Predictive pre-streaming
   - Collaborative streaming sessions

3. **Optimization**
   - ML-based strategy prediction
   - Dynamic chunk optimization
   - Bandwidth prediction
   - User behavior learning

## 🔧 Testing

### WebSocket Test
```bash
# Connect to Socket.IO
wscat -c ws://localhost:3001/socket.io/

# Send streaming message
{"event": "session:streamMessage", "data": {"sessionId": "test", "content": "Explain blockchain"}}
```

### SSE Test
```bash
# Stream via SSE
curl -N "http://localhost:3000/api/messaging/sessions/test/stream?message=Explain%20AI"
```

### Strategy Test
```bash
# Check strategy
curl -X POST http://localhost:3000/api/messaging/sessions/test/strategy \
  -H "Content-Type: application/json" \
  -d '{"content": "Complex technical question"}'
```

## 📝 Summary

NUBI's streaming implementation provides:
- **Intelligent routing** between batch and streaming
- **Real-time delivery** via WebSocket and SSE
- **Context-aware decisions** based on multiple factors
- **Performance optimization** through metrics and caching
- **Network adaptation** for varying conditions
- **Seamless integration** with ElizaOS architecture

The system automatically determines the optimal delivery method for each message, ensuring the best user experience while maintaining performance and reliability.