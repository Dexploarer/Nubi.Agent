# Create ElizaOS Evaluator

Create a new ElizaOS-compliant evaluator for the NUBI system.

**Usage**: `/project:create-evaluator [evaluator_name] [description]`

## Task

Create a new ElizaOS evaluator with proper patterns:

Evaluator: $ARGUMENTS

## ElizaOS Evaluator Pattern

```typescript
import {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
  ActionResult,
  HandlerCallback,
  logger,
} from "@elizaos/core";

export const ${EVALUATOR_NAME}Evaluator: Evaluator = {
  name: "${EVALUATOR_NAME_UPPER}",
  description: "${DESCRIPTION}",
  examples: [], // Required field for ElizaOS Evaluator

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Validation logic - return true if this evaluator should process
    const content = typeof message.content === "string"
      ? message.content
      : message.content?.text || "";
    
    // Add your validation logic here
    return true; // or your condition
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      // Get required services
      const memoryService = runtime.getService("database_memory");
      
      if (!memoryService) {
        logger.warn("[${EVALUATOR_NAME_UPPER}] Memory service not available");
        return {
          success: false,
          error: new Error("Memory service unavailable"),
        };
      }

      // Evaluator processing logic
      const content = typeof message.content === "string"
        ? message.content
        : message.content?.text || "";

      // Process the message/state
      
      logger.info(`[${EVALUATOR_NAME_UPPER}] Processed successfully`);

      return {
        success: true,
        text: "Processing completed",
        values: {
          // Add result values
        },
      };
    } catch (error) {
      logger.error(
        "[${EVALUATOR_NAME_UPPER}] Error:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
};

export default ${EVALUATOR_NAME}Evaluator;
```

## Implementation Steps

1. **Create Evaluator File**: `src/evaluators/${evaluator-name}-evaluator.ts`
2. **Add to Evaluator Index**: Update `src/evaluators/index.ts`
3. **Register in Plugin**: Add to `src/plugins/nubi-plugin.ts` evaluators array
4. **Create Tests**: Add test file in `src/__tests__/`
5. **Update Documentation**: Add evaluator description to CLAUDE.md

## Evaluator Guidelines

- **validate()**: Return boolean for whether to process
- **handler()**: Return proper ActionResult structure
- **Error Handling**: Use try/catch with proper error returns
- **Service Access**: Use `runtime.getService()` for dependencies
- **Logging**: Use ElizaOS logger with consistent prefixes
- **State Management**: Handle state and memory parameters properly

## Validation

- ✅ Implements ElizaOS Evaluator interface
- ✅ Proper validate() method
- ✅ ActionResult return type
- ✅ Error handling and logging
- ✅ Service dependency management
- ✅ TypeScript compliance