import { Scraper } from 'agent-twitter-client';
import { CookieManager } from './cookie-manager.js';

export class SmartAuthenticationManager {
  constructor() {
    this.cookieManager = new CookieManager();
    this.scraper = null;
  }

  /**
   * Smart authentication: tries cookies first, falls back to credentials, saves new cookies
   */
  async authenticate() {
    const scraper = new Scraper();
    
    // Step 1: Try to use saved cookies first
    console.log('🔄 Starting smart authentication...');
    
    const savedCookies = this.cookieManager.loadCookies();
    if (savedCookies && await this.cookieManager.validateSavedCookies()) {
      console.log('🍪 Attempting authentication with saved cookies...');
      
      try {
        await scraper.setCookies(savedCookies);
        const isLoggedIn = await scraper.isLoggedIn();
        
        if (isLoggedIn) {
          console.log('✅ Successfully authenticated with saved cookies!');
          this.scraper = scraper;
          return scraper;
        } else {
          console.log('⚠️  Saved cookies are invalid, falling back to credentials...');
        }
      } catch (error) {
        console.log('⚠️  Cookie authentication failed, falling back to credentials...');
        console.log('Cookie error:', error.message);
      }
    } else {
      console.log('📝 No valid saved cookies found, using credential authentication...');
    }

    // Step 2: Fall back to credential authentication
    const username = process.env.TWITTER_USERNAME;
    const password = process.env.TWITTER_PASSWORD;
    const email = process.env.TWITTER_EMAIL;
    const twoFactorSecret = process.env.TWITTER_2FA_SECRET;

    if (!username || !password) {
      throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD must be set in environment variables');
    }

    console.log('🔑 Attempting credential authentication...');
    
    try {
      await scraper.login(username, password, email, twoFactorSecret);
      
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Login failed - scraper reports not logged in');
      }
      
      console.log('✅ Successfully authenticated with credentials!');
      
      // Step 3: Extract and save cookies for future use
      console.log('🍪 Extracting cookies for future use...');
      
      try {
        const extractedCookies = await this.cookieManager.extractCookies(scraper);
        if (extractedCookies) {
          await this.cookieManager.saveCookies(extractedCookies);
          console.log('✅ Cookies saved! Future authentications will be faster.');
        } else {
          console.log('⚠️  Could not extract cookies, will use credentials next time');
        }
      } catch (cookieError) {
        console.warn('Cookie extraction failed:', cookieError.message);
        console.log('⚠️  Will use credentials for future authentications');
      }
      
      this.scraper = scraper;
      return scraper;
      
    } catch (error) {
      console.error('❌ Credential authentication failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Get the authenticated scraper instance
   */
  getScraper() {
    if (!this.scraper) {
      throw new Error('No authenticated scraper available. Call authenticate() first.');
    }
    return this.scraper;
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated() {
    if (!this.scraper) {
      return false;
    }
    
    try {
      return await this.scraper.isLoggedIn();
    } catch (error) {
      return false;
    }
  }

  /**
   * Force re-authentication (useful when cookies expire)
   */
  async reAuthenticate() {
    this.scraper = null;
    return await this.authenticate();
  }
}