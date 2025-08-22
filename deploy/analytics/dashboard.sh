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
  "Agent Events:SELECT timestamp, provider, model, role, tokens, cost, latency_ms FROM ${DB}.agent_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Edge Functions:SELECT timestamp, function, duration_ms, cold_start, error FROM ${DB}.edge_function_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Socket Events:SELECT timestamp, event, namespace, latency_ms, error FROM ${DB}.socket_events ORDER BY timestamp DESC LIMIT 50 FORMAT Pretty"
  "Hourly Stats:SELECT * FROM ${DB}.hourly_stats WHERE hour >= now() - INTERVAL 24 HOUR ORDER BY hour DESC LIMIT 24 FORMAT Pretty"
)

for item in "${sections[@]}"; do
  name="${item%%:*}"
  sql="${item#*:}"
  echo -e "\n=== ${name} ===" >&2
  curl -sS "${CH_HOST}/?database=${DB}&query=$(q "$sql")" "${auth[@]}"
done

