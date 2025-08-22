import { AuthConfig } from '../types.js';
export declare class ProfileTools {
    private client;
    constructor();
    /**
     * Get a user profile
     */
    getUserProfile(authConfig: AuthConfig, args: unknown): Promise<{
        profile: import("../types.js").ProfileResponse;
    }>;
    /**
     * Follow a user
     */
    followUser(authConfig: AuthConfig, args: unknown): Promise<import("../types.js").FollowResponse>;
    /**
     * Get a user's followers
     */
    getFollowers(authConfig: AuthConfig, args: unknown): Promise<{
        profiles: import("../types.js").ProfileResponse[];
        count: number;
        userId: string;
    }>;
    /**
     * Get a user's following
     */
    getFollowing(authConfig: AuthConfig, args: unknown): Promise<{
        profiles: import("../types.js").ProfileResponse[];
        count: number;
        userId: string;
    }>;
}
