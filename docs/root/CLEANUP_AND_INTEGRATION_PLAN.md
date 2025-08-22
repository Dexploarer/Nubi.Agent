# Cleanup and Integration Plan

## Issues Found

### 1. Duplicate Files
- `telegram-raids-integration.ts` and `telegram-raids-integration-fixed.ts`
- `socket-io-events-service.ts` and `socket-io-events-service-fixed.ts`
- `verify-full-integration.ts` and `verify-full-integration-fixed.ts`
- Multiple raid-related services scattered across directories

### 2. Scattered Functionality
- Telegram raids code in multiple locations:
  - `/src/services/telegram-raids-*`
  - `/src/telegram-raids/*`
  - `/src/services/EnhancedTelegramRaidsService.ts` (referenced but missing)
  
### 3. Technical Debt
- Multiple test files without implementation
- Unused imports and references
- Inconsistent service initialization
- Missing dependency injection

### 4. Architecture Issues
- Services not properly registered
- No central service manager
- Missing error boundaries
- Incomplete API integration

## Cleanup Actions

1. **Remove duplicate files** (-fixed versions)
2. **Consolidate raid services** into single location
3. **Create central service registry**
4. **Implement proper DI container**
5. **Add comprehensive error handling**
6. **Unify configuration management**
7. **Create integration tests**

## Target Architecture

```
/root/dex/
├── src/
│   ├── core/
│   │   ├── service-registry.ts     # Central service management
│   │   ├── dependency-injection.ts # DI container
│   │   └── error-boundaries.ts     # Error handling
│   ├── services/
│   │   ├── telegram/
│   │   │   ├── raids.service.ts    # Consolidated raids service
│   │   │   └── index.ts
│   │   ├── twitter/
│   │   │   ├── engagement.service.ts
│   │   │   └── mcp-client.service.ts
│   │   └── analytics/
│   │       ├── database.service.ts
│   │       └── metrics.service.ts
│   └── api/
│       └── routes/
└── tests/
    └── integration/
```
