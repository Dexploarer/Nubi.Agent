#!/bin/bash

# Files to fix
files=(
  "src/telegram-raids/raid-coordinator.ts"
  "src/core/supabase-service-manager.ts"
  "src/providers/session-context-provider.ts"
  "src/routes/sessions-routes.ts"
  "src/services/raid-session-manager.ts"
  "src/services/socket-io-sessions-service.ts"
  "src/services/streaming-sessions-service.ts"
  "src/plugins/clickhouse-analytics.ts"
  "src/plugins/nubi-plugin.ts"
  "src/plugins/sessions-plugin.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Replace logger.error calls with proper error handling
    sed -i 's/logger\.error(\(.*\), error);/logger.error(\1, error instanceof Error ? error.message : String(error));/g' "$file"
    sed -i 's/logger\.error(\(.*\), error as any);/logger.error(\1, error instanceof Error ? error.message : String(error));/g' "$file"
    echo "Fixed: $file"
  fi
done
