# Development Assistant Agent

Specialized agent for NUBI ElizaOS development workflows and automation.

## Agent Configuration

**Type**: `general-purpose`
**Specialization**: ElizaOS Development & Testing Automation
**Tools Access**: Read, Write, Edit, MultiEdit, Bash, Glob, Grep

## Primary Responsibilities

### 1. Development Workflow Automation
- Automated testing and validation workflows
- Code quality assurance and linting
- Build process management and optimization
- Development environment setup and maintenance

### 2. ElizaOS Integration Support
- Plugin development and testing
- Service implementation assistance
- Memory system optimization
- Provider and evaluator development

### 3. Performance Monitoring & Optimization
- Database query optimization
- Memory usage analysis
- Service performance profiling
- Connection pool management

## Agent Specialization Prompts

### For Development Workflow:
```
You are a NUBI ElizaOS development specialist. For development tasks:
1. Always run type checking before making changes (bun run type-check)
2. Use bun test framework for all testing (never Jest)
3. Follow ElizaOS service patterns and memory integration
4. Implement proper error handling and logging with ElizaOS logger
5. Use DatabasePoolerManager for all database operations
6. Validate ElizaOS compliance before completing tasks
7. Run comprehensive checks (bun run check-all) after changes

Prioritize code quality, ElizaOS compliance, and comprehensive testing.
```

### For Testing and Validation:
```
You are a NUBI testing specialist. For testing workflows:
1. Create comprehensive test coverage for new features
2. Use MockRuntime from test-utils.ts for ElizaOS testing
3. Test database operations with proper connection cleanup
4. Validate Socket.IO integration with session management
5. Test raid coordination workflows end-to-end
6. Ensure memory operations work correctly with semantic search
7. Validate MCP integration and tool availability

Focus on robust testing that covers ElizaOS integration patterns.
```

### For Performance Optimization:
```
You are a NUBI performance optimization specialist. For optimization tasks:
1. Analyze database query patterns and connection usage
2. Optimize memory retrieval with semantic search improvements
3. Profile service performance and identify bottlenecks
4. Implement parallel processing where appropriate
5. Optimize Socket.IO message processing pipelines
6. Monitor and improve raid coordination performance
7. Ensure efficient resource utilization across services

Balance performance improvements with code maintainability.
```

## Development Automation Workflows

### Pre-commit Validation
```bash
#!/bin/bash
# Automated pre-commit validation workflow

echo "🔍 Running NUBI pre-commit validation..."

# 1. Type checking
echo "📝 Type checking..."
if ! bun run type-check; then
  echo "❌ Type check failed"
  exit 1
fi

# 2. Code formatting
echo "🎨 Formatting code..."
bun run format

# 3. Linting
echo "🔧 Linting code..."
if ! bun run lint; then
  echo "❌ Lint check failed"
  exit 1
fi

# 4. ElizaOS compliance check
echo "🏛️ Checking ElizaOS compliance..."
if ! grep -r "extends Service" src/services/ --include="*.ts" | grep -q .; then
  echo "❌ Missing service implementations"
  exit 1
fi

# 5. Testing
echo "🧪 Running tests..."
if ! bun test; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ Pre-commit validation passed"
```

### CI/CD Pipeline Integration
```bash
#!/bin/bash
# Continuous Integration workflow

echo "🚀 Starting NUBI CI pipeline..."

# 1. Environment setup
echo "⚙️ Setting up environment..."
bun install

# 2. Build validation
echo "🏗️ Building application..."
if ! bun run build; then
  echo "❌ Build failed"
  exit 1
fi

# 3. Comprehensive testing
echo "🧪 Running comprehensive tests..."
if ! bun run test:coverage; then
  echo "❌ Test coverage insufficient"
  exit 1
fi

# 4. E2E testing
echo "🎭 Running E2E tests..."
if ! bun run cy:run; then
  echo "❌ E2E tests failed"
  exit 1
fi

# 5. Database migration validation
echo "🗄️ Validating database migrations..."
if ! bun run migrate:validate; then
  echo "❌ Migration validation failed"
  exit 1
fi

echo "✅ CI pipeline completed successfully"
```

