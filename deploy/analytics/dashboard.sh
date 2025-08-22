#!/usr/bin/env bash
# moved from analytics/dashboard.sh
set -euo pipefail

CH_HOST="${CH_HOST:-$CLICKHOUSE_HOST}"
CH_USER="${CH_USER:-$CLICKHOUSE_USER:-default}"
CH_PASS="${CH_PASS:-$CLICKHOUSE_PASSWORD:-}"
DB="${CLICKHOUSE_DATABASE:-elizaos_analytics}"

if [[ -z "${CH_HOST}" ]]; then
  echo "Set CLICKHOUSE_HOST (e.g. https://<account>.clickhouse.cloud:8443)" >&2
  exit 1
fi

auth=( )
if [[ -n "${CH_USER}" ]]; then auth+=("--user" "${CH_USER}"); fi
if [[ -n "${CH_PASS}" ]]; then auth+=("--password" "${CH_PASS}"); fi

q() { jq -rn --arg v "$1" '$v|@uri'; }

sections=(
  "Pipeline Events:SELECT timestamp, layer, platform, event_type, user_id, processing_time_ms, success, error FROM ${DB}.pipeline_events ORDER BY timestamp DESC LIMIT 30 FORMAT Pretty"
  "User Engagement:SELECT timestamp, platform, engagement_type, nubi_mentioned, random_trigger, response_generated FROM ${DB}.user_engagement ORDER BY timestamp DESC LIMIT 30 FORMAT Pretty"
  "System Prompt Routing:SELECT timestamp, platform, classified_intent, selected_prompt, confidence_score FROM ${DB}.prompt_routing ORDER BY timestamp DESC LIMIT 30 FORMAT Pretty"
  "Security Events:SELECT timestamp, platform, event_type, severity, blocked, source_ip FROM ${DB}.security_events ORDER BY timestamp DESC LIMIT 20 FORMAT Pretty"
  "Agent Events:SELECT timestamp, provider, model, role, tokens, cost, latency_ms FROM ${DB}.agent_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Edge Functions:SELECT timestamp, function, duration_ms, cold_start, error FROM ${DB}.edge_function_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Socket Events:SELECT timestamp, event, namespace, latency_ms, error FROM ${DB}.socket_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Pipeline Performance:SELECT * FROM ${DB}.pipeline_performance WHERE minute >= now() - INTERVAL 4 HOUR ORDER BY minute DESC LIMIT 20 FORMAT Pretty"
  "Engagement Stats:SELECT * FROM ${DB}.engagement_stats WHERE hour >= now() - INTERVAL 24 HOUR ORDER BY hour DESC LIMIT 24 FORMAT Pretty"
  "Routing Efficiency:SELECT * FROM ${DB}.routing_efficiency WHERE hour >= now() - INTERVAL 24 HOUR ORDER BY hour DESC LIMIT 24 FORMAT Pretty"
  "Hourly Stats:SELECT * FROM ${DB}.hourly_stats WHERE hour >= now() - INTERVAL 24 HOUR ORDER BY hour DESC LIMIT 24 FORMAT Pretty"
)

for item in "${sections[@]}"; do
  name="${item%%:*}"
  sql="${item#*:}"
  echo -e "\n=== ${name} ===" >&2
  curl -sS "${CH_HOST}/?database=${DB}&query=$(q "$sql")" "${auth[@]}"
done

