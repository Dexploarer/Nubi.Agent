# 🏗️ NUBI Modular Architecture

## Overview

The NUBI application has been restructured into a modular architecture with proper type safety, eliminating overlaps and providing clean separation of concerns. This document outlines the new structure and how to use it.

## 📁 Module Structure

```
src/
├── core/                    # Core types and utilities
│   └── index.ts            # Central exports for all core functionality
├── identity/               # User identity management
│   └── index.ts            # Identity types and services
├── messaging/              # Message handling and transport
│   └── index.ts            # Messaging types and services
├── character/              # NUBI character definition
│   └── index.ts            # Character types and configuration
├── services/               # Core service implementations
│   └── index.ts            # Service types and implementations
├── plugins/                # Plugin system and implementations
│   └── index.ts            # Plugin types and management
├── orchestration/          # Strategic action orchestration
│   └── index.ts            # Orchestration types and services
├── app/                    # Main application coordination
│   └── index.ts            # Application lifecycle and coordination
└── index.ts                # Main entry point
```

## 🎯 Module Responsibilities

### Core Module (`src/core/`)
- **Purpose**: Central exports for all core functionality
- **Exports**: ElizaOS types, base entities, error types, utility types
- **Usage**: Imported by all other modules for type safety

### Identity Module (`src/identity/`)
- **Purpose**: User identity management and cross-platform linking
- **Exports**: UserIdentity, IdentityLink, UserProfile, Platform types
- **Services**: UserIdentityService, CrossPlatformIdentityService

### Messaging Module (`src/messaging/`)
- **Purpose**: Message handling and transport management
- **Exports**: Message, Transport, MessageBus types
- **Services**: MessageBusService, transport implementations

### Character Module (`src/character/`)
- **Purpose**: NUBI character definition and personality management
- **Exports**: CharacterConfig, CharacterTraits, template types
- **Components**: nubiCharacter, nubiTemplates

### Services Module (`src/services/`)
- **Purpose**: Core service implementations
- **Exports**: ServiceManager, MemoryService, CommunityService
- **Services**: DatabaseMemoryService, CommunityMemoryService, etc.

### Plugins Module (`src/plugins/`)
- **Purpose**: Plugin system and implementations
- **Exports**: PluginManager, ActionConfig, EvaluatorConfig
- **Plugins**: nubiPlugin, clickhouseAnalyticsPlugin

### Orchestration Module (`src/orchestration/`)
- **Purpose**: Strategic action orchestration and flow management
- **Exports**: OrchestrationManager, ActionFlow, StrategicContext
- **Services**: StrategicActionOrchestrator, PluginConfigurationManager

### App Module (`src/app/`)
- **Purpose**: Main application coordination and lifecycle
- **Exports**: NubiApplication, AppLifecycle, AppConfig
- **Features**: Application lifecycle management, status monitoring

## 🔧 Type Safety Features

### 1. Strict TypeScript Configuration
```typescript
// All modules use strict TypeScript
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true
```

### 2. Proper Type Definitions
```typescript
// Example: Identity types
export interface UserIdentity {
  id: string;
  internalId: string;
  platform: string;
  platformId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSeen: Date;
}
```

### 3. Type Guards and Validation
```typescript
// Example: Validation functions
export function validateIdentity(identity: UserIdentity): boolean {
  return !!(
    identity.id &&
    identity.internalId &&
    identity.platform &&
    identity.platformId &&
    identity.username
  );
}
```

## 🚀 Usage Examples

### Creating a New Service
```typescript
import { Service, IAgentRuntime, logger } from '../core';

export class MyService extends Service {
  static serviceType = "my-service" as const;
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }
  
  async start(): Promise<void> {
    logger.info("MyService started");
  }
  
  async stop(): Promise<void> {
    logger.info("MyService stopped");
  }
}
```

### Using the Application
```typescript
import { createNubiApplication, createAppConfig } from './app';

const config = createAppConfig('NUBI', '1.0.0', 'development');
const app = createNubiApplication(config);

await app.initialize();
await app.start();

const status = app.getStatus();
console.log('App status:', status);
```

