import * as zod from 'zod';
// Tool Input Schemas
export const GetUserTweetsSchema = zod.object({
    username: zod.string().min(1, 'Username is required'),
    count: zod.number().int().min(1).max(200).default(20),
    includeReplies: zod.boolean().default(false),
    includeRetweets: zod.boolean().default(true)
});
export const GetTweetByIdSchema = zod.object({
    id: zod.string().min(1, 'Tweet ID is required')
});
export const SearchTweetsSchema = zod.object({
    query: zod.string().min(1, 'Search query is required'),
    count: zod.number().int().min(1).max(100).default(20),
    searchMode: zod.string().default('Top')
});
export const SendTweetSchema = zod.object({
    text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
    replyToTweetId: zod.string().optional(),
    media: zod.array(zod.object({
        data: zod.string(), // Base64 encoded media
        mediaType: zod.string() // MIME type
    })).optional()
});
export const SendTweetWithPollSchema = zod.object({
    text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
    replyToTweetId: zod.string().optional(),
    poll: zod.object({
        options: zod.array(zod.object({
            label: zod.string().min(1).max(25)
        })).min(2).max(4),
        durationMinutes: zod.number().int().min(5).max(10080).default(1440) // Default 24 hours
    })
});
export const LikeTweetSchema = zod.object({
    id: zod.string().min(1, 'Tweet ID is required')
});
export const RetweetSchema = zod.object({
    id: zod.string().min(1, 'Tweet ID is required')
});
export const QuoteTweetSchema = zod.object({
    text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
    quotedTweetId: zod.string().min(1, 'Quoted tweet ID is required'),
    media: zod.array(zod.object({
        data: zod.string(), // Base64 encoded media
        mediaType: zod.string() // MIME type
    })).optional()
});
export const GetUserProfileSchema = zod.object({
    username: zod.string().min(1, 'Username is required')
});
export const FollowUserSchema = zod.object({
    username: zod.string().min(1, 'Username is required')
});
export const GetFollowersSchema = zod.object({
    userId: zod.string().min(1, 'User ID is required'),
    count: zod.number().int().min(1).max(200).default(20)
});
export const GetFollowingSchema = zod.object({
    userId: zod.string().min(1, 'User ID is required'),
    count: zod.number().int().min(1).max(200).default(20)
});
export const GrokChatSchema = zod.object({
    message: zod.string().min(1, 'Message is required'),
    conversationId: zod.string().optional(),
    returnSearchResults: zod.boolean().default(true),
    returnCitations: zod.boolean().default(true)
});
// Error Types
export class TwitterMcpError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'TwitterMcpError';
    }
}
// Type guards
export function isCookieAuth(config) {
    return 'cookies' in config;
}
export function isCredentialsAuth(config) {
    return 'username' in config && 'password' in config;
}
export function isApiAuth(config) {
    return 'apiKey' in config;
}
//# sourceMappingURL=types.js.map