# Code Review Checklist (ElizaOS)

Use this for every PR that changes agents, plugins, services, routes, or templates.

- [ ] Structure: new code in correct dir (`src/actions|providers|evaluators|services|routes|config`)
- [ ] Registration: component added to `src/nubi-plugin.ts` (actions via `withActionMiddleware`, evaluators order preserved, providers/services wired)
- [ ] Security: security evaluator first; inputs validated; no secrets in logs; outbound calls whitelisted
- [ ] State: `composeState` used appropriately; providers scoped and efficient; memory queries bounded
- [ ] Performance: see budgets; model choice cost-aware; no unnecessary LLM calls
- [ ] Tests: unit + integration updated; mocks for external deps; deterministic where feasible
- [ ] Tooling: `bun run check-all` passes (tsc, prettier, tests)
- [ ] Docs: `.env.example` updated; user-facing behavior documented; rules not violated
- [ ] Routes: `/health` unchanged (no secrets); Sessions API mounted if relevant
- [ ] Services: side effects isolated; retries/backoff; not blocking message flow
- [ ] Events: minimal logic; defer to services
- [ ] Templates: changes documented with impact and tests
