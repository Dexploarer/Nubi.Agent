-- moved from analytics/clickhouse-setup.sql
-- Create database for AI agent analytics
CREATE DATABASE IF NOT EXISTS elizaos_analytics;

-- Create main events table
CREATE TABLE IF NOT EXISTS elizaos_analytics.agent_events
(
    timestamp DateTime DEFAULT now(),
    trace_id String,
    session_id String,
    user_id String,
    provider LowCardinality(String),
    model LowCardinality(String),
    message String,
    role LowCardinality(String),
    tokens UInt32,
    cost Float64,
    latency_ms UInt32,
    error Nullable(String),
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, session_id)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for hourly stats
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.hourly_stats
ENGINE = SummingMergeTree
ORDER BY (toStartOfHour(timestamp), provider, model)
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    provider,
    model,
    count() AS events,
    sum(tokens) AS tokens,
    sum(cost) AS cost,
    quantileExact(0.95)(latency_ms) AS p95_latency,
    countIf(error IS NOT NULL) AS errors
FROM elizaos_analytics.agent_events
GROUP BY hour, provider, model;

-- Materialized view for tool performance
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.tool_performance
ENGINE = SummingMergeTree
ORDER BY (toStartOfFiveMinutes(timestamp), JSON_VALUE(metadata, '$.tool'))
AS
SELECT
    toStartOfFiveMinutes(timestamp) AS bucket,
    JSON_VALUE(metadata, '$.tool') AS tool,
    count() AS calls,
    sumIf(1, error IS NULL) AS successes,
    sumIf(1, error IS NOT NULL) AS failures,
    quantileExact(0.95)(latency_ms) AS p95_latency
FROM elizaos_analytics.agent_events
GROUP BY bucket, tool;

