# Naming Conventions

## Files
- Kebab-case for files: `messaging-analytics-service.ts`, `security-filter.ts`.

## Classes & Types
- PascalCase for classes/types/interfaces: `RaidCoordinator`, `AnubisConfig`.

## Functions & Variables
- camelCase: `getFeatureAvailability`, `validateConfig`.

## Services
- File: `*-service.ts`; Class: `XxxService`.
- Registration name: snake_case: `sessions`, `messaging_analytics`, `database_memory`.

## Actions
- `*-action.ts` optional suffix; export `name` as kebab-case or descriptive string.

## Providers & Evaluators
- `*-provider.ts`, `*-evaluator.ts` optional suffix; exported constant name in camelCase.
