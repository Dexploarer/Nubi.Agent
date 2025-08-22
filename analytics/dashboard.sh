#!/bin/bash

CH_HOST="https://rtfef3a3gz.us-west-2.aws.clickhouse.cloud:8443"
CH_USER="default"
CH_PASS="q29kz~ugjvtGM"

# Function to run queries
run_query() {
    local query="$1"
    curl -s --user "${CH_USER}:${CH_PASS}" \
        --data-binary "$query" \
        "${CH_HOST}" 2>/dev/null
}

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          UNIFIED ANALYTICS DASHBOARD - ElizaOS + Edge + Socket    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo

# 1. System Overview
echo "🌐 SYSTEM OVERVIEW (Last Hour)"
echo "================================"
run_query "
SELECT 
    'Agent Events' as source,
    count() as events,
    avg(duration_ms) as avg_latency_ms,
    sum(cost_millicents) / 100.0 as cost_usd
FROM elizaos_analytics.agent_events
WHERE timestamp > now() - INTERVAL 1 HOUR
UNION ALL
SELECT 
    'Edge Functions' as source,
    count() as events,
    avg(execution_time_ms) as avg_latency_ms,
    sum(toDecimal64(estimated_cost, 9)) as cost_usd
FROM elizaos_analytics.edge_function_events
WHERE timestamp > now() - INTERVAL 1 HOUR
UNION ALL
SELECT 
    'Socket.IO' as source,
    count() as events,
    avg(latency_ms) as avg_latency_ms,
    0 as cost_usd
FROM elizaos_analytics.socket_events
WHERE timestamp > now() - INTERVAL 1 HOUR
FORMAT PrettyCompactMonoBlock"
echo

# 2. Real-time Activity
echo "⚡ REAL-TIME ACTIVITY (Last 5 Minutes)"
echo "========================================"
run_query "
WITH recent_events AS (
    SELECT 
        timestamp,
        'agent' as source,
        event_type as event,
        session_id,
        success
    FROM elizaos_analytics.agent_events
    WHERE timestamp > now() - INTERVAL 5 MINUTE
    UNION ALL
    SELECT 
        timestamp,
        'edge' as source,
        function_name as event,
        session_id,
        CASE WHEN status_code < 400 THEN 1 ELSE 0 END as success
    FROM elizaos_analytics.edge_function_events
    WHERE timestamp > now() - INTERVAL 5 MINUTE
    UNION ALL
    SELECT 
        timestamp,
        'socket' as source,
        event_name as event,
        session_id,
        1 as success
    FROM elizaos_analytics.socket_events
    WHERE timestamp > now() - INTERVAL 5 MINUTE
)
SELECT 
    source,
    count() as total_events,
    countIf(success = 1) as successful,
    round(100.0 * countIf(success = 1) / count(), 2) as success_rate,
    uniqExact(session_id) as unique_sessions
FROM recent_events
GROUP BY source
ORDER BY total_events DESC
FORMAT PrettyCompactMonoBlock"
echo

# 3. Edge Function Performance
echo "🚀 EDGE FUNCTION PERFORMANCE (Last 24h)"
echo "=========================================="
run_query "
SELECT 
    function_name,
    count() as invocations,
    sum(cold_start) as cold_starts,
    round(avg(execution_time_ms), 2) as avg_ms,
    quantile(0.95)(execution_time_ms) as p95_ms,
    quantile(0.99)(execution_time_ms) as p99_ms,
    round(sum(toDecimal64(estimated_cost, 9)), 6) as total_cost_usd
FROM elizaos_analytics.edge_function_events
WHERE timestamp > now() - INTERVAL 24 HOUR
GROUP BY function_name
ORDER BY invocations DESC
LIMIT 5
FORMAT PrettyCompactMonoBlock"
echo

# 4. Socket.IO Connections
echo "🔌 SOCKET.IO CONNECTIONS (Current)"
echo "====================================="
run_query "
WITH socket_stats AS (
    SELECT 
        event_type,
        count() as event_count,
        uniqExact(socket_id) as unique_sockets,
        max(connected_clients) as max_concurrent
    FROM elizaos_analytics.socket_events
    WHERE timestamp > now() - INTERVAL 1 HOUR
    GROUP BY event_type
)
SELECT 
    event_type,
    event_count,
    unique_sockets,
    max_concurrent
