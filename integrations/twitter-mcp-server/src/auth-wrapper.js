import { SmartAuthenticationManager } from './smart-auth.js';

/**
 * Wrapper that provides smart authentication for the MCP server
 */
export class AuthWrapper {
  constructor() {
    this.smartAuth = new SmartAuthenticationManager();
    this.isInitialized = false;
  }

  /**
   * Initialize authentication - this will try cookies first, then credentials
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.smartAuth.authenticate();
      this.isInitialized = true;
      console.log('🎉 Smart authentication initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize authentication:', error.message);
      throw error;
    }
  }

  /**
   * Get the authentication config for the existing MCP server
   * This will return cookie config if available, otherwise credential config
   */
  getAuthConfig() {
    // First, try to load cookies if they exist
    const savedCookies = this.smartAuth.cookieManager.loadCookies();
    
    if (savedCookies && this.smartAuth.cookieManager.validateSavedCookies()) {
      console.log('📚 Using saved cookies for authentication');
      return {
        method: 'cookies',
        data: { cookies: savedCookies }
      };
    } else {
      console.log('🔑 Using credentials for authentication');
      // Fall back to credentials
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      const email = process.env.TWITTER_EMAIL;
      const twoFactorSecret = process.env.TWITTER_2FA_SECRET;

      if (!username || !password) {
        throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD are required');
      }

      return {
        method: 'credentials',
        data: {
          username,
          password,
          email,
          twoFactorSecret
        }
      };
    }
  }

  /**
   * Get scraper instance (for direct use)
   */
  getScraper() {
    return this.smartAuth.getScraper();
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated() {
    return await this.smartAuth.isAuthenticated();
  }

  /**
   * Force re-authentication
   */
  async reAuthenticate() {
    this.isInitialized = false;
    return await this.initialize();
  }
}