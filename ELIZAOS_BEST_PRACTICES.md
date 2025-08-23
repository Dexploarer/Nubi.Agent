# ElizaOS Best Practices for NUBI

This document outlines how to properly utilize ElizaOS capabilities and avoid duplicating framework functionality.

## 🎯 **Core Principles**

### 1. **Use ElizaOS Native Capabilities First**
- **Database**: Use `@elizaos/plugin-sql` instead of custom database services
- **Actions**: Leverage ElizaOS action system instead of custom implementations
- **Providers**: Extend ElizaOS Provider interface, don't replace it
- **Services**: Extend ElizaOS Service class, don't duplicate functionality

### 2. **Proper Project Structure**
```
elizaos.config.js          # ElizaOS configuration
src/
├── project.ts             # Project definition
├── character/             # Character definitions
├── plugins/               # Custom plugins
├── providers/             # Context providers
├── actions/               # Custom actions
└── services/              # Business logic services
```

### 3. **Plugin Management**
- **Official Plugins**: Use `@elizaos/plugin-*` packages
- **Custom Plugins**: Only create when ElizaOS doesn't provide the functionality
- **Plugin Order**: Load core plugins first, then custom ones

## 🚫 **What NOT to Do**

### ❌ **Custom Service Manager**
```typescript
// DON'T: Create custom service management
class CustomServiceManager {
  // This duplicates ElizaOS functionality
}

// DO: Use ElizaOS service system
import { Service } from '@elizaos/core'
class MyService extends Service {
  // Extend, don't replace
}
```

### ❌ **Custom Database Layer**
```typescript
// DON'T: Implement custom database services
class CustomDatabaseService {
  // ElizaOS provides @elizaos/plugin-sql
}

// DO: Use ElizaOS database adapter
import { DatabaseAdapter } from '@elizaos/core'
```

### ❌ **Custom Action System**
```typescript
// DON'T: Build custom action handling
class CustomActionHandler {
  // ElizaOS has built-in action system
}

// DO: Use ElizaOS Action interface
import { Action } from '@elizaos/core'
export const myAction: Action = {
  name: 'MY_ACTION',
  handler: async (runtime, message) => {
    // Implementation
  }
}
```

## ✅ **What TO Do**

### 1. **Use ElizaOS Configuration**
```javascript
// elizaos.config.js
export default defineConfig({
  name: 'NUBI',
  agents: {
    nubi: {
      character: './src/character/nubi-character.ts',
      plugins: [
        '@elizaos/plugin-telegram',
        '@elizaos/plugin-openai'
      ]
    }
  }
})
```

### 2. **Extend ElizaOS Classes**
```typescript
// src/services/my-service.ts
import { Service } from '@elizaos/core'

export class MyService extends Service {
  name = 'my-service'
  
  async init() {
    // Service initialization
  }
}
```

### 3. **Implement ElizaOS Interfaces**
```typescript
// src/providers/my-provider.ts
import { Provider, ProviderResult } from '@elizaos/core'

export const myProvider: Provider = {
  name: 'my-provider',
  get: async (runtime, message, state): Promise<ProviderResult> => {
    // Provider implementation
  }
}
```

## 🔧 **Framework Capabilities to Leverage**

### 1. **Built-in Plugins**
- `@elizaos/plugin-sql` - Database operations
- `@elizaos/plugin-telegram` - Telegram integration
- `@elizaos/plugin-openai` - AI model integration
- `@elizaos/plugin-knowledge` - RAG capabilities
- `@elizaos/plugin-mcp` - External tool integration

### 2. **Core Services**
- `Service` - Base service class
- `DatabaseAdapter` - Database abstraction
- `Memory` - Memory management
- `State` - State management
- `Action` - Action system

### 3. **Lifecycle Management**
- Automatic service initialization
- Plugin dependency resolution
- Error handling and recovery
- Health monitoring

## 📚 **Migration Guide**

### From Custom Implementation to ElizaOS

1. **Identify Duplicated Functionality**
   ```bash
   # Search for custom implementations
   grep -r "class.*Service" src/
   grep -r "class.*Action" src/
   grep -r "class.*Provider" src/
   ```

2. **Replace with ElizaOS Equivalents**
   - Custom database service → `@elizaos/plugin-sql`
   - Custom action handler → ElizaOS Action interface
   - Custom service manager → ElizaOS service system

3. **Update Configuration**
   - Move configuration to `elizaos.config.js`
   - Use ElizaOS CLI commands
   - Leverage framework lifecycle management

## 🧪 **Testing Best Practices**

### 1. **Use ElizaOS Test Utilities**
```typescript
import { createMockRuntime } from '@elizaos/core/testing'

const mockRuntime = createMockRuntime()
```

### 2. **Test Plugin Integration**
```typescript
// Test that plugins work with ElizaOS
describe('Plugin Integration', () => {
  it('should register with ElizaOS', async () => {
    // Test plugin registration
  })
})
```

## 🚀 **Performance Optimization**

### 1. **Plugin Lazy Loading**
```typescript
// Only load plugins when needed
plugins: [
  '@elizaos/plugin-sql',
  process.env.TELEGRAM_ENABLED && '@elizaos/plugin-telegram'
].filter(Boolean)
```

### 2. **Service Optimization**
```typescript
// Use ElizaOS service lifecycle
class OptimizedService extends Service {
  async init() {
    // Initialize resources
  }
  
  async cleanup() {
    // Clean up resources
  }
}
```

## 📖 **Resources**

- [ElizaOS Core Concepts](https://docs.elizaos.ai/core-concepts)
- [ElizaOS Agents](https://docs.elizaos.ai/core-concepts/agents)
- [ElizaOS Plugins](https://docs.elizaos.ai/core-concepts/plugins)
- [ElizaOS Projects](https://docs.elizaos.ai/core-concepts/projects)

## 🔍 **Code Review Checklist**

- [ ] Uses ElizaOS native capabilities where possible
- [ ] Extends framework classes instead of duplicating
- [ ] Configuration is in `elizaos.config.js`
- [ ] Plugins follow ElizaOS patterns
- [ ] Services extend ElizaOS Service class
- [ ] Actions implement ElizaOS Action interface
- [ ] Providers implement ElizaOS Provider interface
- [ ] No custom service management
- [ ] No custom database abstraction
- [ ] No custom action system