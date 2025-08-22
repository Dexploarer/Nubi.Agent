# Platforms Guide (Telegram, Discord, Twitter)

## Telegram
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_ADMIN_IDS`.
- Raids require `RAIDS_ENABLED=true` and a valid token. See `TELEGRAM_RAIDS_GUIDE.md`.
- Encapsulate Telegram I/O in services or the raids subsystem; actions call services.

## Discord
- Env: `DISCORD_API_TOKEN`, `DISCORD_APPLICATION_ID`.
- Configure intents and channel allowlists; centralize in a Discord service.

## Twitter / X (Monitoring-first)
- Env: `TWITTER_API_KEY`, `TWITTER_API_SECRET_KEY`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `TWITTER_USERNAME`.
- Feature flags in `.env.example` default to read-only.

## Cross-Platform Identity
- Use `src/services/cross-platform-identity-service.ts` to link identities; respect privacy and avoid leaking identifiers across platforms unless opted in.

## Moderation & Safety
- Use `security-filter` service and link detection before posting or rendering untrusted content.
