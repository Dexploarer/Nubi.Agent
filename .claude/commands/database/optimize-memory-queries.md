# Optimize Memory Queries

Optimize ElizaOS memory queries for better performance and semantic search accuracy.

**Usage**: `/project:optimize-memory-queries [query_type]`

## Task

Optimize memory query performance and accuracy:

Query Type: $ARGUMENTS (default: all)

## Optimization Strategies

### 1. Semantic Search Optimization

```typescript
// Enhanced memory search with parallel processing
const optimizeSemanticSearch = async (
  runtime: IAgentRuntime,
  query: string,
  roomId: UUID,
  options: {
    count?: number;
    threshold?: number;
    dimensions?: number;
  } = {}
) => {
  const { count = 10, threshold = 0.7, dimensions = 1536 } = options;
  
  // Parallel embedding and search operations
  const [embedding, existingMemories] = await Promise.all([
    runtime.useModel(ModelType.TEXT_EMBEDDING, { text: query }),
    runtime.searchMemories({
      roomId,
      count: count * 2, // Get more results for filtering
      match_threshold: threshold - 0.1,
      tableName: "memories"
    })
  ]);
  
  // Post-process results with enhanced filtering
  return existingMemories
    .filter(m => m.similarity && m.similarity >= threshold)
    .slice(0, count);
};
```

### 2. Database Connection Optimization

```typescript
// Connection pooling optimization
const optimizeConnectionPool = async () => {
  const connectionManager = DatabaseConnectionManager.getInstance();
  
  // Parallel connection health checks
  const connections = await connectionManager.getActiveConnections();
  const healthChecks = connections.map(conn => 
    connectionManager.validateConnection(conn)
  );
  
  const results = await Promise.allSettled(healthChecks);
  const staleConnections = results
    .map((result, index) => ({ result, connection: connections[index] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ connection }) => connection);
  
  // Clean up stale connections
  await Promise.all(
    staleConnections.map(conn => connectionManager.closeConnection(conn))
  );
};
```

### 3. Memory Categorization

```typescript
// Categorize memories for targeted queries
const categorizeMemories = async (
  runtime: IAgentRuntime,
  roomId: UUID
) => {
  const categories = {
    raid_data: "raid_participant OR raid_analytics OR raid_metrics",
    user_interactions: "message OR conversation OR context",
    personality_data: "trait OR emotion OR personality",
    community_data: "community OR engagement OR social"
  };
  
  const categoryQueries = Object.entries(categories).map(
    async ([category, filter]) => {
      const memories = await runtime.searchMemories({
        roomId,
        count: 100,
        match_threshold: 0.6,
        tableName: "memories",
        filter: filter
      });
      
      return { category, memories };
    }
  );
  
  return Promise.all(categoryQueries);
};
```

## Performance Monitoring

### Query Performance Metrics

```typescript
// Monitor query performance
const monitorQueryPerformance = async (
  runtime: IAgentRuntime,
  queryFunction: Function,
  context: string
) => {
  const startTime = performance.now();
  
  try {
    const result = await queryFunction();
    const duration = performance.now() - startTime;
    
    logger.info(`[MEMORY_OPTIMIZATION] ${context} completed in ${duration.toFixed(2)}ms`);
    
    // Store performance metrics
    await runtime.createMemory({
      content: {
        type: "performance_metric",
        context,
        duration,
        timestamp: Date.now(),
        success: true
      },
      roomId: runtime.agentId,
      agentId: runtime.agentId,
      userId: runtime.agentId
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error(`[MEMORY_OPTIMIZATION] ${context} failed after ${duration.toFixed(2)}ms:`, error);
    
    throw error;
  }
};
```

## Implementation Steps

1. **Analyze Current Performance**
   - Profile existing memory queries
   - Identify bottlenecks and slow operations
   - Measure baseline performance metrics

2. **Implement Optimizations**
   - Upgrade semantic search algorithms
   - Optimize database connection management
   - Add memory categorization system

3. **Performance Testing**
   - Run benchmark tests with optimized queries
   - Compare performance before and after
   - Validate semantic search accuracy

4. **Monitoring Setup**
   - Add performance tracking to all memory operations
   - Set up alerting for slow queries
   - Create performance dashboards

## ElizaOS Memory Best Practices

- **Parallel Processing**: Execute independent queries concurrently
- **Connection Pooling**: Use centralized connection management
- **Semantic Filtering**: Post-process results for accuracy
- **Performance Tracking**: Monitor all database operations
- **Memory Categories**: Organize memories for efficient retrieval

Focus on maintaining ElizaOS compliance while maximizing query performance and semantic search accuracy.