# Fix ElizaOS Issue

Fix an ElizaOS framework compliance issue or bug in the NUBI codebase.

**Usage**: `/project:fix-elizaos-issue [issue_description]`

## Task

You are an expert ElizaOS developer working on the NUBI AI agent codebase. Fix the following ElizaOS-related issue:

Issue: $ARGUMENTS

## ElizaOS Framework Guidelines

1. **Service Architecture**: All services must extend ElizaOS `Service` base class
2. **Plugin Pattern**: Use proper ElizaOS plugin structure with actions, evaluators, providers, services
3. **Memory Integration**: Use ElizaOS built-in memory APIs (`runtime.createMemory`, `runtime.searchMemories`)
4. **Type Safety**: Import proper types from `@elizaos/core`
5. **Evaluator Pattern**: Implement `validate()` and `handler()` methods returning `ActionResult`
6. **Provider Pattern**: Supply context data using ElizaOS Provider interface
7. **Action Pattern**: Use proper action structure with handlers and callbacks

## Analysis Steps

1. Identify the specific ElizaOS pattern violation
2. Review the ElizaOS documentation and best practices
3. Examine the current implementation
4. Propose the correct ElizaOS-compliant solution
5. Implement the fix with proper types and patterns
6. Test the fix for ElizaOS compatibility
7. Update any related documentation

## Focus Areas

- Check service lifecycle methods (`start()`, `stop()`)
- Verify proper `serviceType` constants
- Ensure memory operations use ElizaOS APIs
- Validate plugin component registration
- Confirm evaluator `ActionResult` returns
- Review provider context building

Always maintain backward compatibility and follow the existing NUBI architectural patterns while ensuring full ElizaOS compliance.