import { Scraper } from 'agent-twitter-client';
import { AuthConfig } from './types.js';
export declare class AuthenticationManager {
    private static instance;
    private scraperInstances;
    private smartAuthManagers;
    private constructor();
    static getInstance(): AuthenticationManager;
    /**
     * Get or create a scraper instance using smart authentication
     */
    getScraper(config: AuthConfig): Promise<Scraper>;
    /**
     * Legacy authentication method (for backward compatibility)
     */
    private authenticate;
    private authenticateWithCookies;
    private authenticateWithCredentials;
    private getScraperKey;
    /**
     * Clear all authentication instances
     */
    clearAll(): void;
    /**
     * Get authentication status for a specific config
     */
    getAuthStatus(config: AuthConfig): Promise<{
        authenticated: boolean;
        hasSavedCookies: boolean;
        cookiesValid: boolean;
    }>;
    /**
     * Force re-authentication for a specific config
     */
    reAuthenticate(config: AuthConfig): Promise<Scraper>;
}
