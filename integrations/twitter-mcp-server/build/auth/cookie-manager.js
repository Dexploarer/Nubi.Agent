import fs from 'fs';
import { Scraper } from 'agent-twitter-client';
export class CookieManager {
    envFilePath;
    constructor(envFilePath = '.env') {
        this.envFilePath = envFilePath;
    }
    /**
     * Extract essential Twitter cookies from a logged-in scraper instance
     */
    async extractCookies(scraper) {
        try {
            console.log('🍪 Extracting cookies from authenticated scraper...');
            // Get all cookies from the scraper
            const allCookies = await scraper.getCookies();
            if (!allCookies || allCookies.length === 0) {
                console.warn('⚠️  No cookies returned from scraper.getCookies()');
                return null;
            }
            console.log(`📋 Found ${allCookies.length} total cookies from scraper`);
            // Filter for the essential Twitter authentication cookies
            const essentialCookieNames = ['auth_token', 'ct0', 'twid'];
            const essentialCookies = [];
            for (const cookieName of essentialCookieNames) {
                const cookie = allCookies.find((c) => c.key === cookieName);
                if (cookie) {
                    // Format for MCP server consumption
                    const formattedCookie = `${cookie.key}=${cookie.value}; Domain=${cookie.domain || '.twitter.com'}`;
                    essentialCookies.push(formattedCookie);
                    console.log(`✅ Found ${cookie.key}: ${cookie.value.substring(0, 10)}...`);
                }
                else {
                    console.warn(`⚠️  Missing essential cookie: ${cookieName}`);
                }
            }
            if (essentialCookies.length === 0) {
                console.error('❌ No essential cookies found for Twitter authentication');
                return null;
            }
            console.log(`🎯 Extracted ${essentialCookies.length} essential cookies`);
            return essentialCookies;
        }
        catch (error) {
            console.error('❌ Error extracting cookies:', error);
            return null;
        }
    }
    /**
     * Save cookies to environment file
     */
    saveCookies(cookies) {
        try {
            console.log('💾 Saving cookies to environment file...');
            // Read current .env file
            let envContent = '';
            if (fs.existsSync(this.envFilePath)) {
                envContent = fs.readFileSync(this.envFilePath, 'utf-8');
            }
            // Format cookies as JSON array for environment variable
            const cookieJson = JSON.stringify(cookies);
            // Update or add TWITTER_COOKIES line
            const lines = envContent.split('\n');
            let foundCookieLine = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('TWITTER_COOKIES=')) {
                    lines[i] = `TWITTER_COOKIES=${cookieJson}`;
                    foundCookieLine = true;
                    break;
                }
            }
            if (!foundCookieLine) {
                lines.push(`TWITTER_COOKIES=${cookieJson}`);
            }
            // Write back to file
            fs.writeFileSync(this.envFilePath, lines.join('\n'));
            console.log('✅ Cookies saved successfully to .env file');
            return true;
        }
        catch (error) {
            console.error('❌ Error saving cookies:', error);
            return false;
        }
    }
    /**
     * Load saved cookies from environment file
     */
    loadCookies() {
        try {
            const cookiesEnv = process.env.TWITTER_COOKIES;
            if (!cookiesEnv) {
                console.log('ℹ️  No TWITTER_COOKIES found in environment');
                return null;
            }
            const cookies = JSON.parse(cookiesEnv);
            if (!Array.isArray(cookies) || cookies.length === 0) {
                console.warn('⚠️  Invalid or empty TWITTER_COOKIES format');
                return null;
            }
            console.log(`📥 Loaded ${cookies.length} cookies from environment`);
            return cookies;
        }
        catch (error) {
            console.error('❌ Error loading cookies:', error);
            return null;
        }
    }
    /**
     * Validate if saved cookies are still functional
     */
    async validateSavedCookies() {
        try {
            const cookies = this.loadCookies();
            if (!cookies)
                return false;
            // Create a temporary scraper to test cookies
            const testScraper = new Scraper();
            await testScraper.setCookies(cookies);
            // Test if we can perform a simple authenticated action
            const isLoggedIn = await testScraper.isLoggedIn();
            if (isLoggedIn) {
                console.log('✅ Saved cookies are valid and functional');
                return true;
            }
            else {
                console.warn('⚠️  Saved cookies appear to be expired or invalid');
                return false;
            }
        }
        catch (error) {
            console.error('❌ Error validating cookies:', error);
            return false;
        }
    }
    /**
     * Clear saved cookies from environment file
     */
    clearCookies() {
        try {
            if (!fs.existsSync(this.envFilePath)) {
                console.log('ℹ️  No .env file found to clear cookies from');
                return true;
            }
            const envContent = fs.readFileSync(this.envFilePath, 'utf-8');
            const lines = envContent.split('\n');
            const filteredLines = lines.filter((line) => !line.startsWith('TWITTER_COOKIES='));
            fs.writeFileSync(this.envFilePath, filteredLines.join('\n'));
            console.log('🗑️  Cleared cookies from .env file');
            return true;
        }
        catch (error) {
            console.error('❌ Error clearing cookies:', error);
            return false;
        }
    }
    /**
     * Manual cookie helper - formats cookies for saving
     */
    formatCookiesForSaving(cookieStrings) {
        return cookieStrings.map((cookie) => {
            // Ensure domain is set if not present
            if (!cookie.includes('Domain=')) {
                return `${cookie}; Domain=.twitter.com`;
            }
            return cookie;
        });
    }
    /**
     * Helper to validate cookie format
     */
    validateCookieFormat(cookies) {
        const requiredCookies = ['auth_token', 'ct0', 'twid'];
        const foundCookies = new Set();
        for (const cookie of cookies) {
            const cookieName = cookie.split('=')[0];
            if (requiredCookies.includes(cookieName)) {
                foundCookies.add(cookieName);
            }
        }
        const isValid = requiredCookies.every((name) => foundCookies.has(name));
        if (!isValid) {
            const missing = requiredCookies.filter((name) => !foundCookies.has(name));
            console.warn(`⚠️  Missing required cookies: ${missing.join(', ')}`);
        }
        return isValid;
    }
}
//# sourceMappingURL=cookie-manager.js.map