import {
  Plugin,
  IAgentRuntime,
  logger,
  Service,
  Provider,
  Action,
  Evaluator,
} from "@elizaos/core";
import { NUBISessionsService } from "../services/nubi-sessions-service";
import { RaidSessionManager } from "../services/raid-session-manager";
import { SocketIOSessionsService } from "../services/socket-io-sessions-service";
import { DatabaseMemoryService } from "../services/database-memory-service";
import { SessionContextProvider } from "../providers/session-context-provider";

/**
 * NUBI Sessions Plugin
 * 
 * Integrates ElizaOS Sessions API with NUBI's existing architecture:
 * - Registers all session-related services
 * - Provides session context to all agent interactions
 * - Enables real-time raid coordination
 * - Maintains compatibility with existing NUBI features
 */

export class SessionsPlugin implements Plugin {
  name = "sessions";
  description = "ElizaOS Sessions API integration with NUBI-specific extensions";
  services: Service[] = [];
  providers: Provider[] = [];
  actions: Action[] = [];
  evaluators: Evaluator[] = [];

  async initialize(runtime: IAgentRuntime): Promise<void> {
    try {
      logger.info("[SESSIONS_PLUGIN] Initializing NUBI Sessions Plugin...");

      // Get existing memory service
      const memoryService = runtime.getService<DatabaseMemoryService>("database_memory");
      if (!memoryService) {
        logger.warn("[SESSIONS_PLUGIN] DatabaseMemoryService not found - some features may be limited");
      }

      // Initialize core sessions service
      const sessionsService = new NUBISessionsService(runtime);
      await sessionsService.start();
      this.services.push(sessionsService);

      // Initialize raid session manager
      if (memoryService) {
        const raidManager = new RaidSessionManager(runtime, sessionsService, memoryService);
        await raidManager.start();
        this.services.push(raidManager);

        // Initialize Socket.IO service
        const socketService = new SocketIOSessionsService(
          runtime,
          sessionsService,
          raidManager,
          parseInt(process.env.SOCKETIO_PORT || "3001")
        );
        await socketService.start();
        this.services.push(socketService);

        // Initialize session context provider
        const sessionProvider = new SessionContextProvider(
          runtime,
          sessionsService,
          memoryService
        );
        this.providers.push(sessionProvider);
      }

      logger.info("[SESSIONS_PLUGIN] NUBI Sessions Plugin initialized successfully");
    } catch (error) {
      logger.error("[SESSIONS_PLUGIN] Failed to initialize:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async cleanup(runtime: IAgentRuntime): Promise<void> {
    try {
      logger.info("[SESSIONS_PLUGIN] Cleaning up NUBI Sessions Plugin...");

      // Stop all services
      for (const service of this.services) {
        await service.stop();
      }

      // Clear arrays
      this.services = [];
      this.providers = [];
      this.actions = [];
      this.evaluators = [];

      logger.info("[SESSIONS_PLUGIN] NUBI Sessions Plugin cleanup completed");
    } catch (error) {
      logger.error("[SESSIONS_PLUGIN] Failed to cleanup:", error instanceof Error ? error.message : String(error));
    }
  }
}

export default SessionsPlugin;