# Raids Policy (Telegram)

## Enablement
- `RAIDS_ENABLED=true` and `TELEGRAM_BOT_TOKEN` present.

## Governance
- Admins from `TELEGRAM_ADMIN_IDS` can start/stop; respect `MIN_RAID_PARTICIPANTS`.
- `AUTO_RAIDS` only with clear schedule and channel rules.

## Safety
- Link detection/verifier must run before broadcast.
- Chat locks used sparingly via `chat-lock-manager.ts`.

## Analytics
- Track starts/stops, participation, and outcomes via `raid-tracker`.
