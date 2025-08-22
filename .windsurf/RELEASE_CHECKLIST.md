# Release Checklist

- [ ] Bump version in `package.json` (semver).
- [ ] `bun run check-all` green (types, format, tests).
- [ ] Update `.env.example` and `.windsurf/ENV_VARS.md` if env changes.
- [ ] Update CHANGELOG/README for user-facing changes.
- [ ] Smoke-test Sessions API endpoints.
- [ ] Validate platform tokens still working (Telegram/Discord if enabled).
- [ ] Tag and publish; attach docs and assets if distributing a plugin.
