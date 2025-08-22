-- Pipeline Analytics Schema for Two-Layer Pre-processing
-- Layer 1: Webhook/Transport Security and Layer 2: Socket.IO Intelligence

-- Pipeline processing events table
CREATE TABLE IF NOT EXISTS elizaos_analytics.pipeline_events
(
    timestamp DateTime DEFAULT now(),
    trace_id String,
    layer LowCardinality(String), -- 'layer1' or 'layer2'
    platform LowCardinality(String), -- 'telegram', 'discord', 'websocket', 'api'
    event_type LowCardinality(String), -- 'security_check', 'rate_limit', 'normalization', 'classification', 'routing'
    user_id String,
    message_id String,
    processing_time_ms UInt32,
    success Bool,
    error Nullable(String),
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, platform, layer)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 14 DAY
SETTINGS index_granularity = 8192;

-- User engagement tracking table
CREATE TABLE IF NOT EXISTS elizaos_analytics.user_engagement
(
    timestamp DateTime DEFAULT now(),
    user_id String,
    platform LowCardinality(String),
    engagement_type LowCardinality(String), -- 'mention', 'random', 'response', 'ignored'
    message_content String,
    nubi_mentioned Bool,
    random_trigger Bool,
    response_generated Bool,
    processing_time_ms UInt32,
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, user_id, platform)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;

-- System prompt routing table
CREATE TABLE IF NOT EXISTS elizaos_analytics.prompt_routing
(
    timestamp DateTime DEFAULT now(),
    trace_id String,
    user_id String,
    platform LowCardinality(String),
    message_content String,
    extracted_variables JSON,
    classified_intent LowCardinality(String),
    selected_prompt LowCardinality(String), -- 'community-manager', 'raid-coordinator', etc.
    confidence_score Float32,
    processing_time_ms UInt32,
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, selected_prompt, platform)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Security events table
CREATE TABLE IF NOT EXISTS elizaos_analytics.security_events
(
    timestamp DateTime DEFAULT now(),
    platform LowCardinality(String),
    event_type LowCardinality(String), -- 'rate_limit', 'invalid_signature', 'blocked_ip', 'spam_detected'
    source_ip String,
    user_id Nullable(String),
    severity LowCardinality(String), -- 'low', 'medium', 'high', 'critical'
    blocked Bool,
    metadata JSON
)
ENGINE = MergeTree
ORDER BY (timestamp, severity, platform)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for pipeline performance
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.pipeline_performance
ENGINE = SummingMergeTree
ORDER BY (toStartOfMinute(timestamp), layer, platform, event_type)
AS
SELECT
    toStartOfMinute(timestamp) AS minute,
    layer,
    platform,
    event_type,
    count() AS events,
    countIf(success) AS successful_events,
    countIf(NOT success) AS failed_events,
    quantileExact(0.95)(processing_time_ms) AS p95_processing_time,
    avg(processing_time_ms) AS avg_processing_time
FROM elizaos_analytics.pipeline_events
GROUP BY minute, layer, platform, event_type;

-- Materialized view for user engagement stats
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.engagement_stats
ENGINE = SummingMergeTree
ORDER BY (toStartOfHour(timestamp), platform, engagement_type)
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    platform,
    engagement_type,
    count() AS total_interactions,
    countIf(nubi_mentioned) AS mention_interactions,
    countIf(random_trigger) AS random_interactions,
    countIf(response_generated) AS responses_generated,
    quantileExact(0.95)(processing_time_ms) AS p95_processing_time,
    avg(processing_time_ms) AS avg_processing_time
FROM elizaos_analytics.user_engagement
GROUP BY hour, platform, engagement_type;

-- Materialized view for prompt routing efficiency
CREATE MATERIALIZED VIEW IF NOT EXISTS elizaos_analytics.routing_efficiency
ENGINE = SummingMergeTree
ORDER BY (toStartOfHour(timestamp), selected_prompt, platform)
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    selected_prompt,
    platform,
    count() AS total_routes,
    avg(confidence_score) AS avg_confidence,
    quantileExact(0.95)(processing_time_ms) AS p95_processing_time,
    avg(processing_time_ms) AS avg_processing_time,
    count(DISTINCT user_id) AS unique_users
FROM elizaos_analytics.prompt_routing
GROUP BY hour, selected_prompt, platform;