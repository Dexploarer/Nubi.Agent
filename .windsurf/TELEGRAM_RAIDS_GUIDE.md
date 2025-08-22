# Telegram Raids Guide

Subsystem located in `src/telegram-raids/`:
- `raid-coordinator.ts`, `raid-flow.ts`, `user-initiated-raid-flow.ts`
- `raid-moderation-service.ts`, `engagement-verifier.ts`, `chat-lock-manager.ts`
- `leaderboard-service.ts`, `raid-tracker.ts`, `link-detection-service.ts`
- `elizaos-enhanced-telegram-raids.ts`, `anubis-raid-plugin.ts`

## Prerequisites
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_ADMIN_IDS`.
- Enable: `RAIDS_ENABLED=true`. Optional scheduling: `AUTO_RAIDS=true`.
- Tuning: `RAID_INTERVAL_HOURS`, `MAX_CONCURRENT_RAIDS`, `RAID_DURATION_MINUTES`, `MIN_RAID_PARTICIPANTS` (validated in `src/config/environment.ts`).

## Safety & Moderation
- Use `link-detection-service` to guard against malicious links.
- `chat-lock-manager` can enforce temporary locks during high-signal phases.
- Admins from `TELEGRAM_ADMIN_IDS` may override/stop raids.

## Flow
- Coordinator orchestrates start/stop and participant thresholds.
- `engagement-verifier` validates real participation; `leaderboard-service` tracks scores.
- `raid-tracker` records lifecycle events for analytics.

## Best Practices
- Keep all Telegram API calls inside services; actions invoke services only.
- Respect platform rate limits; implement retries/backoff.
- Log minimal metadata; avoid PII; aggregate for analytics.
