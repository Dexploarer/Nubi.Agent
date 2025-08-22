/**
 * NUBI Application - Main entry point and module coordination
 * 
 * This module provides the main application interface, coordinates all modules,
 * and manages the application lifecycle with proper type safety.
 */

// Import all module exports
export * from '../core';
export * from '../identity';
export * from '../messaging';
export * from '../character';
export * from '../services';
export * from '../plugins';
export * from '../orchestration';

// Application types
export interface AppConfig {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  modules: ModuleConfig[];
  services: ServiceConfig[];
  plugins: PluginConfig[];
}

export interface ModuleConfig {
  name: string;
  enabled: boolean;
  dependencies: string[];
  config: Record<string, unknown>;
}

export interface ServiceConfig {
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

// Application lifecycle
export interface AppLifecycle {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): AppStatus;
}

export interface AppStatus {
  status: 'initializing' | 'running' | 'stopped' | 'error';
  modules: ModuleStatus[];
  services: ServiceStatus[];
  plugins: PluginStatus[];
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

export interface ModuleStatus {
  name: string;
  status: 'enabled' | 'disabled' | 'error';
  dependencies: string[];
  lastUpdate: Date;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  lastUpdate: Date;
}

export interface PluginStatus {
  name: string;
  status: 'enabled' | 'disabled' | 'error';
  version: string;
  lastUpdate: Date;
}

// Main application class
export class NubiApplication implements AppLifecycle {
  private config: AppConfig;
  private status: AppStatus;
  private startTime: number = 0;

  constructor(config: AppConfig) {
    this.config = config;
    this.status = {
      status: 'initializing',
      modules: [],
      services: [],
      plugins: [],
      uptime: 0,
      memory: { used: 0, total: 0 }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize all modules
      await this.initializeModules();
      
      // Initialize all services
      await this.initializeServices();
      
      // Initialize all plugins
      await this.initializePlugins();
      
      this.status.status = 'stopped';
    } catch (error) {
      this.status.status = 'error';
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      this.status.status = 'running';
      this.startTime = Date.now();
      
      // Start all services
      await this.startServices();
      
      // Start all plugins
      await this.startPlugins();
      
      // Update status
      this.updateStatus();
    } catch (error) {
      this.status.status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop all plugins
      await this.stopPlugins();
      
      // Stop all services
      await this.stopServices();
      
      this.status.status = 'stopped';
    } catch (error) {
      this.status.status = 'error';
      throw error;
    }
  }

  getStatus(): AppStatus {
    this.updateStatus();
    return this.status;
  }

  private async initializeModules(): Promise<void> {
    // Initialize modules based on config
    for (const moduleConfig of this.config.modules) {
      if (moduleConfig.enabled) {
        this.status.modules.push({
          name: moduleConfig.name,
          status: 'enabled',
          dependencies: moduleConfig.dependencies,
          lastUpdate: new Date()
        });
      }
    }
  }

  private async initializeServices(): Promise<void> {
    // Initialize services based on config
    for (const serviceConfig of this.config.services) {
      if (serviceConfig.enabled) {
        this.status.services.push({
          name: serviceConfig.name,
          status: 'stopped',
          uptime: 0,
          lastUpdate: new Date()
        });
      }
    }
  }

  private async initializePlugins(): Promise<void> {
    // Initialize plugins based on config
    for (const pluginConfig of this.config.plugins) {
      if (pluginConfig.enabled) {
        this.status.plugins.push({
          name: pluginConfig.name,
          status: 'disabled',
          version: '1.0.0',
          lastUpdate: new Date()
        });
      }
    }
  }

  private async startServices(): Promise<void> {
    // Start all enabled services
    for (const service of this.status.services) {
      service.status = 'running';
      service.lastUpdate = new Date();
    }
  }

  private async startPlugins(): Promise<void> {
    // Start all enabled plugins
    for (const plugin of this.status.plugins) {
      plugin.status = 'enabled';
      plugin.lastUpdate = new Date();
    }
  }

  private async stopServices(): Promise<void> {
    // Stop all services
    for (const service of this.status.services) {
      service.status = 'stopped';
      service.lastUpdate = new Date();
    }
  }

  private async stopPlugins(): Promise<void> {
    // Stop all plugins
    for (const plugin of this.status.plugins) {
      plugin.status = 'disabled';
      plugin.lastUpdate = new Date();
    }
  }

  private updateStatus(): void {
    if (this.startTime > 0) {
      this.status.uptime = Date.now() - this.startTime;
    }
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.status.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal
    };
  }
}

// Utility functions
export function createAppConfig(
  name: string = 'NUBI',
  version: string = '1.0.0',
  environment: 'development' | 'production' | 'test' = 'development'
): AppConfig {
  return {
    name,
    version,
    environment,
    modules: [],
    services: [],
    plugins: []
  };
}

export function createNubiApplication(config: AppConfig): NubiApplication {
  return new NubiApplication(config);
}

// Default application instance
export const defaultApp = createNubiApplication(createAppConfig());
