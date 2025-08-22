import { AuthConfig } from './types.js';
import { logger } from './utils/logger.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  authentication: {
    isAuthenticated: boolean;
    method: string | null;
    lastSuccessfulAuth: string | null;
    cookiesValid: boolean;
  };
  client: {
    connected: boolean;
    lastActivity: string | null;
  };
  errors: string[];
}

interface AuthStatus {
  authenticated: boolean;
  authMethod: string | null;
  username: string | null;
  cookiesPresent: boolean;
  cookiesValid: boolean;
  requiresReauth: boolean;
  lastVerified: string;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private lastSuccessfulAuth: Date | null = null;
  private lastActivity: Date | null = null;
  private errors: string[] = [];

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  recordActivity(): void {
    this.lastActivity = new Date();
  }

  recordAuthSuccess(): void {
    this.lastSuccessfulAuth = new Date();
    this.errors = this.errors.filter(e => !e.includes('auth'));
  }

  recordError(error: string): void {
    this.errors.push(`[${new Date().toISOString()}] ${error}`);
    // Keep only last 10 errors
    if (this.errors.length > 10) {
      this.errors.shift();
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    // Import dynamically to avoid circular dependencies
    const { SmartAuthenticationManager } = await import('./auth/smart-authentication.js');
    const authManager = new SmartAuthenticationManager();
    
    let isAuthenticated = false;
    let authMethod: string | null = null;
    let cookiesValid = false;

    try {
      const scraper = authManager.getScraper();
      if (scraper) {
        isAuthenticated = await scraper.isLoggedIn();
        // Infer method
        const status = await authManager.getAuthStatus();
        if (status.hasSavedCookies) {
          authMethod = 'cookies';
          cookiesValid = status.cookiesValid;
        } else if (process.env.TWITTER_USERNAME && process.env.TWITTER_PASSWORD) {
          authMethod = 'credentials';
          cookiesValid = status.cookiesValid;
        } else {
          authMethod = null;
        }
      }
    } catch (error) {
      logger.error('Health check error:', error);
      this.recordError(`Health check failed: ${error}`);
    }

    const status = this.determineHealthStatus(isAuthenticated, cookiesValid);

    return {
      status,
      timestamp: new Date().toISOString(),
      authentication: {
        isAuthenticated,
        method: authMethod,
        lastSuccessfulAuth: this.lastSuccessfulAuth?.toISOString() || null,
        cookiesValid
      },
      client: {
        connected: isAuthenticated,
        lastActivity: this.lastActivity?.toISOString() || null
      },
      errors: this.errors.slice(-5) // Return last 5 errors
    };
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const { SmartAuthenticationManager } = await import('./auth/smart-authentication.js');
    const authManager = new SmartAuthenticationManager();
    
    let authenticated = false;
    let username: string | null = process.env.TWITTER_USERNAME || null;
    let cookiesValid = false;
    let cookiesPresent = false;
    let authMethod: string | null = null;

    try {
      const scraper = authManager.getScraper();
      if (scraper) {
        authenticated = await scraper.isLoggedIn();
        const cookies = await scraper.getCookies();
        cookiesPresent = cookies.length > 0;
        cookiesValid = cookies.some((c: any) => (c.key === 'auth_token' || c.key === 'ct0') && c.value);
      }

      const status = await authManager.getAuthStatus();
      if (status.hasSavedCookies) {
        authMethod = 'cookies';
      } else if (process.env.TWITTER_USERNAME && process.env.TWITTER_PASSWORD) {
        authMethod = 'credentials';
      } else {
        authMethod = null;
      }
    } catch (error) {
      logger.error('Auth status check error:', error);
    }

    const requiresReauth = !authenticated || 
      (authMethod === 'cookies' && !cookiesValid);

    return {
      authenticated,
      authMethod,
      username,
      cookiesPresent,
      cookiesValid,
      requiresReauth,
      lastVerified: new Date().toISOString()
    };
  }

  private determineHealthStatus(
    isAuthenticated: boolean, 
    cookiesValid: boolean
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (!isAuthenticated) {
      return 'unhealthy';
    }
    
    if (this.errors.length > 5) {
      return 'degraded';
    }

    if (!cookiesValid && this.lastSuccessfulAuth) {
      const hoursSinceAuth = 
        (Date.now() - this.lastSuccessfulAuth.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAuth > 24) {
        return 'degraded';
      }
    }

    return 'healthy';
  }

  clearErrors(): void {
    this.errors = [];
  }
}

// Export singleton instance
export const healthCheck = HealthCheckService.getInstance();

// Legacy performHealthCheck function for backward compatibility
export async function performHealthCheck(authConfig?: AuthConfig): Promise<{
  status: string;
  authenticated: boolean;
  authMethod?: string;
  message: string;
  timestamp: string;
}> {
  const status = await healthCheck.getHealthStatus();
  
  return {
    status: status.status,
    authenticated: status.authentication.isAuthenticated,
    authMethod: status.authentication.method || undefined,
    message: status.status === 'healthy' 
      ? 'Server is healthy and authenticated' 
      : status.status === 'degraded'
      ? 'Server is running with degraded performance'
      : 'Server is unhealthy - authentication required',
    timestamp: status.timestamp
  };
}

// New auth status check function
export async function getAuthenticationStatus(): Promise<AuthStatus> {
  return await healthCheck.getAuthStatus();
}
