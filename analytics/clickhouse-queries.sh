#!/bin/bash

CH_HOST="https://rtfef3a3gz.us-west-2.aws.clickhouse.cloud:8443"
CH_USER="default"
CH_PASS="q29kz~ugjvtGM"

# Function to run a query
run_query() {
    local query="$1"
    curl -s --user "${CH_USER}:${CH_PASS}" \
        --data-binary "$query" \
        "${CH_HOST}" 2>/dev/null
}

echo "=== ClickHouse Analytics Dashboard ==="
echo

# 1. Total events today
echo "📊 Events Today:"
run_query "SELECT count() as total_events FROM elizaos_analytics.agent_events WHERE date = today()"
echo

# 2. Event breakdown
echo "📈 Event Type Breakdown (Last 24h):"
run_query "
SELECT 
    event_type, 
    count() as count,
    avg(duration_ms) as avg_duration_ms
FROM elizaos_analytics.agent_events 
WHERE timestamp > now() - INTERVAL 1 DAY
GROUP BY event_type
ORDER BY count DESC
FORMAT PrettyCompactMonoBlock
"
echo

# 3. Tool performance
echo "🔧 Tool Performance (Last 24h):"
run_query "
SELECT 
    event_subtype as tool_name,
    count() as calls,
    sum(success) / count() as success_rate,
    avg(duration_ms) as avg_ms,
    quantile(0.95)(duration_ms) as p95_ms
FROM elizaos_analytics.agent_events
WHERE event_type = 'tool_call' AND timestamp > now() - INTERVAL 1 DAY
GROUP BY tool_name
ORDER BY calls DESC
LIMIT 10
FORMAT PrettyCompactMonoBlock
"
echo

# 4. Cost tracking
echo "💰 Cost Analysis (Last 7 days):"
run_query "
SELECT 
    toDate(timestamp) as day,
    sum(cost_millicents) / 100.0 as cost_usd,
    sum(tokens_in) as total_tokens_in,
    sum(tokens_out) as total_tokens_out
FROM elizaos_analytics.agent_events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day DESC
FORMAT PrettyCompactMonoBlock
"
echo

# 5. Error tracking
echo "❌ Recent Errors:"
run_query "
SELECT 
    timestamp,
    event_subtype as error_type,
    error_code,
    substring(metadata, 1, 100) as error_detail
FROM elizaos_analytics.agent_events
WHERE event_type = 'error' AND timestamp > now() - INTERVAL 1 HOUR
ORDER BY timestamp DESC
LIMIT 5
FORMAT PrettyCompactMonoBlock
"
