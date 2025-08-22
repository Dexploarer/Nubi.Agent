-- Create database for AI agent analytics
CREATE DATABASE IF NOT EXISTS elizaos_analytics;

-- Core events table - lightweight for early development
CREATE TABLE IF NOT EXISTS elizaos_analytics.agent_events
(
    timestamp           DateTime64(3),
    date                Date DEFAULT toDate(timestamp),
    session_id          String,
    agent_id            LowCardinality(String),
    event_type          LowCardinality(String),  -- message, tool_call, error, eval
    event_subtype       LowCardinality(String),  -- tool_name, error_type, etc
    
    -- Performance metrics
    duration_ms         UInt32,
    tokens_in           UInt32,
    tokens_out          UInt32,
    
    -- Cost tracking (in millicents to avoid decimals)
    cost_millicents     UInt32,
    
    -- Success/failure tracking
    success             UInt8,
    error_code          LowCardinality(String),
    
    -- Flexible metadata
    metadata            String,  -- JSON string for now
    
    -- Deduplication
    event_id            UUID DEFAULT generateUUIDv4()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (timestamp, session_id, event_type)
TTL date + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Simple hourly rollup for dashboards
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, agent_id, event_type)
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    agent_id,
    event_type,
    count() AS event_count,
    sum(duration_ms) AS total_duration_ms,
    sum(tokens_in) AS total_tokens_in,
    sum(tokens_out) AS total_tokens_out,
    sum(cost_millicents) AS total_cost_millicents,
    sum(success) AS success_count,
    sum(1 - success) AS failure_count
FROM elizaos_analytics.agent_events
GROUP BY hour, agent_id, event_type;

-- Tool performance tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.tool_performance
ENGINE = AggregatingMergeTree()
ORDER BY (date, tool_name)
AS
SELECT
    toDate(timestamp) AS date,
    event_subtype AS tool_name,
    count() AS call_count,
    avgState(duration_ms) AS avg_duration,
    quantileState(0.95)(duration_ms) AS p95_duration,
    sum(success) / count() AS success_rate
FROM elizaos_analytics.agent_events
WHERE event_type = 'tool_call'
GROUP BY date, tool_name;
