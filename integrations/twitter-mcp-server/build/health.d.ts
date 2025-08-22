import { AuthConfig } from './types.js';
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
export declare class HealthCheckService {
    private static instance;
    private lastSuccessfulAuth;
    private lastActivity;
    private errors;
    private constructor();
    static getInstance(): HealthCheckService;
    recordActivity(): void;
    recordAuthSuccess(): void;
    recordError(error: string): void;
    getHealthStatus(): Promise<HealthStatus>;
    getAuthStatus(): Promise<AuthStatus>;
    private determineHealthStatus;
    clearErrors(): void;
}
export declare const healthCheck: HealthCheckService;
export declare function performHealthCheck(authConfig?: AuthConfig): Promise<{
    status: string;
    authenticated: boolean;
    authMethod?: string;
    message: string;
    timestamp: string;
}>;
export declare function getAuthenticationStatus(): Promise<AuthStatus>;
export {};
