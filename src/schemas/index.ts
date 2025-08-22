/**
 * Schema exports for ElizaOS NUBI Agent
 *
 * Provides database schemas and schema utilities for ElizaOS compliance
 */

// Export all schemas from elizaos-schemas.ts
export {
  // Core ElizaOS tables
  agents,
  memories,
  relationships,
  entities,
  rooms,

  // NUBI-specific tables
  nubi_sessions,
  nubi_session_messages,
  user_records,
  cross_platform_identities,
  emotional_state_log,
  cache,

  // Relations
  agentRelations,
  memoryRelations,
  relationshipRelations,
  sessionRelations,
  sessionMessageRelations,
  userRecordRelations,

  // All schemas object
  allSchemas,
} from "./elizaos-schemas";

/**
 * Schema utilities for database operations
 */
export const schemaUtils = {
  /**
   * Get table name from schema
   */
  getTableName: (schema: any): string => {
    return schema._.name;
  },

  /**
   * Get all column names from schema
   */
  getColumnNames: (schema: any): string[] => {
    return Object.keys(schema).filter(
      (key) =>
        key !== "_" && typeof schema[key] === "object" && schema[key]._?.name,
    );
  },

  /**
   * Get primary key column from schema
   */
  getPrimaryKey: (schema: any): string | null => {
    for (const [key, column] of Object.entries(schema)) {
      if (
        key !== "_" &&
        typeof column === "object" &&
        column &&
        (column as any)._?.primaryKey
      ) {
        return key;
      }
    }
    return null;
  },

  /**
   * Get foreign key columns from schema
   */
  getForeignKeys: (schema: any): string[] => {
    const foreignKeys: string[] = [];
    for (const [key, column] of Object.entries(schema)) {
      if (
        key !== "_" &&
        typeof column === "object" &&
        column &&
        (column as any)._?.references
      ) {
        foreignKeys.push(key);
      }
    }
    return foreignKeys;
  },

  /**
   * Validate schema structure
   */
  validateSchema: (schema: any): boolean => {
    return !!(
      schema &&
      typeof schema === "object" &&
      schema._ &&
      schema._.name &&
      Object.keys(schema).length > 1 // At least one column besides metadata
    );
  },

  /**
   * Get schema metadata
   */
  getSchemaMetadata: (schema: any) => {
    return {
      name: schema._?.name,
      columns: schemaUtils.getColumnNames(schema),
      primaryKey: schemaUtils.getPrimaryKey(schema),
      foreignKeys: schemaUtils.getForeignKeys(schema),
      hasTimestamps: schemaUtils.hasTimestampColumns(schema),
      hasMetadata: schemaUtils.hasMetadataColumn(schema),
    };
  },

  /**
   * Check if schema has timestamp columns
   */
  hasTimestampColumns: (schema: any): boolean => {
    return schemaUtils
      .getColumnNames(schema)
      .some((col) => col === "created_at" || col === "updated_at");
  },

  /**
   * Check if schema has metadata column
   */
  hasMetadataColumn: (schema: any): boolean => {
    return "metadata" in schema;
  },

  /**
   * Create migration SQL for schema
   */
  createMigrationSQL: (schema: any): string => {
    const tableName = schemaUtils.getTableName(schema);
    const columns = schemaUtils.getColumnNames(schema);

    let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

    const columnDefs = columns.map((col) => {
      const column = schema[col];
      let def = `  "${col}" `;

      if (column._?.dataType === "uuid") {
        def += "UUID";
        if (column._?.primaryKey) def += " PRIMARY KEY";
        if (column._?.defaultRandom) def += " DEFAULT gen_random_uuid()";
      } else if (column._?.dataType === "text") {
        def += "TEXT";
        if (column._?.notNull) def += " NOT NULL";
      } else if (column._?.dataType === "varchar") {
        def += `VARCHAR(${column._?.length || 255})`;
        if (column._?.notNull) def += " NOT NULL";
      } else if (column._?.dataType === "integer") {
        def += "INTEGER";
        if (column._?.notNull) def += " NOT NULL";
        if (column._?.default) def += ` DEFAULT ${column._?.default}`;
      } else if (column._?.dataType === "boolean") {
        def += "BOOLEAN";
        if (column._?.notNull) def += " NOT NULL";
        if (column._?.default !== undefined)
          def += ` DEFAULT ${column._?.default}`;
      } else if (column._?.dataType === "real") {
        def += "REAL";
        if (column._?.notNull) def += " NOT NULL";
        if (column._?.default !== undefined)
          def += ` DEFAULT ${column._?.default}`;
      } else if (column._?.dataType === "jsonb") {
        def += "JSONB";
        if (column._?.notNull) def += " NOT NULL";
        if (column._?.default)
          def += ` DEFAULT '${JSON.stringify(column._?.default)}'`;
      } else if (column._?.dataType === "timestamp") {
        def += "TIMESTAMP";
        if (column._?.notNull) def += " NOT NULL";
        if (column._?.defaultNow) def += " DEFAULT NOW()";
      } else if (column._?.dataType === "serial") {
        def += "SERIAL";
        if (column._?.notNull) def += " NOT NULL";
      }

      return def;
    });

    sql += columnDefs.join(",\n") + "\n);";

    return sql;
  },
};

/**
 * Schema configuration for NUBI agent
 */
export const schemaConfig = {
  // Table naming conventions
  naming: {
    prefix: "nubi_", // Prefix for NUBI-specific tables
    separator: "_", // Word separator
    case: "snake_case", // Case convention
  },

  // Column conventions
  columns: {
    id: "uuid", // Primary key type
    timestamps: ["created_at", "updated_at"], // Standard timestamp columns
    metadata: "metadata", // Metadata column name
    softDelete: "deleted_at", // Soft delete column
  },

  // Indexing strategy
  indexing: {
    primaryKey: true, // Always create primary key
    foreignKeys: true, // Always index foreign keys
    timestamps: true, // Index timestamp columns
    searchable: true, // Index searchable columns
  },

  // Validation rules
  validation: {
    maxTableNameLength: 63, // PostgreSQL limit
    maxColumnNameLength: 63, // PostgreSQL limit
    requireTimestamps: true, // All tables should have timestamps
    requireMetadata: true, // All tables should have metadata column
  },
};

// Export default schema interface
export default {
  utils: schemaUtils,
  config: schemaConfig,
};
