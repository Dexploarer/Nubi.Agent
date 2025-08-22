# Style Guide (TypeScript + ElizaOS)

## Imports & Exports
- Imports at the top; no mid-file imports.
- Default export only for `src/nubi-plugin.ts` (re-exported by `src/plugin.ts`). Prefer named exports elsewhere.

## Files & Layout
- One top-level construct per file (Action/Provider/Service/etc).
- Keep files focused; extract helpers to `src/utils/` if reused.

## TypeScript
- Strict types; no `any` unless unavoidable (document why).
- Narrow types early; validate external data with Zod where appropriate.

## Logging
- Use `logger` from `@elizaos/core`; no `console.*`.
- Never log secrets; prefer structured logs.

## Error Handling
- Throw `Error` with clear messages; catch at boundaries (routes/services).
- Map to stable error codes in routes (e.g., `SESSION_NOT_FOUND`).

## Comments & Docs
- JSDoc for public functions/services.
- Link to relevant `.windsurf/*.md` section when non-obvious.

## Tests
- Each new module has unit tests; complex flows have integration tests.
