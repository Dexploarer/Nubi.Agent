import { GetUserTweetsSchema, GetTweetByIdSchema, SearchTweetsSchema, SendTweetSchema, SendTweetWithPollSchema, LikeTweetSchema, RetweetSchema, QuoteTweetSchema, } from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput, validateMediaData, validatePollOptions } from '../utils/validators.js';
export class TweetTools {
    client;
    constructor() {
        this.client = new TwitterClient();
    }
    /**
     * Get tweets from a user
     */
    async getUserTweets(authConfig, args) {
        const params = validateInput(GetUserTweetsSchema, args);
        const tweets = await this.client.getUserTweets(authConfig, params.username, params.count, params.includeReplies, params.includeRetweets);
        return {
            tweets,
            count: tweets.length,
            username: params.username,
        };
    }
    /**
     * Get a specific tweet by ID
     */
    async getTweetById(authConfig, args) {
        const params = validateInput(GetTweetByIdSchema, args);
        const tweet = await this.client.getTweetById(authConfig, params.id);
        return {
            tweet,
        };
    }
    /**
     * Search for tweets
     */
    async searchTweets(authConfig, args) {
        const params = validateInput(SearchTweetsSchema, args);
        const searchResults = await this.client.searchTweets(authConfig, params.query, params.count, params.searchMode);
        return searchResults;
    }
    /**
     * Send a tweet
     */
    async sendTweet(authConfig, args) {
        const params = validateInput(SendTweetSchema, args);
        // Validate media if present
        if (params.media && params.media.length > 0) {
            validateMediaData(params.media);
        }
        const tweet = await this.client.sendTweet(authConfig, params.text, params.replyToTweetId, params.media);
        return {
            tweet,
            success: true,
            message: 'Tweet sent successfully',
        };
    }
    /**
     * Post a viral raid tweet and return the permanent X link
     */
    async postRaidTweet(authConfig, args) {
        // expects: { message: string, hashtags?: string[] }
        const input = args;
        if (!input?.message || typeof input.message !== 'string') {
            throw new Error('message is required');
        }
        const tags = (input.hashtags && Array.isArray(input.hashtags)
            ? input.hashtags
            : ['#AnubisChat', '#Anubis', '#anubisai', '#OpenSource']).join(' ');
        const text = `${input.message}

${tags}`.trim();
        const tweet = await this.client.sendTweet(authConfig, text);
        return {
            success: true,
            tweet,
            x_link: tweet.permanentUrl,
            message: 'Raid tweet posted successfully',
        };
    }
    /**
     * Send a tweet with poll
     */
    async sendTweetWithPoll(authConfig, args) {
        const params = validateInput(SendTweetWithPollSchema, args);
        // Validate poll options
        validatePollOptions(params.poll.options);
        const tweet = await this.client.sendTweetWithPoll(authConfig, params.text, params.poll, params.replyToTweetId);
        return {
            tweet,
            success: true,
            message: 'Tweet with poll sent successfully',
        };
    }
    /**
     * Like a tweet
     */
    async likeTweet(authConfig, args) {
        const params = validateInput(LikeTweetSchema, args);
        const result = await this.client.likeTweet(authConfig, params.id);
        return result;
    }
    /**
     * Retweet a tweet
     */
    async retweet(authConfig, args) {
        const params = validateInput(RetweetSchema, args);
        const result = await this.client.retweet(authConfig, params.id);
        return result;
    }
    /**
     * Quote a tweet
     */
    async quoteTweet(authConfig, args) {
        const params = validateInput(QuoteTweetSchema, args);
        // Validate media if present
        if (params.media && params.media.length > 0) {
            validateMediaData(params.media);
        }
        const tweet = await this.client.quoteTweet(authConfig, params.text, params.quotedTweetId, params.media);
        return {
            tweet,
            success: true,
            message: 'Quote tweet sent successfully',
        };
    }
}
//# sourceMappingURL=tweets.js.map