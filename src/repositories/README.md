# Repositories Directory

## Overview

This directory contains data access layer repositories for the NUBI application. Repositories handle database operations and provide a clean interface for services to interact with data.

## Current State

### Active Repositories

#### User Records Repository

- **File**: `user-records-repository.ts`
- **Status**: ✅ **Implemented and Ready**
- **Purpose**: Manages user-specific records and memories
- **Database Table**: `user_records`
- **Features**:
  - Create and update user records
  - Semantic search with embeddings
  - Tag-based organization
  - Importance scoring
  - Metadata storage

**Key Methods**:

- `upsert()` - Create or update records
- `findByUser()` - Get user's records
- `findByType()` - Filter by record type
- `findImportant()` - Get high-importance records
- `delete()` - Remove records

### Removed Files

- `cross-platform-identity-repository.ts.bak` - Removed (unused backup)
- `nubi-sessions-repository.ts.bak` - Removed (unused backup)

## Usage

### Importing Repositories

```typescript
import { UserRecordsRepository, createRepositories } from "./repositories";

// Create individual repository
const userRepo = new UserRecordsRepository(database);

// Or use factory function
const repos = createRepositories(database);
const userRecords = repos.userRecords;
```

### Example Usage

```typescript
import { UserRecordsRepository } from "./repositories";

const userRepo = new UserRecordsRepository(database);

// Store user preference
const record = await userRepo.upsert({
  userUuid: "user-id",
  agentId: "agent-id",
  recordType: "preference",
  content: "User prefers technical discussions",
  tags: ["technical", "preference"],
  importanceScore: 0.8,
});

// Retrieve user records
const userRecords = await userRepo.findByUser("user-id", 10);
const importantRecords = await userRepo.findImportant("user-id", 0.7);
```

## Integration Status

### Current Integration

- **Database Schema**: ✅ Integrated with `user_records` table
- **Services**: ⚠️ Not currently integrated with services
- **Type Safety**: ✅ Full TypeScript support
- **Error Handling**: ✅ Comprehensive error handling

### Potential Integration Points

1. **DatabaseMemoryService**: Could use UserRecordsRepository for enhanced context
2. **UserIdentityService**: Could store user identity records
3. **CommunityMemoryService**: Could track community member records
4. **Analytics Services**: Could store user behavior records

## Architecture

### Repository Pattern

- **Separation of Concerns**: Data access logic separated from business logic
- **Type Safety**: Full TypeScript support with proper interfaces
- **Error Handling**: Comprehensive error handling and logging
- **Performance**: Optimized queries with proper indexing

### Database Integration

- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL**: Primary database with full ACID compliance
- **Connection Pooling**: Efficient database connection management
- **Migration Support**: Automatic schema migration and versioning

## Future Enhancements

### Planned Repositories

- **Session Repository**: Manage user sessions and state
- **Analytics Repository**: Store analytics and metrics data
- **Community Repository**: Community-specific data management
- **Configuration Repository**: Application configuration storage

### Integration Opportunities

- **Service Integration**: Integrate with existing services
- **Caching Layer**: Add Redis caching for frequently accessed data
- **Batch Operations**: Support for batch insert/update operations
- **Monitoring**: Add query performance monitoring

## Testing

### Repository Testing

```typescript
import { UserRecordsRepository } from "./repositories";

describe("UserRecordsRepository", () => {
  let repo: UserRecordsRepository;
  let testDb: PostgresJsDatabase;

  beforeEach(async () => {
    testDb = createTestDatabase();
    repo = new UserRecordsRepository(testDb);
  });

  it("should create user record", async () => {
    const record = await repo.upsert({
      userUuid: "test-user",
      agentId: "test-agent",
      recordType: "test",
      content: "test content",
      tags: ["test"],
      importanceScore: 0.5,
    });

    expect(record).toBeDefined();
    expect(record.content).toBe("test content");
  });
});
```

## Best Practices

### Development Guidelines

1. **Always use TypeScript interfaces** for data structures
2. **Implement proper error handling** in all methods
3. **Use database transactions** for multi-step operations
4. **Add comprehensive logging** for debugging
5. **Write unit tests** for all repository methods
6. **Document complex queries** with comments
7. **Use parameterized queries** to prevent SQL injection
8. **Implement proper indexing** for performance

### Code Organization

- **Single Responsibility**: Each repository handles one entity type
- **Consistent Naming**: Use consistent method and variable naming
- **Clear Documentation**: Document all public methods
- **Type Safety**: Use strict TypeScript configuration
- **Error Boundaries**: Proper error boundaries and recovery

---

_This repositories directory provides a robust, type-safe data access layer for the NUBI application, following best practices for database operations and service integration._
