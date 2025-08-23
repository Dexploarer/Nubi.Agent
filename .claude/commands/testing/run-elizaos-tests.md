# Run ElizaOS Compliance Tests

Run comprehensive ElizaOS framework compliance tests for the NUBI system.

**Usage**: `/project:run-elizaos-tests [component_type]`

## Task

Run ElizaOS compliance tests for the specified component:

Component: $ARGUMENTS (default: all)

## Test Categories

### Service Tests
```bash
# Test all services
bun test src/__tests__/services.test.ts

# Test specific service patterns
bun test src/__tests__/services.test.ts -t "DatabaseMemoryService"
bun test src/__tests__/services.test.ts -t "CommunityManagementService"
```

### Plugin Tests
```bash
# Test plugin structure and compliance
bun test src/__tests__/plugin-structure.test.ts

# Test plugin integration
bun test src/__tests__/integration.test.ts
```

### Evaluator Tests
```bash
# Test evaluator implementations
bun test src/__tests__/actions.test.ts -t "evaluator"

# Test raid success evaluator
bun test src/__tests__/raid-success-evaluator.test.ts
```

### Provider Tests
```bash
# Test provider implementations  
bun test src/__tests__/provider.test.ts

# Test enhanced context provider
bun test src/__tests__/enhanced-context-provider.test.ts
```

### Integration Tests
```bash
# Full system integration tests
bun test src/__tests__/integration.test.ts

# ElizaOS compliance validation
bun run validate:integrations
```

## ElizaOS Compliance Checks

1. **Service Architecture**
   - ✅ Services extend Service base class
   - ✅ Proper serviceType constants
   - ✅ Constructor with runtime injection
   - ✅ Async start/stop methods

2. **Plugin Structure**
   - ✅ Plugin interface implementation
   - ✅ Component registration (actions, evaluators, providers, services)
   - ✅ Proper initialization lifecycle

3. **Memory Integration**
   - ✅ ElizaOS memory API usage
   - ✅ Semantic search implementation
   - ✅ Proper Memory interface compliance

4. **Evaluator Patterns**
   - ✅ Validate and handler methods
   - ✅ ActionResult return format
   - ✅ Error handling patterns

5. **Provider Integration**
   - ✅ Provider interface compliance
   - ✅ Context data supply patterns
   - ✅ Dynamic data retrieval

## Test Execution Strategy

```bash
# Quick compliance check
bun run type-check && bun test src/__tests__/plugin-structure.test.ts

# Full ElizaOS test suite
bun test src/__tests__/services.test.ts src/__tests__/plugin-structure.test.ts src/__tests__/provider.test.ts src/__tests__/integration.test.ts

# Performance and integration
bun test src/__tests__/integration.test.ts src/__tests__/validate-integrations.test.ts
```

## Success Criteria

- ✅ All service lifecycle tests pass
- ✅ Plugin component registration validated
- ✅ Memory operations comply with ElizaOS patterns
- ✅ Evaluators return proper ActionResult
- ✅ Providers supply expected context data
- ✅ Integration tests demonstrate system coherence

Focus on maintaining ElizaOS framework compliance while preserving NUBI's advanced functionality.