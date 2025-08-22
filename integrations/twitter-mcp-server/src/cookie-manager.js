import fs from 'fs';
import path from 'path';

export class CookieManager {
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
        const cookie = allCookies.find(c => {
          // Handle different cookie object formats
          const name = c.name || c.key || Object.keys(c)[0];
          return name === cookieName;
        });

        if (cookie) {
          const name = cookie.name || cookie.key || Object.keys(cookie)[0];
          const value = cookie.value || cookie[name];
          const domain = cookie.domain || '.twitter.com';
          
          // Format for MCP server consumption
          const formattedCookie = `${name}=${value}; Domain=${domain}`;
          essentialCookies.push(formattedCookie);
          
          console.log(`✅ Found ${name}: ${value.substring(0, 10)}...`);
        } else {
          console.warn(`⚠️  Missing essential cookie: ${cookieName}`);
        }
      }

      // Validate we have the minimum required cookies
      const hasAuthToken = essentialCookies.some(c => c.startsWith('auth_token='));
      const hasCt0 = essentialCookies.some(c => c.startsWith('ct0='));
      const hasTwid = essentialCookies.some(c => c.startsWith('twid='));

      if (!hasAuthToken || !hasCt0) {
        console.error('❌ Missing critical authentication cookies (auth_token and/or ct0)');
        console.log('Available cookies:', essentialCookies);
        return null;
      }

      if (!hasTwid) {
        console.warn('⚠️  Missing twid cookie - may affect some operations');
      }

      console.log(`✅ Successfully extracted ${essentialCookies.length} essential cookies`);
      return essentialCookies;
      
    } catch (error) {
      console.error('❌ Error extracting cookies:', error.message);
      console.error('Stack trace:', error.stack);
      return null;
    }
  }

  /**
   * Save cookies to the .env file
   */
  async saveCookies(cookies) {
    if (!cookies || cookies.length === 0) {
      return false;
    }

    try {
      // Read current .env file
      const envContent = fs.readFileSync(this.envFilePath, 'utf8');
      
      // Prepare cookie string for .env format
      const cookieString = JSON.stringify(cookies);
      
      // Update or add TWITTER_COOKIES line
      let updatedContent;
      if (envContent.includes('TWITTER_COOKIES=')) {
        // Replace existing TWITTER_COOKIES line
        updatedContent = envContent.replace(
          /TWITTER_COOKIES=.*/,
          `TWITTER_COOKIES=${cookieString}`
        );
      } else {
        // Add TWITTER_COOKIES line
        updatedContent = envContent + `\nTWITTER_COOKIES=${cookieString}\n`;
      }

      // Write back to .env file
      fs.writeFileSync(this.envFilePath, updatedContent);
      
      console.log('✅ Cookies saved to .env file for future use');
      return true;
    } catch (error) {
      console.error('Error saving cookies to .env file:', error);
      return false;
    }
  }

  /**
   * Load cookies from .env file
   */
  loadCookies() {
    try {
      const envContent = fs.readFileSync(this.envFilePath, 'utf8');
      const match = envContent.match(/TWITTER_COOKIES=(.+)/);
      
      if (match && match[1] && match[1].trim() && match[1] !== '""' && match[1] !== "''") {
        const cookieString = match[1].trim();
        
        // Parse the JSON array directly
        const cookies = JSON.parse(cookieString);
        
        if (Array.isArray(cookies) && cookies.length > 0) {
          console.log('📚 Loaded saved cookies from .env file');
          return cookies;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Could not load cookies from .env file:', error.message);
      return null;
    }
  }

  /**
   * Check if saved cookies are valid Twitter authentication cookies
   */
  async validateSavedCookies() {
    const cookies = this.loadCookies();
    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      console.log('📝 No cookies to validate');
      return false;
    }

    console.log('🔍 Validating saved cookies...');

    // Extract cookie names and values
    const cookieData = {};
    for (const cookie of cookies) {
      const match = cookie.match(/^([^=]+)=([^;]+)/);
      if (match) {
        const [, name, value] = match;
        cookieData[name] = value;
      }
    }

    // Check for essential cookies
    const hasAuthToken = 'auth_token' in cookieData;
    const hasCt0 = 'ct0' in cookieData;
    const hasTwid = 'twid' in cookieData;

    console.log('Cookie validation results:');
    console.log(`  auth_token: ${hasAuthToken ? '✅' : '❌'}`);
    console.log(`  ct0: ${hasCt0 ? '✅' : '❌'}`);
    console.log(`  twid: ${hasTwid ? '✅' : '❌'}`);

    // Validate auth_token format (should be long hex string)
    if (hasAuthToken) {
      const authToken = cookieData.auth_token;
      if (authToken.length < 30 || !/^[a-f0-9]+$/i.test(authToken)) {
        console.warn('⚠️  auth_token format looks invalid (should be hex string, 30+ chars)');
      } else {
        console.log('✅ auth_token format valid');
      }
    }

    // Validate ct0 format (should be 32-char hex string)
    if (hasCt0) {
      const ct0 = cookieData.ct0;
      if (ct0.length !== 32 || !/^[a-f0-9]+$/i.test(ct0)) {
        console.warn('⚠️  ct0 format looks invalid (should be 32-char hex string)');
      } else {
        console.log('✅ ct0 format valid');
      }
    }

    // Validate twid format (should contain user ID)
    if (hasTwid) {
      const twid = cookieData.twid;
      if (!twid.includes('u%3D') && !twid.includes('u=')) {
        console.warn('⚠️  twid format looks invalid (should contain user ID)');
      } else {
        console.log('✅ twid format valid');
      }
    }

    // Minimum requirement: auth_token and ct0
    const isValid = hasAuthToken && hasCt0;
    
    if (isValid) {
      console.log('✅ Saved cookies validation: PASSED');
    } else {
      console.log('❌ Saved cookies validation: FAILED - missing essential cookies');
    }
    
    return isValid;
  }
}