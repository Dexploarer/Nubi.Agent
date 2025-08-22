# Deployment Guide

## Environments
- Development: `bun run dev` (can use PGLite/local services).
- Production: `bun run start:production` with proper `.env`.

## Config
- Validate env via `src/config/environment.ts` on boot (required `OPENAI_API_KEY`).
- Keep `.env.example` in sync; rotate keys on incident.

## Observability
- Enable debug temporarily to diagnose; keep `LOG_LEVEL` conservative.
