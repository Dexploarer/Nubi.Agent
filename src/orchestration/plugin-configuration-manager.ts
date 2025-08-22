import {
  IAgentRuntime,
  Service,
  ServiceType,
  Plugin,
  logger,
} from "../core";

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  dependencies: string[];
  optional: boolean;
  version?: string;
  author?: string;
  category?: string;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  id: string;
  plugin: Plugin;
  config: PluginConfig;
  status: "loaded" | "initialized" | "error" | "disabled";
  error?: Error;
  loadTime?: number;
  dependencies: string[];
  dependents: string[];
}

/**
 * Configuration template for different use cases
 */
export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  plugins: PluginConfig[];
  environment: Record<string, string>;
  features: Record<string, boolean>;
}

/**
 * Plugin Configuration Manager Service
 *
 * Manages plugin lifecycle, configuration, dependencies, and hot-swapping
 * for modular ElizaOS architecture
 */
export class PluginConfigurationManagerService extends Service {
  static serviceType = "plugin-configuration-manager" as const;

  private registry: Map<string, PluginRegistryEntry> = new Map();
  private templates: Map<string, ConfigurationTemplate> = new Map();
  private loadOrder: string[] = [];
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  get capabilityDescription(): string {
    return "Plugin configuration manager for lifecycle management and hot-swapping capabilities";
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping Plugin Configuration Manager...");
    this.registry.clear();
    this.templates.clear();
    this.loadOrder = [];
    this.dependencyGraph.clear();
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new PluginConfigurationManagerService(runtime);
    logger.info("✅ Plugin Configuration Manager started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("plugin-configuration-manager");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ Plugin Configuration Manager started");
    // Service is ready - no specific startup tasks needed
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info("🔧 Initializing Plugin Configuration Manager...");

    // Register default configuration templates
    this.registerDefaultTemplates();

    // Load current plugin configuration
    this.loadCurrentConfiguration(runtime);

    logger.info(
      `✅ Plugin Manager initialized with ${this.registry.size} plugins`,
    );
  }

  /**
   * Register default configuration templates
   */
  private registerDefaultTemplates(): void {
    // Minimal configuration
    this.registerTemplate({
      id: "minimal",
      name: "Minimal Configuration",
      description: "Basic ElizaOS setup with core functionality only",
      plugins: [
        {
          id: "bootstrap",
          name: "@elizaos/plugin-bootstrap",
          enabled: true,
          priority: 100,
          config: {},
          dependencies: [],
          optional: false,
        },
        {
          id: "sql",
          name: "@elizaos/plugin-sql",
          enabled: true,
          priority: 90,
          config: {},
          dependencies: ["bootstrap"],
          optional: false,
        },
        {
          id: "openai",
          name: "@elizaos/plugin-openai",
          enabled: true,
          priority: 80,
          config: { model: "gpt-4o-mini" },
          dependencies: ["bootstrap"],
          optional: false,
        },
      ],
      environment: {
        LOG_LEVEL: "info",
      },
      features: {
        basicChat: true,
        memory: true,
      },
    });

    // Full social configuration
    this.registerTemplate({
      id: "social-full",
      name: "Full Social Media Setup",
      description: "Complete social media integration with all platforms",
      plugins: [
        {
          id: "bootstrap",
          name: "@elizaos/plugin-bootstrap",
          enabled: true,
          priority: 100,
          config: {},
          dependencies: [],
          optional: false,
        },
        {
          id: "sql",
          name: "@elizaos/plugin-sql",
          enabled: true,
          priority: 90,
          config: {},
          dependencies: ["bootstrap"],
          optional: false,
        },
        {
          id: "openai",
          name: "@elizaos/plugin-openai",
          enabled: true,
          priority: 85,
          config: { model: "gpt-4" },
          dependencies: ["bootstrap"],
          optional: false,
        },
        {
          id: "anthropic",
          name: "@elizaos/plugin-anthropic",
          enabled: true,
          priority: 84,
          config: { model: "claude-3-5-sonnet-20241022" },
          dependencies: ["bootstrap"],
          optional: true,
        },
        {
          id: "discord",
          name: "@elizaos/plugin-discord",
          enabled: true,
          priority: 70,
          config: {},
          dependencies: ["bootstrap", "sql"],
          optional: true,
        },
        {
          id: "twitter",
          name: "@elizaos/plugin-twitter",
          enabled: true,
          priority: 70,
          config: {},
          dependencies: ["bootstrap", "sql"],
          optional: true,
        },
        {
          id: "telegram",
          name: "@elizaos/plugin-telegram",
          enabled: true,
          priority: 70,
          config: {},
          dependencies: ["bootstrap", "sql"],
          optional: true,
        },
        {
          id: "anubis-unified",
          name: "anubis-unified",
          enabled: true,
          priority: 60,
          config: {
            typoRate: 0.03,
            contradictionRate: 0.15,
            emotionalPersistence: 1800000,
          },
          dependencies: ["bootstrap", "sql", "openai"],
          optional: false,
        },
      ],
      environment: {
        LOG_LEVEL: "info",
        RAID_AUTO_CREATE: "true",
        RAID_DURATION_MINUTES: "30",
      },
      features: {
        basicChat: true,
        memory: true,
        socialMedia: true,
        raidCoordination: true,
        personalityEvolution: true,
        antiDetection: true,
      },
    });

    // Development configuration
    this.registerTemplate({
      id: "development",
      name: "Development Setup",
      description:
        "Development configuration with debugging and testing features",
      plugins: [
        {
          id: "bootstrap",
          name: "@elizaos/plugin-bootstrap",
          enabled: true,
          priority: 100,
          config: {},
          dependencies: [],
          optional: false,
        },
        {
          id: "sql",
          name: "@elizaos/plugin-sql",
          enabled: true,
          priority: 90,
          config: { database: "sqlite://./data/dev.db" },
          dependencies: ["bootstrap"],
          optional: false,
        },
        {
          id: "openai",
          name: "@elizaos/plugin-openai",
          enabled: true,
          priority: 80,
          config: { model: "gpt-4o-mini" }, // Cheaper for development
          dependencies: ["bootstrap"],
          optional: false,
        },
        {
          id: "anubis-unified",
          name: "anubis-unified",
          enabled: true,
          priority: 60,
          config: {
            typoRate: 0.0, // No typos in development
            contradictionRate: 0.0,
            debugMode: true,
          },
          dependencies: ["bootstrap", "sql", "openai"],
          optional: false,
        },
      ],
      environment: {
        LOG_LEVEL: "debug",
        NODE_ENV: "development",
      },
      features: {
        basicChat: true,
        memory: true,
        debugging: true,
        hotReload: true,
      },
    });

    logger.info("📝 Registered default configuration templates");
  }

