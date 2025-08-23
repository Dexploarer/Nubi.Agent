import { IAgentRuntime, Service, logger } from "@elizaos/core";

export interface ServiceDefinition {
  name: string;
  service: typeof Service;
  required: boolean;
  dependencies?: string[];
}

export interface SystemInfo {
  databaseConnected: boolean;
  redisConnected: boolean;
  servicesInitialized: number;
  totalServices: number;
}

/**
 * Manages Supabase and infrastructure services
 * Provides centralized service lifecycle management
 */
export class SupabaseServiceManager {
  private runtime: IAgentRuntime;
  private services: Map<string, Service> = new Map();
  private serviceDefinitions: ServiceDefinition[] = [];
  private initialized = false;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Register a service definition
   */
  registerService(definition: ServiceDefinition): void {
    this.serviceDefinitions.push(definition);
    logger.info(`📝 Registered service: ${definition.name}`);
  }

  /**
   * Initialize all registered services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("Service manager already initialized");
      return;
    }

    logger.info(
      `🚀 Initializing ${this.serviceDefinitions.length} services...`,
    );

    // Sort services by dependencies
    const sortedDefinitions = this.sortServicesByDependencies();

    // Initialize services in order
    for (const def of sortedDefinitions) {
      try {
        logger.info(`  ⚙️ Initializing ${def.name}...`);

        // Create service instance
        const ServiceClass = def.service as any;
        const serviceInstance = new ServiceClass();

        // Initialize if method exists
        if (typeof serviceInstance.initialize === "function") {
          await serviceInstance.initialize(this.runtime);
        }

        // Register with runtime if possible
        if (this.runtime.registerService) {
          await this.runtime.registerService(serviceInstance);
        }

        this.services.set(def.name, serviceInstance);
        logger.info(`  ✅ ${def.name} initialized`);
      } catch (error) {
        const errorMsg = `Failed to initialize ${def.name}: ${error}`;

        if (def.required) {
          logger.error(`  ❌ ${errorMsg}`);
          throw new Error(errorMsg);
        } else {
          logger.warn(`  ⚠️ ${errorMsg} (optional service, continuing)`);
        }
      }
    }

    this.initialized = true;
    logger.info(
      `✨ Service initialization complete (${this.services.size}/${this.serviceDefinitions.length})`,
    );
  }

  /**
   * Get a service by name
   */
  getService<T extends Service>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /**
   * Get system information
   */
  getSystemInfo(): SystemInfo {
    // Check database connection
    const databaseConnected = this.checkDatabaseConnection();

    // Check Redis connection (if applicable)
    const redisConnected = this.checkRedisConnection();

    return {
      databaseConnected,
      redisConnected,
      servicesInitialized: this.services.size,
      totalServices: this.serviceDefinitions.length,
    };
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    logger.info("🛑 Shutting down services...");

    // Shutdown in reverse order
    const reverseServices = Array.from(this.services.entries()).reverse();

    for (const [name, service] of reverseServices) {
      try {
        if (typeof (service as any).shutdown === "function") {
          await (service as any).shutdown();
        }
        logger.info(`  ✅ ${name} shutdown`);
      } catch (error) {
        logger.error(
          `  ❌ Failed to shutdown ${name}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    this.services.clear();
    this.initialized = false;
  }

  /**
   * Sort services by their dependencies
   */
  private sortServicesByDependencies(): ServiceDefinition[] {
    const sorted: ServiceDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (def: ServiceDefinition) => {
      if (visited.has(def.name)) return;
      if (visiting.has(def.name)) {
        throw new Error(`Circular dependency detected: ${def.name}`);
      }

      visiting.add(def.name);

      // Visit dependencies first
      if (def.dependencies) {
        for (const depName of def.dependencies) {
          const depDef = this.serviceDefinitions.find(
            (d) => d.name === depName,
          );
          if (depDef) {
            visit(depDef);
          }
        }
      }

      visiting.delete(def.name);
      visited.add(def.name);
      sorted.push(def);
    };

    for (const def of this.serviceDefinitions) {
      visit(def);
    }

    return sorted;
  }

  /**
   * Check database connection status
   */
  private checkDatabaseConnection(): boolean {
    try {
      // Check if database adapter exists and is connected
      const dbAdapter = (this.runtime as any).databaseAdapter;
      if (dbAdapter && typeof dbAdapter.isConnected === "function") {
        return dbAdapter.isConnected();
      }

      // Check for database pooler manager
      const poolerManager = this.getService("database-pooler-manager");
      if (
        poolerManager &&
        typeof (poolerManager as any).isConnected === "function"
      ) {
        return (poolerManager as any).isConnected();
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check Redis connection status
   */
  private checkRedisConnection(): boolean {
    try {
      // Check for Redis service
      const redisService = this.getService("redis");
      if (
        redisService &&
        typeof (redisService as any).isConnected === "function"
      ) {
        return (redisService as any).isConnected();
      }

      return false;
    } catch {
      return false;
    }
  }
}
