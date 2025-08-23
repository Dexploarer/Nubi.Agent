import { ServiceDefinition } from "./supabase-service-manager";
import {
  DatabasePoolerManager,
  SessionsService,
  DatabaseMemoryService,
  PersonalityEvolutionService,
  EmotionalStateService,
  CommunityManagementService,
  CrossPlatformIdentityService,
  EnhancedResponseGenerator,
  SocketIOServerService,
  SocketIOClientService,
  SocketIOAnalyticsService,
  NUBISessionsService,
  RaidSessionManager,
  SocketIOSessionsService,
  StreamingSessionsService,
} from "../services";
import { UserIdentityService } from "../identity";
import SecurityFilter from "../services/security-filter";

/**
 * Service dependency definitions for NUBI plugin
 * Defines initialization order and dependencies
 */
export const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  // Core infrastructure (initialize first)
  {
    name: "database-pooler-manager",
    service: DatabasePoolerManager as any,
    required: true,
    dependencies: [],
  },

  // Security (initialize early)
  {
    name: "security-filter",
    service: SecurityFilter as any,
    required: true,
    dependencies: [],
  },

  // Database and memory services
  {
    name: "database-memory",
    service: DatabaseMemoryService as any,
    required: true,
    dependencies: ["database-pooler-manager"],
  },

  // Session management
  {
    name: "sessions",
    service: SessionsService as any,
    required: true,
    dependencies: ["database-memory"],
  },

  // Identity services
  {
    name: "user-identity",
    service: UserIdentityService as any,
    required: true,
    dependencies: ["database-pooler-manager"],
  },
  {
    name: "cross-platform-identity",
    service: CrossPlatformIdentityService as any,
    required: true,
    dependencies: ["user-identity", "database-pooler-manager"],
  },

  // Personality and emotion services
  {
    name: "emotional-state",
    service: EmotionalStateService as any,
    required: false,
    dependencies: ["database-memory"],
  },
  {
    name: "personality-evolution",
    service: PersonalityEvolutionService as any,
    required: false,
    dependencies: ["emotional-state", "database-memory"],
  },

  // Community management
  {
    name: "community-management",
    service: CommunityManagementService as any,
    required: false,
    dependencies: ["cross-platform-identity", "database-memory"],
  },

  // AI response generation
  {
    name: "enhanced-response-generator",
    service: EnhancedResponseGenerator as any,
    required: true,
    dependencies: [
      "personality-evolution",
      "emotional-state",
      "database-memory",
    ],
  },

  // Socket.IO services
  {
    name: "socketio-server",
    service: SocketIOServerService as any,
    required: false,
    dependencies: [],
  },
  {
    name: "socketio-client",
    service: SocketIOClientService as any,
    required: false,
    dependencies: [],
  },
  {
    name: "socketio-analytics",
    service: SocketIOAnalyticsService as any,
    required: false,
    dependencies: ["socketio-server"],
  },

  // Advanced session services
  {
    name: "nubi-sessions",
    service: NUBISessionsService as any,
    required: false,
    dependencies: ["sessions", "database-memory"],
  },
  {
    name: "raid-session-manager",
    service: RaidSessionManager as any,
    required: false,
    dependencies: ["sessions", "cross-platform-identity"],
  },
  {
    name: "socketio-sessions",
    service: SocketIOSessionsService as any,
    required: false,
    dependencies: ["socketio-server", "sessions"],
  },
  {
    name: "streaming-sessions",
    service: StreamingSessionsService as any,
    required: false,
    dependencies: ["sessions"],
  },
];
