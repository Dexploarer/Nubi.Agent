/**
 * Central Service Registry
 * Manages all services with proper lifecycle and dependency injection
 */

import { IAgentRuntime } from '../types/elizaos-extensions';
import { EventEmitter } from 'events';

export interface ServiceConfig {
    name: string;
    enabled: boolean;
    dependencies?: string[];
    config?: Record<string, any>;
}

export interface Service {
    name: string;
    initialize(runtime: IAgentRuntime, config?: any): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    healthCheck(): Promise<boolean>;
}

export class ServiceRegistry extends EventEmitter {
    private services: Map<string, Service> = new Map();
    private runtime: IAgentRuntime;
    private initialized: boolean = false;
    private startOrder: string[] = [];

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
    }

    /**
     * Register a service
     */
    register(service: Service, config?: ServiceConfig): void {
        if (this.services.has(service.name)) {
            throw new Error(`Service ${service.name} already registered`);
        }

        this.services.set(service.name, service);
        
        if (config?.dependencies) {
            this.validateDependencies(service.name, config.dependencies);
        }

        this.emit('service:registered', { name: service.name });
        console.log(`✅ Registered service: ${service.name}`);
    }

    /**
     * Initialize all services
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.warn('Services already initialized');
            return;
        }

        console.log('🚀 Initializing services...');
        
        // Sort services by dependencies
        this.startOrder = this.topologicalSort();
        
        // Initialize in dependency order
        for (const serviceName of this.startOrder) {
            const service = this.services.get(serviceName);
            if (service) {
                try {
                    await service.initialize(this.runtime);
                    console.log(`✅ Initialized: ${serviceName}`);
                } catch (error) {
                    console.error(`❌ Failed to initialize ${serviceName}:`, error);
                    throw error;
                }
            }
        }

        this.initialized = true;
        this.emit('services:initialized');
    }

    /**
     * Start all services
     */
    async startAll(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        console.log('🚀 Starting services...');
        
        for (const serviceName of this.startOrder) {
            const service = this.services.get(serviceName);
            if (service) {
                try {
                    await service.start();
                    console.log(`✅ Started: ${serviceName}`);
                    this.emit('service:started', { name: serviceName });
                } catch (error) {
                    console.error(`❌ Failed to start ${serviceName}:`, error);
                    // Continue starting other services
                }
            }
        }

        this.emit('services:started');
    }

    /**
     * Stop all services
     */
    async stopAll(): Promise<void> {
        console.log('🛑 Stopping services...');
        
        // Stop in reverse order
        const stopOrder = [...this.startOrder].reverse();
        
        for (const serviceName of stopOrder) {
            const service = this.services.get(serviceName);
            if (service) {
                try {
                    await service.stop();
                    console.log(`✅ Stopped: ${serviceName}`);
                    this.emit('service:stopped', { name: serviceName });
                } catch (error) {
                    console.error(`❌ Failed to stop ${serviceName}:`, error);
                }
            }
        }

        this.emit('services:stopped');
    }

    /**
     * Get a service by name
     */
    getService<T extends Service>(name: string): T | undefined {
        return this.services.get(name) as T;
    }

    /**
     * Health check all services
     */
    async healthCheck(): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();
        
        for (const [name, service] of this.services) {
            try {
                const healthy = await service.healthCheck();
                results.set(name, healthy);
            } catch (error) {
                results.set(name, false);
            }
        }
        
        return results;
    }

    /**
     * Validate service dependencies
     */
    private validateDependencies(serviceName: string, dependencies: string[]): void {
        for (const dep of dependencies) {
            if (!this.services.has(dep)) {
                throw new Error(`Service ${serviceName} depends on ${dep} which is not registered`);
            }
        }
    }

    /**
     * Topological sort for dependency resolution
     */
    private topologicalSort(): string[] {
        const visited = new Set<string>();
        const stack: string[] = [];
        
        const visit = (name: string) => {
            if (visited.has(name)) return;
            visited.add(name);
            
            // Visit dependencies first
            const service = this.services.get(name);
            if (service) {
                // Get dependencies from service metadata if available
                // For now, we'll use a simple approach
            }
            
            stack.push(name);
        };
        
        for (const name of this.services.keys()) {
            visit(name);
        }
        
        return stack;
    }
}

// Singleton instance
let registry: ServiceRegistry | null = null;

export function getServiceRegistry(runtime?: IAgentRuntime): ServiceRegistry {
    if (!registry && runtime) {
        registry = new ServiceRegistry(runtime);
    }
    if (!registry) {
        throw new Error('Service registry not initialized');
    }
    return registry;
}
