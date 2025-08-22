import { Scraper } from 'agent-twitter-client';
import {
  AuthConfig,
  CookieAuth,
  CredentialsAuth,
  ApiAuth,
  TwitterMcpError,
  isCookieAuth,
  isCredentialsAuth,
  isApiAuth
} from './types.js';
import { SmartAuthenticationManager } from './auth/smart-authentication.js';

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private scraperInstances = new Map<string, Scraper>();
  private smartAuthManagers = new Map<string, SmartAuthenticationManager>();

  private constructor() {}

  public static getInstance(): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager();
    }
    return AuthenticationManager.instance;
  }

  /**
   * Get or create a scraper instance using smart authentication
   */
  public async getScraper(config: AuthConfig): Promise<Scraper> {
    const key = this.getScraperKey(config);

    // Get existing smart auth manager or create new one
    let smartAuthManager = this.smartAuthManagers.get(key);
    if (!smartAuthManager) {
      smartAuthManager = new SmartAuthenticationManager();
      this.smartAuthManagers.set(key, smartAuthManager);
    }

    // Check if we have an existing authenticated scraper
    if (this.scraperInstances.has(key)) {
      const scraper = this.scraperInstances.get(key)!;
      try {
        const isLoggedIn = await scraper.isLoggedIn();
        if (isLoggedIn) {
          return scraper;
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      }
    }

    // Use smart authentication to get a scraper
    try {
      const scraper = await smartAuthManager.authenticate(config);
      this.scraperInstances.set(key, scraper);
      return scraper;
    } catch (error) {
      throw new TwitterMcpError(
        `Smart authentication failed: ${(error as Error).message}`,
        'auth_failure'
      );
    }
  }

  /**
   * Legacy authentication method (for backward compatibility)
   */
  private async authenticate(scraper: Scraper, config: AuthConfig): Promise<void> {
    if (isCookieAuth(config)) {
      await this.authenticateWithCookies(scraper, config);
    } else if (isCredentialsAuth(config)) {
      await this.authenticateWithCredentials(scraper, config);
    } else if (isApiAuth(config)) {
      throw new TwitterMcpError(
        'API authentication is not supported in this version. Please use cookies or credentials.',
        'auth_unsupported'
      );
    } else {
      throw new TwitterMcpError(
        'Invalid authentication configuration',
        'auth_invalid_config'
      );
    }
  }

  private async authenticateWithCookies(scraper: Scraper, config: CookieAuth): Promise<void> {
    try {
      await scraper.setCookies(config.cookies);
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Cookie authentication failed - user not logged in');
      }
    } catch (error) {
      throw new TwitterMcpError(
        `Cookie authentication failed: ${(error as Error).message}`,
        'auth_cookie_failed'
      );
    }
  }

  private async authenticateWithCredentials(scraper: Scraper, config: CredentialsAuth): Promise<void> {
    try {
      await scraper.login(config.username, config.password, config.email);
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Credential authentication failed - user not logged in');
      }
    } catch (error) {
      throw new TwitterMcpError(
        `Credential authentication failed: ${(error as Error).message}`,
        'auth_credentials_failed'
      );
    }
  }

  private getScraperKey(config: AuthConfig): string {
    if (isCookieAuth(config)) {
      return `cookies_${config.cookies.join('_').substring(0, 50)}`;
    } else if (isCredentialsAuth(config)) {
      return `credentials_${config.username}`;
    } else if (isApiAuth(config)) {
      return `api_${config.apiKey.substring(0, 10)}`;
    }
    return 'default';
  }

  /**
   * Clear all authentication instances
   */
  public clearAll(): void {
    console.log('🗑️  Clearing all authentication instances...');
    
    // Clear smart auth managers
    for (const [key, smartAuth] of this.smartAuthManagers.entries()) {
      smartAuth.clearAuthData();
    }
    
    this.scraperInstances.clear();
    this.smartAuthManagers.clear();
  }

  /**
   * Get authentication status for a specific config
   */
  public async getAuthStatus(config: AuthConfig): Promise<{
    authenticated: boolean;
    hasSavedCookies: boolean;
    cookiesValid: boolean;
  }> {
    const key = this.getScraperKey(config);
    const smartAuthManager = this.smartAuthManagers.get(key);
    
    if (smartAuthManager) {
      return await smartAuthManager.getAuthStatus();
    }
    
    return {
      authenticated: false,
      hasSavedCookies: false,
      cookiesValid: false
    };
  }

  /**
   * Force re-authentication for a specific config
   */
  public async reAuthenticate(config: AuthConfig): Promise<Scraper> {
    const key = this.getScraperKey(config);
    
    // Remove existing instances
    this.scraperInstances.delete(key);
    
    const smartAuthManager = this.smartAuthManagers.get(key);
    if (smartAuthManager) {
      return await smartAuthManager.reAuthenticate(config);
    }
    
    // If no smart auth manager exists, create one and authenticate
    return await this.getScraper(config);
  }
}
