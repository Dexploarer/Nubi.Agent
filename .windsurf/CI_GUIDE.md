# CI Guide

## Required Checks
- Run `bun run check-all` (type-check, format:check, tests).
- Cache Bun and Vite build artifacts if applicable.

## Secrets
- Provide OPENAI_API_KEY and platform keys via CI secret store if needed for integration tests; otherwise mock and skip network.

## Artifacts
- Upload coverage reports; keep thresholds in tests.

## Pull Request Policy
- Block merge on failed checks, format diffs, or type errors.
