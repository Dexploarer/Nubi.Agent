# 🚨 ElizaOS Standards & Rules

## Overview

This directory contains mandatory rules and standards for the NUBI project to ensure:
- **Type Safety** - Strict TypeScript configuration
- **Consistent Logging** - ElizaOS logger usage only
- **Code Quality** - Production-ready standards
- **ElizaOS Compliance** - Framework best practices

## 📋 Rules Overview

### 1. TypeScript Standards (`typescript-standards.md`)
- **Strict Mode Required** - All TypeScript configs must use strict mode
- **No `any` Types** - Explicit typing required
- **Null Safety** - Proper null checks mandatory
- **Type Guards** - Use type guards instead of assertions

### 2. ElizaOS Logger Standards (`elizaos-logger-standards.md`)
- **ElizaOS Logger Only** - No custom loggers or console.log
- **Structured Logging** - Context objects required
- **Security** - No sensitive data in logs
- **Performance** - Minimal logging overhead

## 🔧 Enforcement Tools

### Automated Enforcement Script
```bash
# Run standards enforcement
bun run enforce-standards

# Run all checks (includes standards enforcement)
bun run check-all
```

### What the Script Checks:
1. **TypeScript Configuration**
   - Strict mode settings
   - No disabled strict options
   - Proper compiler options

2. **Logger Usage**
   - No `console.log` statements
   - ElizaOS logger imports only
   - No custom logger implementations

3. **Type Safety**
   - No `any` types
   - Proper type declarations
   - Null safety compliance

## 🚨 Violation Consequences

### Immediate Actions:
- **Build Failure** - Script exits with code 1
- **PR Block** - Cannot merge with violations
- **Review Required** - Manual review of all violations

### Violation Types:
1. **TypeScript Config** - Non-strict settings
2. **Console Usage** - `console.log` statements
3. **Custom Loggers** - Non-ElizaOS logger imports
4. **Any Types** - `any` type usage

## 📋 Pre-commit Checklist

Before every commit, ensure:
- [ ] `bun run enforce-standards` passes
- [ ] `bun run type-check` passes
- [ ] No `console.log` statements
- [ ] All logging uses ElizaOS logger
- [ ] No `any` types in new code
- [ ] Proper TypeScript strict mode

## 🔍 Manual Review Checklist

### TypeScript Review:
- [ ] Strict mode enabled
- [ ] No implicit any
- [ ] Proper null checks
- [ ] Type guards used
- [ ] Generic constraints defined

### Logger Review:
- [ ] ElizaOS logger imports only
- [ ] Structured logging with context
- [ ] No sensitive data logged
- [ ] Appropriate log levels
- [ ] Performance impact minimal

## 📚 Best Practices

### TypeScript:
```typescript
// ✅ CORRECT
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = await getUser();
if (user) {
  logger.info("User found", { userId: user.id });
}

// ❌ WRONG
const user: any = await getUser();
console.log("User found:", user);
```

### Logging:
```typescript
// ✅ CORRECT
import { logger } from "@elizaos/core";

logger.info("User action completed", {
  userId: user.id,
  action: "message_sent",
  platform: "telegram"
});

// ❌ WRONG
import { logger } from "./utils/logger";
console.log("User action completed");
```

## 🛠️ Development Workflow

### 1. Local Development
```bash
# Start development
bun run dev

# Check standards before commit
bun run enforce-standards
```

### 2. Pre-commit Hook
```bash
# Install pre-commit hook (recommended)
# Add to .git/hooks/pre-commit:
#!/bin/sh
bun run enforce-standards
```

### 3. CI/CD Pipeline
```yaml
# Add to CI pipeline
- name: Enforce Standards
  run: bun run enforce-standards
```

## 🔧 Configuration

### TypeScript Config
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Logger Import
```typescript
// Always use this import
import { logger } from "@elizaos/core";

// Never use these
import { logger } from "./utils/logger";
import { Logger } from "winston";
console.log("message");
```

## 📖 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ElizaOS Documentation](https://elizaos.dev)
- [Strict Mode Benefits](https://www.typescriptlang.org/tsconfig#strict)
- [Logging Best Practices](https://elizaos.dev/docs/logging)

## 🆘 Getting Help

### Common Issues:
1. **TypeScript Errors** - Check strict mode settings
2. **Logger Import Errors** - Use `@elizaos/core` import
3. **Console Usage** - Replace with ElizaOS logger
4. **Any Types** - Define proper interfaces

### Support:
- Check the specific rule files for detailed examples
- Run `bun run enforce-standards` for specific violations
- Review the best practices section above

---

**Remember: These standards are mandatory for production code quality and ElizaOS compliance.**
