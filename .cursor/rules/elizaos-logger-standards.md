# ElizaOS Logger Standards & Rules

## 🚨 MANDATORY REQUIREMENTS

### 1. ElizaOS Logger Usage (ABSOLUTE MUST)

**ALL logging MUST use ElizaOS built-in logger:**

```typescript
// ✅ CORRECT - ElizaOS logger
import { logger } from "@elizaos/core";

logger.info("User logged in", { userId: "123", platform: "discord" });
logger.error("Database connection failed", { error: err.message });
logger.warn("Rate limit approaching", { current: 95, limit: 100 });
logger.debug("Processing request", { requestId: "abc123" });
```

**NEVER ACCEPT:**
- Custom logger implementations
- `console.log`, `console.error`, `console.warn`
- Third-party logging libraries (winston, pino, etc.)
- Direct console output

### 2. Logging Patterns

#### Structured Logging
```typescript
// ✅ CORRECT - Structured logging with context
logger.info("User action completed", {
  userId: user.id,
  action: "message_sent",
  platform: "telegram",
  roomId: message.roomId,
  timestamp: new Date().toISOString()
});

// ❌ WRONG - String concatenation
logger.info(`User ${user.id} sent message in ${message.roomId}`);
```

#### Error Logging
```typescript
// ✅ CORRECT - Error with context
try {
  await databaseOperation();
} catch (error) {
  logger.error("Database operation failed", {
    operation: "user_create",
    userId: user.id,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
}

// ❌ WRONG - Just error message
catch (error) {
  logger.error("Database error");
}
```

#### Debug Logging
```typescript
// ✅ CORRECT - Debug with relevant data
logger.debug("Processing message", {
  messageId: message.id,
  contentType: message.content?.type,
  processingTime: Date.now() - startTime
});

// ❌ WRONG - No context
logger.debug("Processing message");
```

### 3. Log Levels

#### Info Level
- User actions and business events
- System state changes
- Performance metrics
- Configuration changes

#### Warn Level
- Recoverable errors
- Performance degradation
- Rate limit warnings
- Deprecated feature usage

#### Error Level
- Unrecoverable errors
- System failures
- Data corruption
- Security violations

#### Debug Level
- Detailed execution flow
- Variable values
- Performance timing
- Internal state

## 🔧 ENFORCEMENT RULES

### 1. Import Requirements
```typescript
// ✅ CORRECT - ElizaOS logger import
import { logger } from "@elizaos/core";

// ❌ WRONG - Custom logger
import { logger } from "./utils/logger";
```

### 2. No Console Output
```typescript
// ❌ FORBIDDEN - Direct console usage
console.log("User logged in");
console.error("Error occurred");
console.warn("Warning message");
console.debug("Debug info");

// ✅ REQUIRED - ElizaOS logger
logger.info("User logged in");
logger.error("Error occurred");
logger.warn("Warning message");
logger.debug("Debug info");
```

### 3. Context Requirements
```typescript
// ✅ CORRECT - Always include context
logger.info("Service started", {
  serviceName: "database",
  version: "1.0.0",
  environment: process.env.NODE_ENV
});

// ❌ WRONG - No context
logger.info("Service started");
```

## 📋 LOGGING CHECKLIST

### Before Every Commit:
- [ ] All logging uses `@elizaos/core` logger
- [ ] No `console.log` statements
- [ ] All logs include relevant context
- [ ] Error logs include error details
- [ ] Debug logs include timing/state info
- [ ] Log levels are appropriate

### Before Every PR:
- [ ] Logger imports are from ElizaOS
- [ ] No custom logger implementations
- [ ] Structured logging patterns used
- [ ] Sensitive data is not logged
- [ ] Performance impact is minimal

## 🚨 VIOLATION CONSEQUENCES

1. **Immediate Rejection** - Any `console.log` usage
2. **Build Failure** - Custom logger imports
3. **Review Block** - Missing context in logs
4. **Security Issue** - Logging sensitive data

## 📚 BEST PRACTICES

### 1. Sensitive Data Protection
```typescript
// ✅ CORRECT - Sanitized logging
logger.info("User authentication", {
  userId: user.id,
  platform: "discord",
  success: true
  // DO NOT log: passwords, tokens, private keys
});

// ❌ WRONG - Logging sensitive data
logger.info("User login", {
  userId: user.id,
  password: user.password, // NEVER log this
  token: user.accessToken  // NEVER log this
});
```

### 2. Performance Logging
```typescript
// ✅ CORRECT - Performance metrics
const startTime = Date.now();
await processRequest();
const duration = Date.now() - startTime;

logger.info("Request processed", {
  requestId: request.id,
  duration: `${duration}ms`,
  success: true
});
```

### 3. Error Context
```typescript
// ✅ CORRECT - Rich error context
try {
  await databaseOperation();
} catch (error) {
  logger.error("Database operation failed", {
    operation: "user_create",
    userId: user.id,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    retryCount: retryCount,
    lastAttempt: true
  });
}
```

### 4. Service Boundaries
```typescript
// ✅ CORRECT - Service boundary logging
export class UserService {
  async createUser(userData: UserData): Promise<User> {
    logger.info("Creating user", { email: userData.email });
    
    try {
      const user = await this.database.create(userData);
      logger.info("User created successfully", { userId: user.id });
      return user;
    } catch (error) {
      logger.error("User creation failed", {
        email: userData.email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
```

## 🔍 MONITORING

### Automated Checks:
- ESLint rules for console usage
- Import analysis for logger sources
- Structured log validation
- Sensitive data detection

### Manual Reviews:
- Log level appropriateness
- Context completeness
- Performance impact
- Security considerations

## 📖 LOGGING PATTERNS

### Service Lifecycle
```typescript
logger.info("Service starting", { serviceName: "UserService" });
logger.info("Service started", { serviceName: "UserService", port: 3000 });
logger.info("Service stopping", { serviceName: "UserService" });
logger.info("Service stopped", { serviceName: "UserService" });
```

### Request Processing
```typescript
logger.info("Request received", { requestId: "abc123", method: "POST" });
logger.debug("Processing request", { requestId: "abc123", step: "validation" });
logger.info("Request completed", { requestId: "abc123", duration: "150ms" });
```

### Error Handling
```typescript
logger.warn("Recoverable error", { error: "rate_limit", retryAfter: 60 });
logger.error("Unrecoverable error", { error: "database_connection", fatal: true });
```

## 🛡️ SECURITY CONSIDERATIONS

### Never Log:
- Passwords or tokens
- Private keys
- Personal data (PII)
- Internal system details
- API keys or secrets

### Always Log:
- User actions (with user ID)
- System events
- Performance metrics
- Error conditions
- Security events

---

**Remember: Consistent logging is crucial for debugging, monitoring, and security. ElizaOS logger provides everything needed.**
