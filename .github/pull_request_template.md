# PR Template

## Summary
- What changed and why?

## Changes
- Key modules touched (actions/providers/evaluators/services/routes)

## Tests
- New/updated unit/integration tests

## Security / Performance
- Implications? Budgets respected? Secrets safe?

## Docs
- Updated `.env.example` / `.windsurf` docs if needed

---
Checklist:
- [ ] `bun run check-all` passes (type-check, format:check, tests)
- [ ] No secrets in logs or code changes
- [ ] Routes validated and error codes stable
- [ ] Performance budgets respected
- [ ] Updated relevant guides in `.windsurf/`