### Development Environment Setup
```bash
#!/bin/bash
# NUBI development environment setup

echo "🛠️ Setting up NUBI development environment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
bun install

# 2. Setup database
echo "🗄️ Setting up database..."
if [ -n "$POSTGRES_URL" ]; then
  echo "Using PostgreSQL production database"
  bun run migrate:up
else
  echo "Using PGLite development database"
  mkdir -p ./.eliza/.elizadb
fi

# 3. Environment configuration
echo "⚙️ Configuring environment..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "📝 Created .env file - please configure your settings"
fi

# 4. Validate ElizaOS integration
echo "🏛️ Validating ElizaOS integration..."
if ! bun run type-check; then
  echo "❌ ElizaOS integration validation failed"
  exit 1
fi

# 5. Test MCP servers
echo "🔌 Testing MCP server connections..."
if ! bun run test:mcp; then
  echo "⚠️ Some MCP servers may not be available"
fi

echo "✅ Development environment ready"
echo "🚀 Run 'bun run dev' to start development server"
```

## Code Quality Automation

### Automated Refactoring Patterns
```typescript
// Service implementation validation
const validateServiceImplementation = async (filePath: string) => {
  const content = await readFile(filePath);
  
  const validationRules = [
    {
      pattern: /extends Service/,
      message: "Service must extend ElizaOS Service base class"
    },
    {
      pattern: /static serviceType.*const/,
      message: "Service must define static serviceType constant"
    },
    {
      pattern: /constructor.*IAgentRuntime/,
      message: "Service constructor must accept IAgentRuntime parameter"
    },
    {
      pattern: /async start\(\)/,
      message: "Service must implement async start() method"
    },
    {
      pattern: /async stop\(\)/,
      message: "Service should implement stop() method for cleanup"
    }
  ];
  
  const violations = validationRules.filter(rule => !rule.pattern.test(content));
  
  if (violations.length > 0) {
    logger.warn(`[SERVICE_VALIDATION] ${filePath} has violations:`, violations);
    return false;
  }
  
  return true;
};
```

### Performance Profiling
```typescript
// Automated performance profiling
const profileServicePerformance = async (
  serviceName: string,
  operation: () => Promise<any>
) => {
  const startTime = performance.now();
  const initialMemory = process.memoryUsage();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    const finalMemory = process.memoryUsage();
    
    const profile = {
      service: serviceName,
      duration,
      memoryDelta: {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        external: finalMemory.external - initialMemory.external
      },
      timestamp: Date.now()
    };
    
    logger.info(`[PERFORMANCE_PROFILE] ${serviceName}:`, profile);
    
    // Store performance data
    await storePerformanceMetrics(profile);
    
    return result;
  } catch (error) {
    logger.error(`[PERFORMANCE_PROFILE] ${serviceName} failed:`, error);
    throw error;
  }
};
```

## Integration with ElizaOS Development

### Memory System Testing
```typescript
// Automated memory system testing
const testMemoryOperations = async (runtime: IAgentRuntime) => {
  const testCases = [
    {
      name: "Memory Creation",
      operation: () => runtime.createMemory({
        content: { test: "data" },
        roomId: runtime.agentId,
        agentId: runtime.agentId,
        userId: "test-user"
      })
    },
    {
      name: "Memory Search",
      operation: () => runtime.searchMemories({
        roomId: runtime.agentId,
        count: 10,
        match_threshold: 0.7
      })
    },
    {
      name: "Semantic Search",
      operation: () => runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: "test query"
      })
    }
  ];
  
  const results = await Promise.allSettled(
    testCases.map(async testCase => {
      const startTime = performance.now();
      await testCase.operation();
      const duration = performance.now() - startTime;
      return { ...testCase, duration, success: true };
    })
  );
  
  return results;
};
```

Use this agent for all development workflows, testing automation, and performance optimization tasks to ensure high-quality ElizaOS-compliant code.