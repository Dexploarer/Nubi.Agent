import { Scraper } from 'agent-twitter-client';
import { AuthConfig } from '../types.js';
export declare class SmartAuthenticationManager {
    private cookieManager;
    private scraper;
    constructor();
    /**
     * Smart authentication: tries cookies first, falls back to credentials, saves new cookies
     */
    authenticate(config?: AuthConfig): Promise<Scraper>;
    /**
     * Get the current authenticated scraper instance
     */
    getScraper(): Scraper | null;
    /**
     * Check if the current scraper is authenticated
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Re-authenticate if the current session is invalid
     */
    reAuthenticate(config?: AuthConfig): Promise<Scraper>;
    /**
     * Clear all saved authentication data
     */
    clearAuthData(): void;
    /**
     * Get authentication status and details
     */
    getAuthStatus(): Promise<{
        authenticated: boolean;
        hasSavedCookies: boolean;
        cookiesValid: boolean;
    }>;
    /**
     * Force cookie extraction from current session
     */
    extractAndSaveCookies(): Promise<boolean>;
}
export declare const smartAuth: SmartAuthenticationManager;
