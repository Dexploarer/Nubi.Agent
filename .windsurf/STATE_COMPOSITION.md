# State Composition & Providers

## Compose Flow
- Call `runtime.composeState(memory)` before action/evaluator logic.
- Limit provider set to what's needed for the current path.

## Provider Contract
- `get(runtime, message, state) => { text?, values?, data? }`.
- `dynamic: true` for per-request providers.
- Keep outputs minimal and bounded; `values` for flags, `data` for arrays.

## Example Reference
- See `src/providers.ts` for `nubiContextProvider` using recent memories and lightweight NLP flags.
- Use `runtime.getMemories({ roomId, ... })` with `count` bounds and `unique` when appropriate.

## Enhanced Context
- If a database memory service is present, attach enriched fields (e.g., `nubiContext.memoryInsights`) to `state` sparingly.

## Caching
- Cache static or slow-moving provider data within the provider module; document TTLs.
