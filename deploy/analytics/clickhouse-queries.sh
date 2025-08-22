#!/usr/bin/env bash
# moved from analytics/clickhouse-queries.sh
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

echo "Recent agent events:" >&2
curl -sS "${CH_HOST}/?database=${DB}&query=$(urlencode "SELECT timestamp, provider, model, role, tokens, latency_ms FROM ${DB}.agent_events ORDER BY timestamp DESC LIMIT 10 FORMAT Pretty")" "${auth[@]}"

echo -e "\nHourly stats (last 24h):" >&2
curl -sS "${CH_HOST}/?database=${DB}&query=$(urlencode "SELECT * FROM ${DB}.hourly_stats WHERE hour >= now() - INTERVAL 24 HOUR ORDER BY hour DESC LIMIT 24 FORMAT Pretty")" "${auth[@]}"

urlencode() { jq -rn --arg v "$1" '$v|@uri'; }