  /**
   * Load current plugin configuration from runtime
   */
  private loadCurrentConfiguration(runtime: IAgentRuntime): void {
    // This would analyze the current runtime to understand loaded plugins
    // For now, we'll register the known Anubis plugins

    const currentPlugins = [
      "bootstrap",
      "sql",
      "openai",
      "anthropic",
      "discord",
      "twitter",
      "telegram",
      "solana",
      "anubis-unified",
    ];

    for (const pluginId of currentPlugins) {
      const config: PluginConfig = {
        id: pluginId,
        name: pluginId.startsWith("@")
          ? pluginId
          : `@elizaos/plugin-${pluginId}`,
        enabled: true,
        priority: 50,
        config: {},
        dependencies: pluginId === "bootstrap" ? [] : ["bootstrap"],
        optional: pluginId !== "bootstrap" && pluginId !== "sql",
      };

      this.registerPluginConfig(config);
    }

    // Build dependency graph
    this.buildDependencyGraph();
    this.calculateLoadOrder();

    logger.info(`📦 Loaded configuration for ${this.registry.size} plugins`);
  }

  /**
   * Register a configuration template
   */
  registerTemplate(template: ConfigurationTemplate): void {
    this.templates.set(template.id, template);
    logger.info(`📋 Registered template: ${template.name}`);
  }

  /**
   * Register plugin configuration
   */
  registerPluginConfig(config: PluginConfig): void {
    const entry: PluginRegistryEntry = {
      id: config.id,
      plugin: null as any, // Will be set when plugin is loaded
      config,
      status: "loaded",
      dependencies: config.dependencies,
      dependents: [],
    };

    this.registry.set(config.id, entry);
    logger.debug(`🔌 Registered plugin config: ${config.name}`);
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(): void {
    this.dependencyGraph.clear();

    for (const [pluginId, entry] of this.registry) {
      this.dependencyGraph.set(pluginId, entry.dependencies);

      // Update dependents
      for (const depId of entry.dependencies) {
        const depEntry = this.registry.get(depId);
        if (depEntry) {
          depEntry.dependents.push(pluginId);
        }
      }
    }
  }

  /**
   * Calculate optimal load order based on dependencies
   */
  private calculateLoadOrder(): void {
    const visited = new Set<string>();
    const loadOrder: string[] = [];

    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) return;

      visited.add(pluginId);
      const dependencies = this.dependencyGraph.get(pluginId) || [];

      // Visit dependencies first
      for (const depId of dependencies) {
        visit(depId);
      }

      loadOrder.push(pluginId);
    };

    // Visit all plugins
    for (const pluginId of this.registry.keys()) {
      visit(pluginId);
    }

