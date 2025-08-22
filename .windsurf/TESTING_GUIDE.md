# Testing Guide

## Commands
- Unit/Integration: `bun run test`
- Watch: `bun run test:watch`
- Coverage: `bun run test:coverage`
- All checks: `bun run check-all`

## Scope
- Unit: actions, providers, evaluators, services (pure parts) with mocks.
- Integration: message flow, sessions routes, service wiring.

## Patterns
- Mock `IAgentRuntime`, services with simple stubs.
- Avoid real network calls; use fake timers for timeouts/renew/heartbeat.
- Seed random sampling in evaluators for determinism when needed.

## Sessions API Tests (`src/routes/sessions-routes.ts`)
- Create: POST /api/sessions/create (validate 5<=timeout<=1440).
- Message: POST /api/sessions/:id/message (requires senderId, senderType in ['user','agent'], content).
- History: GET /api/sessions/:id/history (limit<=100).
- Renew: PUT /api/sessions/:id/renew (5..1440).
- Heartbeat: POST /api/sessions/:id/heartbeat.
- Delete: DELETE /api/sessions/:id.
- List: GET /api/sessions (status in ['active','expired','ended']).
- Analytics: GET /api/sessions/analytics (days<=30).

## Fixtures
- Minimal message memory object as used in sessions message handler.
- Provider outputs (`text`,`values`,`data`) samples for composeState.

## Coverage Goals
- Critical paths >= 80% lines/branches; Security evaluator and Sessions routes at 100% for edge checks.
