# Create ElizaOS Service

Create a new ElizaOS-compliant service for the NUBI system.

**Usage**: `/project:create-service [service_name] [description]`

## Task

Create a new ElizaOS service with proper patterns and integration:

Service: $ARGUMENTS

## ElizaOS Service Pattern

```typescript
import {
  Service,
  IAgentRuntime,
  logger,
} from "@elizaos/core";

export class ${SERVICE_NAME}Service extends Service {
  static serviceType = "${SERVICE_TYPE}" as const;
  capabilityDescription = "${DESCRIPTION}";

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<${SERVICE_NAME}Service> {
    const service = new ${SERVICE_NAME}Service(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize service resources
      logger.info(`[${SERVICE_NAME}_SERVICE] Initializing service...`);
      
      // Service-specific initialization
      
      logger.info(`[${SERVICE_NAME}_SERVICE] Service initialized successfully`);
    } catch (error) {
      logger.error(
        `[${SERVICE_NAME}_SERVICE] Failed to initialize:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Cleanup service resources
    logger.info(`[${SERVICE_NAME}_SERVICE] Service stopped`);
  }
}

export default ${SERVICE_NAME}Service;
```

## Implementation Steps

1. **Create Service File**: `src/services/${service-name}-service.ts`
2. **Add to Service Index**: Update `src/services/index.ts`
3. **Register in Plugin**: Add to `src/plugins/nubi-plugin.ts` services array
4. **Create Tests**: Add test file in `src/__tests__/`
5. **Update Documentation**: Add service description to CLAUDE.md

## Service Integration

- Export from services index
- Register in plugin services array
- Follow dependency order in plugin
- Use proper ElizaOS logger
- Implement graceful error handling
- Add comprehensive TypeScript types

## Validation

- ✅ Extends ElizaOS Service base class
- ✅ Proper serviceType constant
- ✅ Constructor with runtime injection
- ✅ Async start/stop methods
- ✅ Error handling and logging
- ✅ TypeScript compliance