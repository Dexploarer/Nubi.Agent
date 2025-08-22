-- Extended schema for Edge Functions and Socket.IO analytics

-- Edge Function events table
CREATE TABLE IF NOT EXISTS elizaos_analytics.edge_function_events
(
    timestamp           DateTime64(3),
    date                Date DEFAULT toDate(timestamp),
    function_name       LowCardinality(String),
    function_version    LowCardinality(String),
    region              LowCardinality(String),
    
    -- Request details
    request_id          String,
    method              LowCardinality(String),
    path                String,
    status_code         UInt16,
    
    -- Performance metrics
    cold_start          UInt8,
    execution_time_ms   UInt32,
    memory_used_mb      UInt32,
    
    -- Payload info
    request_size_bytes  UInt32,
    response_size_bytes UInt32,
    
    -- Cost tracking
    compute_time_ms     UInt32,
    estimated_cost      Decimal(18,9),
    
    -- Error tracking
    error_type          LowCardinality(String),
    error_message       String,
    
    -- Correlation
    session_id          String,
    user_id             String,
    trace_id            String,
    
    metadata            String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (timestamp, function_name, request_id)
TTL date + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Socket.IO events table
CREATE TABLE IF NOT EXISTS elizaos_analytics.socket_events
(
    timestamp           DateTime64(3),
    date                Date DEFAULT toDate(timestamp),
    
    -- Connection details
    socket_id           String,
    connection_id       String,
    event_type          LowCardinality(String), -- connect, disconnect, error, custom
    event_name          LowCardinality(String), -- specific event name
    
    -- Room/Channel info
    room_id             String,
    namespace           LowCardinality(String),
    
    -- Client info
    client_ip           String,
    user_agent          String,
    transport           LowCardinality(String), -- websocket, polling
    
    -- Performance
    latency_ms          UInt32,
    payload_size_bytes  UInt32,
    
    -- State tracking
    connected_clients   UInt32,
    rooms_joined        Array(String),
    
    -- Correlation
    session_id          String,
    user_id             String,
    agent_id            String,
    
    metadata            String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (timestamp, socket_id, event_type)
TTL date + INTERVAL 7 DAY  -- Shorter retention for high-volume socket events
SETTINGS index_granularity = 8192;

-- Materialized view for Edge Function performance
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.edge_function_stats
ENGINE = AggregatingMergeTree()
ORDER BY (hour, function_name)
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    function_name,
    count() AS invocations,
    sum(cold_start) AS cold_starts,
    avgState(execution_time_ms) AS avg_execution_time,
    quantileState(0.95)(execution_time_ms) AS p95_execution_time,
    quantileState(0.99)(execution_time_ms) AS p99_execution_time,
    sum(compute_time_ms) AS total_compute_ms,
    sum(toDecimal64(estimated_cost, 9)) AS total_cost,
    countIf(status_code >= 400) AS errors
FROM elizaos_analytics.edge_function_events
GROUP BY hour, function_name;

-- Materialized view for Socket.IO connection stats
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.socket_connection_stats
ENGINE = SummingMergeTree()
ORDER BY (minute, event_type)
AS
SELECT
    toStartOfMinute(timestamp) AS minute,
    event_type,
    count() AS event_count,
    uniqExact(socket_id) AS unique_sockets,
    uniqExact(user_id) AS unique_users,
    avg(latency_ms) AS avg_latency,
    sum(payload_size_bytes) AS total_bytes
FROM elizaos_analytics.socket_events
GROUP BY minute, event_type;

-- Unified correlation table (links agent, edge, socket events)
CREATE TABLE IF NOT EXISTS elizaos_analytics.event_correlation
(
    timestamp           DateTime64(3),
    trace_id            String,
    span_id             String,
    parent_span_id      String,
    
    -- Event source
    source_type         LowCardinality(String), -- agent, edge, socket
    source_id           String,
    
    -- Event details
    event_name          String,
    duration_ms         UInt32,
    
    -- Correlation IDs
    session_id          String,
    user_id             String,
    request_id          String,
    
    metadata            String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(toDate(timestamp))
ORDER BY (trace_id, timestamp)
TTL toDate(timestamp) + INTERVAL 14 DAY;
