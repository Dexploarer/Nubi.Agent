import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  real,
  varchar,
  serial,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * ElizaOS-Compliant Database Schemas for NUBI Plugin
 *
 * Following ElizaOS conventions for:
 * - Table naming (snake_case)
 * - Standard column patterns
 * - Proper indexing strategies
 * - Foreign key relationships
 * - JSON metadata patterns
 */

// Core ElizaOS tables (extending standard schemas)
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  avatar: text("avatar"),
  settings: jsonb("settings").default({}),
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    entity_id: uuid("entity_id").notNull(), // User/entity who created memory
    room_id: uuid("room_id").notNull(),
    content: jsonb("content").notNull(),
    type: varchar("type", { length: 50 }).default("message"),
    embedding: text("embedding"), // Vector embedding storage
    unique: boolean("unique").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    agent_idx: index("memories_agent_idx").on(table.agent_id),
    room_idx: index("memories_room_idx").on(table.room_id),
    entity_idx: index("memories_entity_idx").on(table.entity_id),
    type_idx: index("memories_type_idx").on(table.type),
    created_idx: index("memories_created_idx").on(table.created_at),
  }),
);

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    source_entity_id: uuid("source_entity_id").notNull(),
    target_entity_id: uuid("target_entity_id").notNull(),
    relationship_type: varchar("relationship_type", { length: 50 }).default(
      "acquaintance",
    ),
    strength: real("strength").default(0.5),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agent_source_idx: index("relationships_agent_source_idx").on(
      table.agent_id,
      table.source_entity_id,
    ),
    agent_target_idx: index("relationships_agent_target_idx").on(
      table.agent_id,
      table.target_entity_id,
    ),
    type_idx: index("relationships_type_idx").on(table.relationship_type),
  }),
);

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    names: jsonb("names").notNull(), // Array of known names
    details: jsonb("details").default({}),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    created_idx: index("entities_created_idx").on(table.created_at),
  }),
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    name: varchar("name", { length: 200 }),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agent_idx: index("rooms_agent_idx").on(table.agent_id),
  }),
);

// NUBI-specific extended tables following ElizaOS patterns
export const nubi_sessions = pgTable(
  "nubi_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    user_id: uuid("user_id").notNull(),
    room_id: uuid("room_id").references(() => rooms.id),
    status: varchar("status", { length: 20 }).default("active"),
    timeout_minutes: integer("timeout_minutes").default(60),
    auto_renew: boolean("auto_renew").default(false),
    expires_at: timestamp("expires_at").notNull(),
    last_activity: timestamp("last_activity").defaultNow().notNull(),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agent_user_idx: index("nubi_sessions_agent_user_idx").on(
      table.agent_id,
      table.user_id,
    ),
    status_idx: index("nubi_sessions_status_idx").on(table.status),
    expires_idx: index("nubi_sessions_expires_idx").on(table.expires_at),
  }),
);

export const nubi_session_messages = pgTable(
  "nubi_session_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id")
      .references(() => nubi_sessions.id)
      .notNull(),
    sender_id: uuid("sender_id").notNull(),
    sender_type: varchar("sender_type", { length: 10 }).notNull(), // 'user' or 'agent'
    content: jsonb("content").notNull(),
    sequence_number: serial("sequence_number").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    session_idx: index("nubi_session_messages_session_idx").on(
      table.session_id,
    ),
    timestamp_idx: index("nubi_session_messages_timestamp_idx").on(
      table.timestamp,
    ),
    sequence_idx: index("nubi_session_messages_sequence_idx").on(
      table.session_id,
      table.sequence_number,
    ),
  }),
);

export const user_records = pgTable(
  "user_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_uuid: uuid("user_uuid").notNull(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    record_type: varchar("record_type", { length: 50 }).notNull(),
    content: text("content").notNull(),
    tags: jsonb("tags").default([]),
    importance_score: real("importance_score").default(0.5),
    embedding: text("embedding"), // Vector embedding for semantic search
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    user_agent_idx: index("user_records_user_agent_idx").on(
      table.user_uuid,
      table.agent_id,
    ),
    type_idx: index("user_records_type_idx").on(table.record_type),
    importance_idx: index("user_records_importance_idx").on(
      table.importance_score,
    ),
    created_idx: index("user_records_created_idx").on(table.created_at),
    user_content_uidx: uniqueIndex("user_records_user_content_uidx").on(
      table.user_uuid,
      table.content,
    ),
  }),
);

export const cross_platform_identities = pgTable(
  "cross_platform_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_uuid: uuid("user_uuid").notNull(),
    platform: varchar("platform", { length: 30 }).notNull(), // 'discord', 'telegram', 'twitter', etc.
    platform_user_id: varchar("platform_user_id", { length: 100 }).notNull(),
    username: varchar("username", { length: 100 }),
    display_name: varchar("display_name", { length: 100 }),
    metadata: jsonb("metadata").default({}),
    verified: boolean("verified").default(false),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    user_platform_idx: index("cross_platform_identities_user_platform_idx").on(
      table.user_uuid,
      table.platform,
    ),
    platform_user_idx: index("cross_platform_identities_platform_user_idx").on(
      table.platform,
      table.platform_user_id,
    ),
  }),
);

export const emotional_state_log = pgTable(
  "emotional_state_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    state: varchar("state", { length: 30 }).notNull(),
    intensity: real("intensity").default(0.7),
    duration: integer("duration").default(0), // milliseconds
    triggers: jsonb("triggers").default([]),
    context: jsonb("context").default({}),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    agent_created_idx: index("emotional_state_log_agent_created_idx").on(
      table.agent_id,
      table.created_at,
    ),
    state_idx: index("emotional_state_log_state_idx").on(table.state),
  }),
);

export const cache = pgTable(
  "cache",
  {
    key: varchar("key", { length: 200 }).notNull(),
    agent_id: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    value: jsonb("value").notNull(),
    expires_at: timestamp("expires_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    key_agent_pk: index("cache_key_agent_pk").on(table.key, table.agent_id),
    expires_idx: index("cache_expires_idx").on(table.expires_at),
  }),
);

// Drizzle relations
export const agentRelations = relations(agents, ({ many }) => ({
  memories: many(memories),
  relationships: many(relationships),
  rooms: many(rooms),
  sessions: many(nubi_sessions),
  userRecords: many(user_records),
  emotionalStates: many(emotional_state_log),
  cache: many(cache),
}));

export const memoryRelations = relations(memories, ({ one }) => ({
  agent: one(agents, {
    fields: [memories.agent_id],
    references: [agents.id],
  }),
}));

export const relationshipRelations = relations(relationships, ({ one }) => ({
  agent: one(agents, {
    fields: [relationships.agent_id],
    references: [agents.id],
  }),
}));

export const sessionRelations = relations(nubi_sessions, ({ one, many }) => ({
  agent: one(agents, {
    fields: [nubi_sessions.agent_id],
    references: [agents.id],
  }),
  room: one(rooms, {
    fields: [nubi_sessions.room_id],
    references: [rooms.id],
  }),
  messages: many(nubi_session_messages),
}));

export const sessionMessageRelations = relations(
  nubi_session_messages,
  ({ one }) => ({
    session: one(nubi_sessions, {
      fields: [nubi_session_messages.session_id],
      references: [nubi_sessions.id],
    }),
  }),
);

export const userRecordRelations = relations(user_records, ({ one }) => ({
  agent: one(agents, {
    fields: [user_records.agent_id],
    references: [agents.id],
  }),
}));

// Export all schemas for Drizzle configuration
export const allSchemas = {
  agents,
  memories,
  relationships,
  entities,
  rooms,
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
};
