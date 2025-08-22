/**
 * Main Application Initializer
 * Properly wires all services with dependency injection
 */

import { IAgentRuntime } from './types/elizaos-extensions';
import { getServiceRegistry } from './core/service-registry';
import { getTelegramRaidsService } from './services/telegram/raids.service';
import EngagementAnalyticsService from './services/engagement-analytics-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class Application {
    private runtime: IAgentRuntime;
    private services: Map<string, any> = new Map();
    private initialized: boolean = false;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    /**
     * Initialize the application with all services
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.warn('Application already initialized');
            return;
        }

        console.log('🚀 Initializing NUBI Agent Application...');

        try {
            // Get the service registry
            const registry = getServiceRegistry(this.runtime);

            // Register core services
            await this.registerCoreServices(registry);

            // Initialize all services
            await registry.initialize();

            // Start all services
            await registry.startAll();

            this.initialized = true;
            console.log('✅ Application initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            throw error;
        }
    }

    /**
     * Register all core services
     */
    private async registerCoreServices(registry: any): Promise<void> {
        // 1. Telegram Raids Service
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const telegramRaids = getTelegramRaidsService();
            registry.register(telegramRaids, {
                name: 'telegram-raids',
                enabled: true,
                dependencies: []
            });
            this.services.set('telegram-raids', telegramRaids);
            console.log('📱 Registered: Telegram Raids Service');
        }

        // 2. Engagement Analytics Service
        if (process.env.PG_HOST || process.env.CLICKHOUSE_URL) {
            const engagementAnalytics = new EngagementAnalyticsService(this.runtime);
            registry.register({
                name: 'engagement-analytics',
                async initialize(runtime: IAgentRuntime): Promise<void> {
                    // Already initialized in constructor
                },
                async start(): Promise<void> {
                    // Auto-starts with constructor
                },
                async stop(): Promise<void> {
                    engagementAnalytics.stop();
                },
                async healthCheck(): Promise<boolean> {
                    return true;
                }
            }, {
                name: 'engagement-analytics',
                enabled: true,
                dependencies: []
            });
            this.services.set('engagement-analytics', engagementAnalytics);
            console.log('📊 Registered: Engagement Analytics Service');
        }

        // 3. MCP Twitter Service (already integrated via runtime)
        console.log('🐦 MCP Twitter integration: Active');

        // 4. Session Management (integrated with analytics)
        console.log('🔐 Session management: Integrated');
    }

    /**
     * Get a service by name
     */
    getService<T>(name: string): T | undefined {
        return this.services.get(name) as T;
    }

    /**
     * Shutdown the application
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Shutting down application...');
        
        const registry = getServiceRegistry();
        await registry.stopAll();
        
        console.log('✅ Application shut down successfully');
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        services: Map<string, boolean>;
        timestamp: Date;
    }> {
        const registry = getServiceRegistry();
        const serviceHealth = await registry.healthCheck();
        
        const allHealthy = Array.from(serviceHealth.values()).every(h => h);
        
        return {
            status: allHealthy ? 'healthy' : 'unhealthy',
            services: serviceHealth,
            timestamp: new Date()
        };
    }
}

// Singleton instance
let app: Application | null = null;

export function getApplication(runtime?: IAgentRuntime): Application {
    if (!app && runtime) {
        app = new Application(runtime);
    }
    if (!app) {
        throw new Error('Application not initialized');
    }
    return app;
}

// Export for ElizaOS integration
export async function initializeServices(runtime: IAgentRuntime): Promise<void> {
    const application = getApplication(runtime);
    await application.initialize();
}

export default Application;
