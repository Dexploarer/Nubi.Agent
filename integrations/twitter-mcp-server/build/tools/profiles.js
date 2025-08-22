import { GetUserProfileSchema, FollowUserSchema, GetFollowersSchema, GetFollowingSchema, } from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput } from '../utils/validators.js';
export class ProfileTools {
    client;
    constructor() {
        this.client = new TwitterClient();
    }
    /**
     * Get a user profile
     */
    async getUserProfile(authConfig, args) {
        const params = validateInput(GetUserProfileSchema, args);
        const profile = await this.client.getUserProfile(authConfig, params.username);
        return {
            profile,
        };
    }
    /**
     * Follow a user
     */
    async followUser(authConfig, args) {
        const params = validateInput(FollowUserSchema, args);
        const result = await this.client.followUser(authConfig, params.username);
        return result;
    }
    /**
     * Get a user's followers
     */
    async getFollowers(authConfig, args) {
        const params = validateInput(GetFollowersSchema, args);
        const profiles = await this.client.getFollowers(authConfig, params.userId, params.count);
        return {
            profiles,
            count: profiles.length,
            userId: params.userId,
        };
    }
    /**
     * Get a user's following
     */
    async getFollowing(authConfig, args) {
        const params = validateInput(GetFollowingSchema, args);
        const profiles = await this.client.getFollowing(authConfig, params.userId, params.count);
        return {
            profiles,
            count: profiles.length,
            userId: params.userId,
        };
    }
}
//# sourceMappingURL=profiles.js.map