### Working with Identity
```typescript
import { createUserIdentity, validateIdentity, Platform } from './identity';

const identity = createUserIdentity(
  Platform.DISCORD,
  '123456789',
  'username',
  { avatar: 'https://example.com/avatar.png' }
);

if (validateIdentity(identity)) {
  // Use the identity
}
```

### Managing Plugins
```typescript
import { createPluginManager, validatePlugin } from './plugins';

const pluginManager = createPluginManager();
pluginManager.register(myPlugin);

if (validatePlugin(myPlugin)) {
  pluginManager.enable(myPlugin.name);
}
```

## 🔄 Migration Benefits

### 1. Eliminated Overlaps
- **Before**: Multiple files with similar functionality
- **After**: Clear module boundaries with specific responsibilities

### 2. Improved Type Safety
- **Before**: Mixed `any` types and loose typing
- **After**: Strict TypeScript with proper interfaces

### 3. Better Organization
- **Before**: Flat structure with scattered files
- **After**: Logical grouping with clear dependencies

### 4. Enhanced Maintainability
- **Before**: Hard to find and modify related code
- **After**: Clear module structure with focused responsibilities

## 📋 Module Dependencies

```
app/
├── core (all modules)
├── identity
├── messaging
├── character
├── services
├── plugins
└── orchestration

services/
├── core
├── identity
└── messaging

plugins/
├── core
├── services
└── orchestration

orchestration/
├── core
├── services
└── plugins
```

## 🛠️ Development Guidelines

### 1. Module Creation
- Create a new directory under `src/`
- Include an `index.ts` with proper exports
- Define clear interfaces and types
- Add validation functions

### 2. Type Safety
- Use strict TypeScript configuration
- Define proper interfaces for all data structures
- Include validation functions
- Avoid `any` types

### 3. Import/Export Patterns
```typescript
// Good: Re-export core types
export type { IAgentRuntime, Service, Memory, logger } from '../core';

// Good: Export specific types
export interface MyType {
  // ...
}

// Good: Export utility functions
export function createMyType(): MyType {
  // ...
}
```

### 4. Service Implementation
```typescript
import { Service, IAgentRuntime, logger } from '../core';

export class MyService extends Service {
  static serviceType = "my-service" as const;
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }
  
  // Implement required methods
}
```

## 🔍 Testing

### Module Testing
```typescript
import { createUserIdentity, validateIdentity } from '../identity';

describe('Identity Module', () => {
  it('should create valid user identity', () => {
    const identity = createUserIdentity('discord', '123', 'user');
    expect(validateIdentity(identity)).toBe(true);
  });
});
```

### Integration Testing
```typescript
import { createNubiApplication, createAppConfig } from '../app';

describe('Application Integration', () => {
  it('should initialize and start successfully', async () => {
    const config = createAppConfig();
    const app = createNubiApplication(config);
    
    await expect(app.initialize()).resolves.not.toThrow();
    await expect(app.start()).resolves.not.toThrow();
    
    const status = app.getStatus();
    expect(status.status).toBe('running');
  });
});
```

## 📊 Performance Benefits

### 1. Reduced Bundle Size
- Tree-shaking friendly exports
- Clear dependency boundaries
- Minimal circular dependencies

### 2. Better Caching
- Module-level caching
- Isolated state management
- Efficient memory usage

### 3. Improved Loading
- Lazy loading support
- Parallel module initialization
- Optimized import paths

## 🔮 Future Enhancements

### 1. Module Hot Reloading
- Individual module reloading
- State preservation during reloads
- Development workflow improvements

### 2. Advanced Type Safety
- Runtime type checking
- Schema validation
- Type inference improvements

### 3. Plugin System Enhancements
- Dynamic plugin loading
- Plugin marketplace
- Version compatibility management

---

**The modular architecture provides a solid foundation for scalable, maintainable, and type-safe development.**
