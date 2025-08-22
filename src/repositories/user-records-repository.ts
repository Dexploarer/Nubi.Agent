import { eq, and, desc, sql } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { UUID, logger } from "@elizaos/core";
import { user_records } from "../schemas";

export interface UserRecord {
  id: UUID;
  userUuid: UUID;
  agentId: UUID;
  recordType: string;
  content: string;
  tags: string[];
  importanceScore: number;
  embedding?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRecordsRepository {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  /**
   * Create or update a user record
   */
  async upsert(params: {
    userUuid: UUID;
    agentId: UUID;
    recordType: string;
    content: string;
    tags: string[];
    importanceScore: number;
    embedding?: string;
    metadata?: Record<string, any>;
  }): Promise<UserRecord> {
    try {
      // Check if record exists
      const existing = await this.findByUserAndContent(
        params.userUuid,
        params.content,
      );

      if (existing) {
        // Update existing record
        const [updated] = await this.db
          .update(user_records)
          .set({
            importance_score: sql`GREATEST(${user_records.importance_score}, ${params.importanceScore})`,
            tags: this.mergeTags(existing.tags, params.tags),
            metadata: { ...existing.metadata, ...params.metadata },
            embedding: params.embedding || existing.embedding,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(user_records.user_uuid, params.userUuid),
              eq(user_records.content, params.content),
            ),
          )
          .returning();

        return this.mapToUserRecord(updated);
      } else {
        // Create new record
        const [created] = await this.db
          .insert(user_records)
          .values({
            user_uuid: params.userUuid,
            agent_id: params.agentId,
            record_type: params.recordType,
            content: params.content,
            tags: params.tags,
            importance_score: params.importanceScore,
            embedding: params.embedding,
            metadata: params.metadata || {},
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();

        return this.mapToUserRecord(created);
      }
    } catch (error) {
      logger.error(
        "[UserRecordsRepository] Upsert failed:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Find record by user UUID and content
   */
  async findByUserAndContent(
    userUuid: UUID,
    content: string,
  ): Promise<UserRecord | null> {
    const result = await this.db
      .select()
      .from(user_records)
      .where(
        and(
          eq(user_records.user_uuid, userUuid),
          eq(user_records.content, content),
        ),
      )
      .limit(1);

    return result.length > 0 ? this.mapToUserRecord(result[0]) : null;
  }

  /**
   * Find all records for a user
   */
  async findByUser(userUuid: UUID, limit = 100): Promise<UserRecord[]> {
    const results = await this.db
      .select()
      .from(user_records)
      .where(eq(user_records.user_uuid, userUuid))
      .orderBy(
        desc(user_records.importance_score),
        desc(user_records.created_at),
      )
      .limit(limit);

    return results.map((r) => this.mapToUserRecord(r));
  }

  /**
   * Find records by type
   */
  async findByType(
    userUuid: UUID,
    recordType: string,
    limit = 50,
  ): Promise<UserRecord[]> {
    const results = await this.db
      .select()
      .from(user_records)
      .where(
        and(
          eq(user_records.user_uuid, userUuid),
          eq(user_records.record_type, recordType),
        ),
      )
      .orderBy(desc(user_records.importance_score))
      .limit(limit);

    return results.map((r) => this.mapToUserRecord(r));
  }

  /**
   * Find records by importance threshold
   */
  async findImportant(
    userUuid: UUID,
    minImportance: number,
    limit = 20,
  ): Promise<UserRecord[]> {
    const results = await this.db
      .select()
      .from(user_records)
      .where(
        and(
          eq(user_records.user_uuid, userUuid),
          sql`${user_records.importance_score} >= ${minImportance}`,
        ),
      )
      .orderBy(desc(user_records.importance_score))
      .limit(limit);

    return results.map((r) => this.mapToUserRecord(r));
  }

  /**
   * Delete a record
   */
  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .delete(user_records)
      .where(eq(user_records.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Merge tags arrays, removing duplicates
   */
  private mergeTags(existing: string[] | any, newTags: string[]): string[] {
    // Handle JSONB tags field
    const existingArray = Array.isArray(existing) ? existing : [];
    const merged = [...new Set([...existingArray, ...newTags])];
    return merged;
  }

  /**
   * Map database row to domain type
   */
  private mapToUserRecord(row: any): UserRecord {
    return {
      id: row.id as UUID,
      userUuid: row.user_uuid as UUID,
      agentId: row.agent_id as UUID,
      recordType: row.record_type,
      content: row.content,
      tags: Array.isArray(row.tags) ? row.tags : [],
      importanceScore: row.importance_score,
      embedding: row.embedding,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
