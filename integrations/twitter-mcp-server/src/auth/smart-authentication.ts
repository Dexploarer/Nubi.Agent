import { Scraper } from 'agent-twitter-client';
import { CookieManager } from './cookie-manager.js';
import {
  AuthConfig,
  CredentialsAuth,
  CookieAuth,
  TwitterMcpError,
  isCookieAuth,
  isCredentialsAuth,
} from '../types.js';

export class SmartAuthenticationManager {
  private cookieManager: CookieManager;
  private scraper: Scraper | null = null;

  constructor() {
    this.cookieManager = new CookieManager();
  }

  /**
   * Smart authentication: tries cookies first, falls back to credentials, saves new cookies
   */
  async authenticate(config?: AuthConfig): Promise<Scraper> {
    console.log('🔄 Starting smart authentication...');

    const scraper = new Scraper();

    // Step 1: Try to use saved cookies first
    const savedCookies = this.cookieManager.loadCookies();
    if (savedCookies && (await this.cookieManager.validateSavedCookies())) {
      console.log('🍪 Attempting authentication with saved cookies...');

      try {
        await scraper.setCookies(savedCookies);
        const isLoggedIn = await scraper.isLoggedIn();

        if (isLoggedIn) {
          console.log('✅ Successfully authenticated with saved cookies!');
          this.scraper = scraper;
          return scraper;
        }
      } catch (error) {
        console.warn('⚠️  Saved cookies failed, falling back to credentials...', error);
      }
    }

    // Step 2: Fall back to credential authentication
    if (config && isCredentialsAuth(config)) {
      console.log('🔑 Attempting authentication with credentials...');

      try {
        await scraper.login(config.username, config.password, config.email);
        const isLoggedIn = await scraper.isLoggedIn();

        if (isLoggedIn) {
          console.log('✅ Successfully authenticated with credentials!');

          // Step 3: Extract and save cookies for future use
          console.log('🍪 Extracting session cookies for future use...');
          const extractedCookies = await this.cookieManager.extractCookies(scraper);
          if (extractedCookies && extractedCookies.length > 0) {
            this.cookieManager.saveCookies(extractedCookies);
            console.log('💾 New cookies saved for future authentication - no more logins needed!');
          } else {
            console.warn('⚠️  Could not extract cookies, but login was successful');
          }

          this.scraper = scraper;
          return scraper;
        }
      } catch (error) {
        throw new TwitterMcpError(
          `Credential authentication failed: ${(error as Error).message}`,
          'auth_failure'
        );
      }
    }

    // Step 3: Try cookie authentication if provided in config
    if (config && isCookieAuth(config)) {
      console.log('🍪 Attempting authentication with provided cookies...');

      try {
        await scraper.setCookies(config.cookies);
        const isLoggedIn = await scraper.isLoggedIn();

        if (isLoggedIn) {
          console.log('✅ Successfully authenticated with provided cookies!');

          // Save these working cookies
          this.cookieManager.saveCookies(config.cookies);
          console.log('💾 Provided cookies saved for future use');

          this.scraper = scraper;
          return scraper;
        }
      } catch (error) {
        throw new TwitterMcpError(
          `Cookie authentication failed: ${(error as Error).message}`,
          'auth_failure'
        );
      }
    }

    // Step 4: If no config provided, try environment variables for credentials
    if (!config) {
      console.log('🔍 No config provided, checking environment variables...');
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      const email = process.env.TWITTER_EMAIL;

      if (username && password) {
        console.log('🔑 Found credentials in environment, attempting login...');
        try {
          await scraper.login(username, password, email);
          const isLoggedIn = await scraper.isLoggedIn();

          if (isLoggedIn) {
            console.log('✅ Successfully authenticated with environment credentials!');

            // Extract and save cookies
            console.log('🍪 Extracting session cookies for future use...');
            const extractedCookies = await this.cookieManager.extractCookies(scraper);
            if (extractedCookies && extractedCookies.length > 0) {
              this.cookieManager.saveCookies(extractedCookies);
              console.log('💾 New cookies saved - future sessions will be instant!');
            }

            this.scraper = scraper;
            return scraper;
          }
        } catch (error) {
          console.error('Failed to authenticate with environment credentials:', error);
        }
      }
    }

    throw new TwitterMcpError(
      'All authentication methods failed. Please provide valid credentials or cookies.',
      'auth_failure'
    );
  }

  /**
   * Get the current authenticated scraper instance
   */
  getScraper(): Scraper | null {
    return this.scraper;
  }

  /**
   * Check if the current scraper is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.scraper) return false;

    try {
      return await this.scraper.isLoggedIn();
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Re-authenticate if the current session is invalid
   */
  async reAuthenticate(config?: AuthConfig): Promise<Scraper> {
    console.log('🔄 Re-authenticating...');
    this.scraper = null;
    return await this.authenticate(config);
  }

  /**
   * Clear all saved authentication data
   */
  clearAuthData(): void {
    console.log('🗑️  Clearing authentication data...');
    this.cookieManager.clearCookies();
    this.scraper = null;
  }

  /**
   * Get authentication status and details
   */
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    hasSavedCookies: boolean;
    cookiesValid: boolean;
  }> {
    const authenticated = await this.isAuthenticated();
    const savedCookies = this.cookieManager.loadCookies();
    const hasSavedCookies = savedCookies !== null;
    const cookiesValid = hasSavedCookies ? await this.cookieManager.validateSavedCookies() : false;

    return {
      authenticated,
      hasSavedCookies,
      cookiesValid,
    };
  }

  /**
   * Force cookie extraction from current session
   */
  async extractAndSaveCookies(): Promise<boolean> {
    if (!this.scraper) {
      console.error('❌ No authenticated scraper available for cookie extraction');
      return false;
    }

    try {
      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        console.error('❌ Scraper is not logged in, cannot extract cookies');
        return false;
      }

      console.log('🍪 Manually extracting cookies from current session...');
      const extractedCookies = await this.cookieManager.extractCookies(this.scraper);

      if (extractedCookies && extractedCookies.length > 0) {
        this.cookieManager.saveCookies(extractedCookies);
        console.log('✅ Cookies extracted and saved successfully!');
        return true;
      } else {
        console.error('❌ Failed to extract cookies');
        return false;
      }
    } catch (error) {
      console.error('❌ Error during cookie extraction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const smartAuth = new SmartAuthenticationManager();
