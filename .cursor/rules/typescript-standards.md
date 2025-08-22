# TypeScript Standards & Rules

## 🚨 MANDATORY REQUIREMENTS

### 1. Strict TypeScript Configuration (ABSOLUTE MUST)

**ALL TypeScript configurations MUST use strict mode:**

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
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**NEVER ACCEPT:**
- `"strict": false`
- `"noImplicitAny": false`
- `"strictNullChecks": false`
- Any other strict mode settings disabled

### 2. Type Safety Rules

#### Explicit Type Declarations
```typescript
// ✅ CORRECT - Explicit types
const user: User = getUser();
const config: Config = loadConfig();
const result: Promise<Response> = apiCall();

// ❌ WRONG - Implicit any
const user = getUser();
const config = loadConfig();
const result = apiCall();
```

#### No `any` Types
```typescript
// ✅ CORRECT - Proper typing
interface ApiResponse<T> {
  data: T;
  status: number;
}

// ❌ WRONG - Using any
const response: any = await fetch('/api');
```

#### Null Safety
```typescript
// ✅ CORRECT - Null checks
const user = getUser();
if (user) {
  console.log(user.name);
}

// ❌ WRONG - No null check
const user = getUser();
console.log(user.name); // Could be null!
```

### 3. Interface & Type Definitions

#### Required Properties
```typescript
// ✅ CORRECT - All required properties
interface User {
  id: string;
  name: string;
  email: string;
}

// ❌ WRONG - Missing required properties
interface User {
  id?: string; // Optional when it should be required
  name: string;
}
```

#### Proper Generic Usage
```typescript
// ✅ CORRECT - Generic constraints
interface Repository<T extends { id: string }> {
  find(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

// ❌ WRONG - No constraints
interface Repository<T> {
  find(id: any): Promise<any>;
  save(entity: any): Promise<any>;
}
```

## 🔧 ENFORCEMENT RULES

### 1. Pre-commit Validation
- ALL commits MUST pass `bun run type-check`
- NO exceptions for "quick fixes"
- Type errors MUST be fixed before commit

### 2. Code Review Requirements
- Reviewers MUST check TypeScript configuration
- Reviewers MUST verify no `any` types
- Reviewers MUST ensure proper null safety

### 3. Build Pipeline
- Build MUST fail on TypeScript errors
- NO `--skipLibCheck` in production builds
- ALL type definitions MUST be generated

### 4. IDE Configuration
- VS Code MUST have strict TypeScript settings
- ESLint MUST enforce TypeScript rules
- Prettier MUST preserve type annotations

## 📋 CHECKLIST

### Before Every Commit:
- [ ] `bun run type-check` passes
- [ ] No `any` types in new code
- [ ] All functions have return types
- [ ] All variables have explicit types
- [ ] Null checks implemented
- [ ] Interface properties are properly typed

### Before Every PR:
- [ ] TypeScript config is strict
- [ ] All dependencies are properly typed
- [ ] No type assertions without validation
- [ ] Generic constraints are defined
- [ ] Error types are properly handled

## 🚨 VIOLATION CONSEQUENCES

1. **Immediate Rejection** - Any code with `any` types
2. **Build Failure** - Non-strict TypeScript config
3. **Review Block** - Missing type definitions
4. **Rollback Required** - Type safety violations in production

## 📚 BEST PRACTICES

### 1. Use Type Guards
```typescript
// ✅ CORRECT - Type guards
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

// ❌ WRONG - Type assertions
const user = obj as User;
```

### 2. Proper Error Handling
```typescript
// ✅ CORRECT - Typed error handling
interface ApiError {
  code: string;
  message: string;
}

try {
  await apiCall();
} catch (error) {
  if (error instanceof Error) {
    logger.error(error.message);
  }
}
```

### 3. Discriminated Unions
```typescript
// ✅ CORRECT - Discriminated unions
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// ❌ WRONG - Mixed types
type Result<T> = T | string;
```

## 🔍 MONITORING

### Automated Checks:
- TypeScript compiler strict mode
- ESLint TypeScript rules
- Pre-commit hooks
- CI/CD pipeline validation

### Manual Reviews:
- Code review checklist
- Architecture review
- Security review

## 📖 RESOURCES

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Strict Mode Benefits](https://www.typescriptlang.org/tsconfig#strict)
- [Type Safety Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

**Remember: Type safety is not optional. It's a fundamental requirement for production code.**
