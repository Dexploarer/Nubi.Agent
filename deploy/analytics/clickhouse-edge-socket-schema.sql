-- moved from analytics/clickhouse-edge-socket-schema.sql
-- Socket.IO enhanced analytics schema
CREATE TABLE IF NOT EXISTS elizaos_analytics.socket_events
(
    timestamp DateTime DEFAULT now(),
    event LowCardinality(String),
    socket_id String,
    room Nullable(String),
    user_id Nullable(String),
    namespace LowCardinality(String),
    latency_ms UInt32,
    error Nullable(String),
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, namespace, event)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;

