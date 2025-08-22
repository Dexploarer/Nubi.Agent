# Refactoring Plan for Commented/Disabled Components

## Overview
Several components were disabled due to type mismatches with ElizaOS core. This document outlines the refactoring needed to properly integrate them.

## 1. Core Issues Identified

### A. Service Architecture Issues
- **Problem**: `SupabaseServiceManager` doesn't match ElizaOS `Service` class
- **ElizaOS Expects**: Services extending `Service` class with `stop()` method and `capabilityDescription`
- **Current Implementation**: Custom service manager with different interface

### B. Action Callback Issues  
- **Problem**: Callback signature mismatch
- **ElizaOS Expects**: `HandlerCallback = (response: Content, files?: any) => Promise<Memory[]>`
- **Current Implementation**: Using `(success: boolean, message: string)` pattern

### C. Memory Interface Issues
- **Problem**: Adding custom properties to `Memory` interface
- **ElizaOS Expects**: Standard Memory interface without `userId` property
- **Current Implementation**: Trying to access `message.userId`

### D. Repository Pattern Issues
- **Problem**: Drizzle ORM query builder incompatibilities
- **Current Implementation**: Missing proper type casting for query results

## 2. Refactoring Solutions

### A. Service Refactoring

Create proper ElizaOS-compatible services:

```typescript
// src/services/elizaos-compatible-service.ts
import { Service, IAgentRuntime } from '@elizaos/core';

export class NubiRaidService extends Service {
    static serviceType = 'raid-manager';
    capabilityDescription = 'Manages Twitter raid campaigns';
    
    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }
    
    async stop(): Promise<void> {
        // Cleanup logic
    }
}
```

### B. Action Refactoring

Fix action handlers to match ElizaOS signature:

```typescript
// src/actions/refactored-ritual-action.ts
import { Action, ActionResult, HandlerCallback, Content } from '@elizaos/core';

export const ritualAction: Action = {
    name: 'NUBI_RITUAL',
    description: 'Start ritual workflow',
    handler: async (runtime, message, state, options, callback) => {
        // Create proper ActionResult
        const result: ActionResult = {
            success: true,
            text: 'Ritual started',
            data: { ritualId: 'xyz' }
        };
        
        // Use callback properly
        if (callback) {
            const memories = await callback(result.text as Content);
            return result;
        }
        
        return result;
    }
};
```

### C. Memory Extension Pattern

Use composition instead of extending Memory:

```typescript
// src/types/extended-types.ts
interface SessionData {
    memory: Memory;
    userId?: string;
    sessionId?: string;
}

// Use like:
const sessionData: SessionData = {
    memory: message,
    userId: (message as any).userId || generateUUID()
};
```

### D. Repository Refactoring

Fix Drizzle ORM usage:

```typescript
// src/repositories/refactored-sessions-repository.ts
export class SessionsRepository {
    async findSessions(agentId: string) {
        let query = db.select().from(sessions);
        
        if (agentId) {
            // Fix: Use proper Drizzle syntax
            query = query.where(eq(sessions.agent_id, agentId)) as any;
        }
        
        return await query;
    }
}
```

## 3. Implementation Steps

### Step 1: Create Type Adapters
```typescript
// src/adapters/type-adapters.ts
export function adaptToElizaOSCallback(
    customCallback: (success: boolean, message: string) => void
): HandlerCallback {
    return async (response: Content) => {
        customCallback(true, response as string);
        return [];
    };
}
```

### Step 2: Service Factory Pattern
```typescript
// src/services/service-factory.ts
export class ServiceFactory {
    static createElizaOSService(
        type: string,
        handler: () => Promise<void>
    ): Service {
        return new (class extends Service {
            static serviceType = type;
            capabilityDescription = `Service: ${type}`;
            async stop() { await handler(); }
        })();
    }
}
```

### Step 3: Memory Wrapper
```typescript
// src/utils/memory-utils.ts
export class MemoryWrapper {
    constructor(private memory: Memory) {}
    
    getUserId(): string {
        return (this.memory as any).userId || 
               this.memory.userId || 
               'anonymous';
    }
}
```

## 4. Files to Regenerate

### Priority 1 (Core Functionality)
1. `nubi-raid-system.ts` → `elizaos-raid-service.ts`
2. `ritual-record-actions.ts` → `elizaos-ritual-action.ts`

### Priority 2 (Infrastructure)
3. `supabase-service-manager.ts` → `elizaos-service-adapter.ts`
4. `service-definitions.ts` → `elizaos-service-registry.ts`

### Priority 3 (Data Layer)
5. `nubi-sessions-repository.ts` → `sessions-repository-v2.ts`
6. `cross-platform-identity-repository.ts` → `identity-repository-v2.ts`

## 5. Testing Strategy

```typescript
// src/__tests__/refactored-components.test.ts
import { describe, it, expect } from 'bun:test';

describe('Refactored Components', () => {
    it('should match ElizaOS Service interface', () => {
        const service = new NubiRaidService(runtime);
        expect(service.stop).toBeDefined();
        expect(service.capabilityDescription).toBeDefined();
    });
    
    it('should return proper ActionResult', async () => {
        const result = await ritualAction.handler(/*...*/);
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true);
    });
});
```

## 6. Migration Path

1. **Phase 1**: Create adapters for existing code
2. **Phase 2**: Gradually refactor each component
3. **Phase 3**: Remove old implementations
4. **Phase 4**: Update tests

## 7. Type Safety Checklist

- [ ] All Services extend ElizaOS `Service` class
- [ ] All Actions return `ActionResult`
- [ ] Callbacks match `HandlerCallback` signature
- [ ] No direct Memory interface extensions
- [ ] Repository queries properly typed
- [ ] All imports from '@elizaos/core' verified

