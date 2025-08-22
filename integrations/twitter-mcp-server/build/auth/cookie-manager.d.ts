import { Scraper } from 'agent-twitter-client';
export declare class CookieManager {
    private envFilePath;
    constructor(envFilePath?: string);
    /**
     * Extract essential Twitter cookies from a logged-in scraper instance
     */
    extractCookies(scraper: Scraper): Promise<string[] | null>;
    /**
     * Save cookies to environment file
     */
    saveCookies(cookies: string[]): boolean;
    /**
     * Load saved cookies from environment file
     */
    loadCookies(): string[] | null;
    /**
     * Validate if saved cookies are still functional
     */
    validateSavedCookies(): Promise<boolean>;
    /**
     * Clear saved cookies from environment file
     */
    clearCookies(): boolean;
    /**
     * Manual cookie helper - formats cookies for saving
     */
    formatCookiesForSaving(cookieStrings: string[]): string[];
    /**
     * Helper to validate cookie format
     */
    validateCookieFormat(cookies: string[]): boolean;
}