    this.loadOrder = loadOrder;
    logger.info("📊 Calculated plugin load order:", loadOrder.join(", "));
  }

  /**
   * Apply configuration template
   */
  async applyTemplate(
    templateId: string,
    runtime: IAgentRuntime,
  ): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.error(`Template not found: ${templateId}`);
      return false;
    }

    try {
      logger.info(`🎯 Applying template: ${template.name}`);

      // Clear current registry
      this.registry.clear();

      // Register plugins from template
      for (const pluginConfig of template.plugins) {
        this.registerPluginConfig(pluginConfig);
      }

      // Apply environment variables
      for (const [key, value] of Object.entries(template.environment)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      // Rebuild dependency graph and load order
      this.buildDependencyGraph();
      this.calculateLoadOrder();

      logger.info(`✅ Applied template: ${template.name}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to apply template: ${templateId}`, error);
      return false;
    }
  }

  /**
   * Enable/disable plugin
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      logger.error(`Plugin not found: ${pluginId}`);
      return false;
    }

    if (!enabled && !entry.config.optional) {
      logger.error(`Cannot disable required plugin: ${pluginId}`);
      return false;
    }

    // Check dependencies
    if (!enabled) {
      if (entry.dependents.length > 0) {
        logger.warn(
          `Plugin has dependents, consider disabling them first: ${entry.dependents}`,
        );
      }
    } else {
      // Check if dependencies are enabled
      for (const depId of entry.dependencies) {
        const depEntry = this.registry.get(depId);
        if (!depEntry?.config.enabled) {
          logger.error(`Dependency not enabled: ${depId}`);
          return false;
        }
      }
    }

    entry.config.enabled = enabled;
    entry.status = enabled ? "loaded" : "disabled";

    logger.info(`🔌 Plugin ${enabled ? "enabled" : "disabled"}: ${pluginId}`);
    return true;
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(
    pluginId: string,
    newConfig: Partial<Record<string, any>>,
  ): boolean {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      logger.error(`Plugin not found: ${pluginId}`);
      return false;
    }

    entry.config.config = { ...entry.config.config, ...newConfig };
    logger.info(`⚙️  Updated config for plugin: ${pluginId}`);
    return true;
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginId: string): PluginConfig | null {
    const entry = this.registry.get(pluginId);
    return entry?.config || null;
  }

  /**
   * Get all plugin configurations
   */
  getAllPluginConfigs(): PluginConfig[] {
    return Array.from(this.registry.values()).map((entry) => entry.config);
  }

  /**
   * Get available templates
   */
  getTemplates(): ConfigurationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): Record<string, any> {
    const enabledPlugins = Array.from(this.registry.values())
      .filter((entry) => entry.config.enabled)
      .map((entry) => entry.config.name);

    const requiredPlugins = Array.from(this.registry.values())
      .filter((entry) => !entry.config.optional)
      .map((entry) => entry.config.name);

    const optionalPlugins = Array.from(this.registry.values())
      .filter((entry) => entry.config.optional)
      .map((entry) => entry.config.name);

    return {
      totalPlugins: this.registry.size,
      enabledPlugins: enabledPlugins.length,
      requiredPlugins: requiredPlugins.length,
      optionalPlugins: optionalPlugins.length,
      loadOrder: this.loadOrder,
      templates: Array.from(this.templates.keys()),
      plugins: {
        enabled: enabledPlugins,
        required: requiredPlugins,
        optional: optionalPlugins,
      },
    };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check dependencies
    for (const [pluginId, entry] of this.registry) {
      if (!entry.config.enabled) continue;

      for (const depId of entry.dependencies) {
        const depEntry = this.registry.get(depId);
        if (!depEntry) {
          errors.push(`Plugin ${pluginId} depends on missing plugin: ${depId}`);
        } else if (!depEntry.config.enabled) {
          errors.push(
            `Plugin ${pluginId} depends on disabled plugin: ${depId}`,
          );
        }
      }
    }

    // Check for circular dependencies
    const hasCycle = this.detectCircularDependencies();
    if (hasCycle.length > 0) {
      errors.push(`Circular dependencies detected: ${hasCycle.join(" -> ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (pluginId: string, path: string[]): string[] => {
      if (recursionStack.has(pluginId)) {
        return [...path, pluginId];
      }

      if (visited.has(pluginId)) {
        return [];
      }

      visited.add(pluginId);
      recursionStack.add(pluginId);

      const dependencies = this.dependencyGraph.get(pluginId) || [];
      for (const depId of dependencies) {
        const cycle = hasCycle(depId, [...path, pluginId]);
        if (cycle.length > 0) {
          return cycle;
        }
      }

      recursionStack.delete(pluginId);
      return [];
    };

    for (const pluginId of this.registry.keys()) {
      const cycle = hasCycle(pluginId, []);
      if (cycle.length > 0) {
        return cycle;
      }
    }

    return [];
  }
}

export default PluginConfigurationManagerService;