FROM socket_stats
ORDER BY event_count DESC
LIMIT 10
FORMAT PrettyCompactMonoBlock"
echo

# 5. Agent Tool Usage
echo "🔧 AGENT TOOL PERFORMANCE (Last 24h)"
echo "======================================="
run_query "
SELECT 
    event_subtype as tool,
    count() as calls,
    round(100.0 * sum(success) / count(), 2) as success_rate,
    round(avg(duration_ms), 2) as avg_ms,
    quantile(0.95)(duration_ms) as p95_ms
FROM elizaos_analytics.agent_events
WHERE event_type = 'tool_call' 
    AND timestamp > now() - INTERVAL 24 HOUR
GROUP BY tool
HAVING calls > 0
ORDER BY calls DESC
LIMIT 10
FORMAT PrettyCompactMonoBlock"
echo

# 6. Error Analysis
echo "❌ ERROR ANALYSIS (Last Hour)"
echo "================================"
run_query "
WITH all_errors AS (
    SELECT 
        'agent' as source,
        error_code,
        count() as count
    FROM elizaos_analytics.agent_events
    WHERE success = 0 AND timestamp > now() - INTERVAL 1 HOUR
    GROUP BY error_code
    UNION ALL
    SELECT 
        'edge' as source,
        error_type as error_code,
        count() as count
    FROM elizaos_analytics.edge_function_events
    WHERE status_code >= 400 AND timestamp > now() - INTERVAL 1 HOUR
    GROUP BY error_type
    UNION ALL
    SELECT 
        'socket' as source,
        event_name as error_code,
        count() as count
    FROM elizaos_analytics.socket_events
    WHERE event_type = 'error' AND timestamp > now() - INTERVAL 1 HOUR
    GROUP BY event_name
)
SELECT 
    source,
    error_code,
    count
FROM all_errors
WHERE error_code != ''
ORDER BY count DESC
LIMIT 10
FORMAT PrettyCompactMonoBlock"
echo

# 7. Cost Breakdown
echo "💰 COST BREAKDOWN (Today)"
echo "============================"
run_query "
WITH costs AS (
    SELECT 
        'Agent LLM' as category,
        sum(cost_millicents) / 100.0 as cost_usd
    FROM elizaos_analytics.agent_events
    WHERE date = today()
    UNION ALL
    SELECT 
        'Edge Functions' as category,
        sum(toDecimal64(estimated_cost, 9)) as cost_usd
    FROM elizaos_analytics.edge_function_events
    WHERE date = today()
)
SELECT 
    category,
    round(cost_usd, 4) as cost_usd,
    round(100.0 * cost_usd / sum(cost_usd) OVER (), 2) as percent_of_total
FROM costs
ORDER BY cost_usd DESC
FORMAT PrettyCompactMonoBlock"
echo

# 8. Session Flow Analysis
echo "🔄 SESSION FLOW (Sample Trace)"
echo "================================="
run_query "
WITH session_trace AS (
    SELECT 
        timestamp,
        'agent' as source,
        event_type as event,
        session_id,
        duration_ms
    FROM elizaos_analytics.agent_events
    WHERE session_id IN (
        SELECT session_id 
        FROM elizaos_analytics.agent_events 
        WHERE timestamp > now() - INTERVAL 1 HOUR 
        LIMIT 1
    )
    UNION ALL
    SELECT 
        timestamp,
        'edge' as source,
        function_name as event,
        session_id,
        execution_time_ms as duration_ms
    FROM elizaos_analytics.edge_function_events
    WHERE session_id IN (
        SELECT session_id 
        FROM elizaos_analytics.agent_events 
        WHERE timestamp > now() - INTERVAL 1 HOUR 
        LIMIT 1
    )
)
SELECT 
    formatDateTime(timestamp, '%H:%M:%S') as time,
    source,
    event,
    duration_ms
FROM session_trace
ORDER BY timestamp
LIMIT 20
FORMAT PrettyCompactMonoBlock"
echo

echo
echo "═══════════════════════════════════════════════════════════════════"
echo "📊 Dashboard refreshed at: $(date)"
echo "═══════════════════════════════════════════════════════════════════"
