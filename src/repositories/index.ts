/**
 * Repositories Module - Data Access Layer
 *
 * This module provides data access layer repositories for the NUBI application.
 * Repositories handle database operations and provide a clean interface for
 * services to interact with data.
 *
 * ARCHITECTURE NOTE:
 * - Uses Drizzle ORM for type-safe database operations
 * - Follows repository pattern for clean separation of concerns
 * - Provides consistent error handling and logging
 * - Supports PostgreSQL with full ACID compliance
 */

import {
  UserRecordsRepository,
  type UserRecord,
} from "./user-records-repository";
import { type UUID } from "@elizaos/core";

// Export repository classes and types
export { UserRecordsRepository } from "./user-records-repository";
export type { UserRecord } from "./user-records-repository";

// Repository factory function for dependency injection
export function createRepositories(database: any) {
  return {
    userRecords: new UserRecordsRepository(database),
  };
}

// Repository types for type safety
export interface Repositories {
  userRecords: UserRecordsRepository;
}

// Export repository interfaces for testing and mocking
export interface IUserRecordsRepository {
  upsert(params: {
    userUuid: UUID;
    agentId: UUID;
    recordType: string;
    content: string;
    tags: string[];
    importanceScore: number;
    embedding?: string;
    metadata?: Record<string, any>;
  }): Promise<UserRecord>;

  findByUser(userUuid: UUID, limit?: number): Promise<UserRecord[]>;
  findByType(
    userUuid: UUID,
    recordType: string,
    limit?: number,
  ): Promise<UserRecord[]>;
  findImportant(
    userUuid: UUID,
    minImportance: number,
    limit?: number,
  ): Promise<UserRecord[]>;
  delete(id: UUID): Promise<boolean>;
}
