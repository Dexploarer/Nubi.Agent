/**
 * Comprehensive Engagement Analytics Service
 * Tracks ALL Twitter engagement, not just raids
 * Integrates with database, sessions, and agent-wide systems
 */

import { Memory, State } from '@elizaos/core';
import { IAgentRuntime, generateUUID, ExtendedMemory } from '../types/elizaos-extensions';
import { getTwitterMCPClient } from './twitter-mcp-client';
import { Pool } from 'pg';
import { ClickHouse } from 'clickhouse';
import { EventEmitter } from 'events';

interface EngagementMetrics {
    tweetId: string;
    timestamp: Date;
    type: 'post' | 'reply' | 'quote' | 'retweet' | 'like' | 'mention';
    author: string;
    content: string;
    metrics: {
        likes: number;
        retweets: number;
        replies: number;
        quotes: number;
        views: number;
        bookmarks: number;
        impressions: number;
    };
    sentiment?: 'positive' | 'negative' | 'neutral';
    topics?: string[];
    mentions?: string[];
    hashtags?: string[];
    urls?: string[];
    mediaTypes?: string[];
    engagementRate?: number;
    virality?: number;
    reach?: number;
    sessionId?: string;
    userId?: string;
    source?: 'raid' | 'organic' | 'scheduled' | 'reply' | 'agent';
    raidId?: string;
}

interface MentionAlert {
    id: string;
    tweetId: string;
    author: string;
    content: string;
    timestamp: Date;
    isReplyTo: boolean;
    parentTweetId?: string;
    sentiment?: string;
    urgency: 'high' | 'medium' | 'low';
    responded: boolean;
    responseId?: string;
}

interface SessionEngagement {
    sessionId: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    platform: 'telegram' | 'discord' | 'twitter' | 'web';
    actions: {
        tweets: number;
        likes: number;
        retweets: number;
        replies: number;
        raids: number;
    };
    totalEngagement: number;
    averageResponseTime: number;
    sentiment: number;
}

export class EngagementAnalyticsService extends EventEmitter {
    private runtime: IAgentRuntime;
    private pgPool: Pool | null = null;
    private clickhouse: ClickHouse | null = null;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private mentionCheckInterval: NodeJS.Timeout | null = null;
    private metricsQueue: EngagementMetrics[] = [];
    private sessionsMap: Map<string, SessionEngagement> = new Map();
    private lastCheckedMention: Date = new Date();

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.initializeDatabase();
        this.setupMonitoring();
    }

    /**
     * Initialize database connections
     */
    private async initializeDatabase(): Promise<void> {
        // PostgreSQL for relational data
        if (process.env.PG_HOST) {
            this.pgPool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                database: process.env.PG_DATABASE || 'eliza',
                user: process.env.PG_USER || 'postgres',
                password: process.env.PG_PASSWORD,
            });
        }

        // ClickHouse for time-series analytics
        if (process.env.CLICKHOUSE_URL) {
            this.clickhouse = new ClickHouse({
                url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
                port: 8123,
                debug: false,
                basicAuth: {
                    username: process.env.CLICKHOUSE_USER || 'default',
                    password: process.env.CLICKHOUSE_PASSWORD || '',
                },
                isUseGzip: true,
            });
        }

        if (this.pgPool || this.clickhouse) {
            await this.createTables();
        }
    }

    /**
     * Create necessary database tables
     */
    private async createTables(): Promise<void> {
        // PostgreSQL tables
        if (this.pgPool) {
            const pgQueries = [
                `CREATE TABLE IF NOT EXISTS engagement_metrics (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tweet_id VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    author VARCHAR(255) NOT NULL,
                    content TEXT,
                    likes INTEGER DEFAULT 0,
                    retweets INTEGER DEFAULT 0,
                    replies INTEGER DEFAULT 0,
                    quotes INTEGER DEFAULT 0,
                    views INTEGER DEFAULT 0,
                    bookmarks INTEGER DEFAULT 0,
                    impressions INTEGER DEFAULT 0,
                    sentiment VARCHAR(20),
                    engagement_rate DECIMAL(5,2),
                    virality DECIMAL(5,2),
                    reach INTEGER,
                    session_id VARCHAR(255),
                    user_id VARCHAR(255),
                    source VARCHAR(50),
                    raid_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );`,
                
                `CREATE TABLE IF NOT EXISTS mention_alerts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tweet_id VARCHAR(255) NOT NULL,
                    author VARCHAR(255) NOT NULL,
                    content TEXT,
                    timestamp TIMESTAMP NOT NULL,
                    is_reply_to BOOLEAN DEFAULT FALSE,
                    parent_tweet_id VARCHAR(255),
                    sentiment VARCHAR(20),
                    urgency VARCHAR(20),
                    responded BOOLEAN DEFAULT FALSE,
                    response_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );`,
                
                `CREATE TABLE IF NOT EXISTS session_engagement (
                    session_id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    start_time TIMESTAMP NOT NULL,
                    end_time TIMESTAMP,
                    platform VARCHAR(50),
                    tweets_count INTEGER DEFAULT 0,
                    likes_count INTEGER DEFAULT 0,
                    retweets_count INTEGER DEFAULT 0,
                    replies_count INTEGER DEFAULT 0,
                    raids_count INTEGER DEFAULT 0,
                    total_engagement INTEGER DEFAULT 0,
                    avg_response_time DECIMAL(10,2),
                    sentiment_score DECIMAL(3,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );`,

                `CREATE INDEX IF NOT EXISTS idx_engagement_tweet_id ON engagement_metrics(tweet_id);`,
                `CREATE INDEX IF NOT EXISTS idx_engagement_timestamp ON engagement_metrics(timestamp);`,
                `CREATE INDEX IF NOT EXISTS idx_engagement_session ON engagement_metrics(session_id);`,
                `CREATE INDEX IF NOT EXISTS idx_mentions_responded ON mention_alerts(responded);`,
                `CREATE INDEX IF NOT EXISTS idx_mentions_urgency ON mention_alerts(urgency);`
            ];

            for (const query of pgQueries) {
                try {
                    await this.pgPool.query(query);
                } catch (error) {
                    console.error('Error creating table:', error);
                }
            }
        }

        // ClickHouse tables for time-series data
        if (this.clickhouse) {
            const clickhouseQueries = [
                `CREATE TABLE IF NOT EXISTS engagement_timeseries (
                    timestamp DateTime,
                    tweet_id String,
                    likes UInt32,
                    retweets UInt32,
                    replies UInt32,
                    views UInt32,
                    engagement_rate Float32,
                    source String,
                    raid_id Nullable(String)
                ) ENGINE = MergeTree()
                ORDER BY (timestamp, tweet_id)
                PARTITION BY toYYYYMM(timestamp);`,

                `CREATE TABLE IF NOT EXISTS mention_stream (
                    timestamp DateTime,
                    tweet_id String,
                    author String,
                    content String,
                    sentiment String,
                    urgency String,
                    responded UInt8
                ) ENGINE = MergeTree()
                ORDER BY timestamp
                PARTITION BY toYYYYMM(timestamp);`
            ];

            for (const query of clickhouseQueries) {
                try {
                    await this.clickhouse.query(query).toPromise();
                } catch (error) {
                    console.error('Error creating ClickHouse table:', error);
                }
            }
        }

        console.log('✅ Database tables initialized');
    }

    /**
     * Setup monitoring for all Twitter engagement
     */
    private setupMonitoring(): void {
        // Monitor general engagement every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            await this.monitorEngagement();
        }, 30000);

        // Check for @nubi mentions every 15 seconds
        this.mentionCheckInterval = setInterval(async () => {
            await this.checkMentions();
        }, 15000);

        console.log('📊 Engagement monitoring started');
    }

    /**
     * Monitor all engagement metrics
     */
    private async monitorEngagement(): Promise<void> {
        try {
            // Get all active tweets to monitor
            const activeTweets = await this.getActiveTweets();
            
            for (const tweet of activeTweets) {
                const metrics = await this.fetchTweetMetrics(tweet.id);
                await this.recordEngagement({
                    tweetId: tweet.id,
                    timestamp: new Date(),
                    type: 'post',
                    author: tweet.author,
                    content: tweet.content,
                    metrics,
                    sessionId: tweet.session_id,
                    userId: tweet.user_id,
                    source: tweet.source,
                    raidId: tweet.raid_id,
                    engagementRate: this.calculateEngagementRate(metrics),
                    virality: this.calculateVirality(metrics),
                    reach: this.calculateReach(metrics),
                });
            }

            // Process queued metrics
            await this.flushMetricsQueue();
            
        } catch (error) {
            console.error('Error monitoring engagement:', error);
        }
    }

    /**
     * Check for @nubi mentions
     */
    private async checkMentions(): Promise<void> {
        try {
            const mcpClient = getTwitterMCPClient();
            const mentions = await mcpClient.searchMentions('@nubi OR @NUBI OR Nubi', this.lastCheckedMention);

            if (mentions && Array.isArray(mentions)) {
                for (const mention of mentions) {
                    await this.processMention(mention);
                }
            }

            this.lastCheckedMention = new Date();
            
        } catch (error) {
            console.error('Error checking mentions:', error);
        }
    }

    /**
     * Process a mention of @nubi
     */
    private async processMention(mention: any): Promise<void> {
        const alert: MentionAlert = {
            id: generateUUID(),
            tweetId: mention.id,
            author: mention.author?.username || 'unknown',
            content: mention.text || '',
            timestamp: new Date(mention.created_at || Date.now()),
            isReplyTo: mention.in_reply_to_status_id !== null,
            parentTweetId: mention.in_reply_to_status_id,
            sentiment: await this.analyzeSentiment(mention.text || ''),
            urgency: this.determineUrgency(mention),
            responded: false,
        };

        // Store in database
        if (this.pgPool) {
            await this.pgPool.query(
                `INSERT INTO mention_alerts 
                (id, tweet_id, author, content, timestamp, is_reply_to, parent_tweet_id, sentiment, urgency, responded)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [alert.id, alert.tweetId, alert.author, alert.content, alert.timestamp,
                 alert.isReplyTo, alert.parentTweetId, alert.sentiment, alert.urgency, alert.responded]
            );
        }

        // Emit event for immediate handling
        this.emit('mention', alert);

        // Auto-respond if high urgency
        if (alert.urgency === 'high') {
            await this.autoRespond(alert);
        }
    }

    /**
     * Record engagement metrics to database
     */
    private async recordEngagement(metrics: EngagementMetrics): Promise<void> {
        // Queue for batch processing
        this.metricsQueue.push(metrics);

        // Store in PostgreSQL
        if (this.pgPool) {
            await this.pgPool.query(
                `INSERT INTO engagement_metrics 
                (tweet_id, timestamp, type, author, content, likes, retweets, replies, quotes, views, 
                 bookmarks, impressions, sentiment, engagement_rate, virality, reach, 
                 session_id, user_id, source, raid_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                ON CONFLICT (tweet_id) DO UPDATE SET
                    likes = EXCLUDED.likes,
                    retweets = EXCLUDED.retweets,
                    replies = EXCLUDED.replies,
                    quotes = EXCLUDED.quotes,
                    views = EXCLUDED.views,
                    bookmarks = EXCLUDED.bookmarks,
                    impressions = EXCLUDED.impressions,
                    engagement_rate = EXCLUDED.engagement_rate,
                    virality = EXCLUDED.virality,
                    reach = EXCLUDED.reach,
                    updated_at = CURRENT_TIMESTAMP`,
                [metrics.tweetId, metrics.timestamp, metrics.type, metrics.author, metrics.content,
                 metrics.metrics.likes, metrics.metrics.retweets, metrics.metrics.replies,
                 metrics.metrics.quotes, metrics.metrics.views, metrics.metrics.bookmarks,
                 metrics.metrics.impressions, metrics.sentiment, metrics.engagementRate,
                 metrics.virality, metrics.reach, metrics.sessionId, metrics.userId,
                 metrics.source, metrics.raidId]
            );
        }

        // Stream to ClickHouse for time-series
        if (this.clickhouse) {
            await this.clickhouse.insert(
                'INSERT INTO engagement_timeseries',
                [{
                    timestamp: metrics.timestamp,
                    tweet_id: metrics.tweetId,
                    likes: metrics.metrics.likes,
                    retweets: metrics.metrics.retweets,
                    replies: metrics.metrics.replies,
                    views: metrics.metrics.views,
                    engagement_rate: metrics.engagementRate || 0,
                    source: metrics.source || 'unknown',
                    raid_id: metrics.raidId || null
                }]
            ).toPromise();
        }
    }

    /**
     * Track agent actions for analytics
     */
    public async trackAgentAction(action: string, data: any, state: State, result: any): Promise<void> {
        const sessionId: string = (state as any)?.sessionId || generateUUID();
        const userId: string = (state as any)?.userId || "agent";
        
        // Update session engagement
        let session = this.sessionsMap.get(sessionId);
        if (!session) {
            session = {
                sessionId,
                userId,
                startTime: new Date(),
                platform: 'twitter',
                actions: {
                    tweets: 0,
                    likes: 0,
                    retweets: 0,
                    replies: 0,
                    raids: 0,
                },
                totalEngagement: 0,
                averageResponseTime: 0,
                sentiment: 0,
            };
            this.sessionsMap.set(sessionId, session);
        }

        // Update action counts
        switch (data.tool) {
            case 'post_tweet':
            if (!session) return;
            if (!session) return;
            if (action === "post_tweet") {
                session.actions.tweets++;
            } else if (action === "like_tweet") {
                session.actions.likes++;
            } else if (action === "retweet") {
                session.actions.retweets++;
            } else if (action === "reply_to_tweet") {
                session.actions.replies++;
            }
            
            session.totalEngagement++;
            
            await this.saveSessionEngagement(session);
    }
        }

    /**
     * Save session engagement to database
     */
    private async saveSessionEngagement(session: SessionEngagement): Promise<void> {
        if (!this.pgPool) return;
        
        await this.pgPool.query(
            `INSERT INTO session_engagement 
            (session_id, user_id, start_time, end_time, platform, tweets_count, likes_count,
             retweets_count, replies_count, raids_count, total_engagement, avg_response_time, sentiment_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (session_id) DO UPDATE SET
                end_time = EXCLUDED.end_time,
                tweets_count = EXCLUDED.tweets_count,
                likes_count = EXCLUDED.likes_count,
                retweets_count = EXCLUDED.retweets_count,
                replies_count = EXCLUDED.replies_count,
                raids_count = EXCLUDED.raids_count,
                total_engagement = EXCLUDED.total_engagement,
                avg_response_time = EXCLUDED.avg_response_time,
                sentiment_score = EXCLUDED.sentiment_score,
                updated_at = CURRENT_TIMESTAMP`,
            [session.sessionId, session.userId, session.startTime, session.endTime,
             session.platform, session.actions.tweets, session.actions.likes,
             session.actions.retweets, session.actions.replies, session.actions.raids,
             session.totalEngagement, session.averageResponseTime, session.sentiment]
        );
    }

    /**
     * Get active tweets to monitor
     */
    private async getActiveTweets(): Promise<any[]> {
        if (!this.pgPool) return [];
        
        const result = await this.pgPool.query(
            `SELECT DISTINCT tweet_id as id, author, content, session_id, user_id, source, raid_id
             FROM engagement_metrics
             WHERE timestamp > NOW() - INTERVAL '24 hours'
             AND type = 'post'`
        );
        return result.rows;
    }

    /**
     * Fetch tweet metrics via MCP
     */
    private async fetchTweetMetrics(tweetId: string): Promise<any> {
        try {
            const mcpClient = getTwitterMCPClient();
            const metrics = await mcpClient.getTweetInfo(tweetId);
            
            return {
                likes: metrics?.likes || 0,
                retweets: metrics?.retweets || 0,
                replies: metrics?.replies || 0,
                quotes: metrics?.quotes || 0,
                views: metrics?.views || 0,
                bookmarks: metrics?.bookmarks || 0,
                impressions: metrics?.impressions || 0,
            };
        } catch (error) {
            console.error('Error fetching tweet metrics:', error);
            return {
                likes: 0,
                retweets: 0,
                replies: 0,
                quotes: 0,
                views: 0,
                bookmarks: 0,
                impressions: 0,
            };
        }
    }

    /**
     * Calculate engagement rate
     */
    private calculateEngagementRate(metrics: any): number {
        const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
        const impressions = metrics.impressions || metrics.views || 1;
        return (totalEngagements / impressions) * 100;
    }

    /**
     * Calculate virality score
     */
    private calculateVirality(metrics: any): number {
        const shareRatio = metrics.retweets / (metrics.views || 1);
        const quoteRatio = metrics.quotes / (metrics.views || 1);
        return (shareRatio + quoteRatio) * 1000;
    }

    /**
     * Calculate reach
     */
    private calculateReach(metrics: any): number {
        return metrics.views + (metrics.retweets * 100) + (metrics.quotes * 50);
    }

    /**
     * Analyze sentiment of text
     */
    private async analyzeSentiment(text: string): Promise<string> {
        const positiveWords = ['great', 'awesome', 'love', 'amazing', 'good', 'best', 'excellent'];
        const negativeWords = ['bad', 'hate', 'terrible', 'worst', 'awful', 'horrible', 'scam'];
        
        const textLower = text.toLowerCase();
        let score = 0;
        
        positiveWords.forEach(word => {
            if (textLower.includes(word)) score++;
        });
        
        negativeWords.forEach(word => {
            if (textLower.includes(word)) score--;
        });
        
        if (score > 0) return 'positive';
        if (score < 0) return 'negative';
        return 'neutral';
    }

    /**
     * Determine urgency of mention
     */
    private determineUrgency(mention: any): 'high' | 'medium' | 'low' {
        // High urgency: verified accounts, high follower count
        if (mention.author?.verified || mention.author?.followers_count > 10000) {
            return 'high';
        }
        
        // Medium urgency: replies to our tweets
        if (mention.in_reply_to_user_id === process.env.TWITTER_USER_ID) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Auto-respond to high priority mentions
     */
    private async autoRespond(alert: MentionAlert): Promise<void> {
        try {
            const mcpClient = getTwitterMCPClient();
            const response = await mcpClient.replyToTweet(
                alert.tweetId,
                `Thank you for mentioning me, @${alert.author}! How can I help you today?`
            );
            
            // Update alert as responded
            if (this.pgPool) {
                await this.pgPool.query(
                    `UPDATE mention_alerts SET responded = true, response_id = $1 WHERE id = $2`,
                    [response?.id, alert.id]
                );
            }
            
        } catch (error) {
            console.error('Error auto-responding to mention:', error);
        }
    }

    /**
     * Flush metrics queue to database
     */
    private async flushMetricsQueue(): Promise<void> {
        if (this.metricsQueue.length === 0 || !this.clickhouse) return;
        
        // Batch insert to ClickHouse
        const batch = this.metricsQueue.map(m => ({
            timestamp: m.timestamp,
            tweet_id: m.tweetId,
            likes: m.metrics.likes,
            retweets: m.metrics.retweets,
            replies: m.metrics.replies,
            views: m.metrics.views,
            engagement_rate: m.engagementRate || 0,
            source: m.source || 'unknown',
            raid_id: m.raidId || null
        }));
        
        await this.clickhouse.insert('INSERT INTO engagement_timeseries', batch).toPromise();
        
        this.metricsQueue = [];
    }

    /**
     * Get analytics dashboard data
     */
    async getAnalytics(timeframe: string = '24h'): Promise<any> {
        const interval = timeframe === '24h' ? '24 hours' : 
                        timeframe === '7d' ? '7 days' : 
                        timeframe === '30d' ? '30 days' : '24 hours';
        
        if (!this.pgPool) {
            return {
                timeframe,
                overall: {},
                mentions: {},
                sessions: {},
                topTweets: [],
                raids: {},
                timestamp: new Date()
            };
        }

        // Get overall metrics
        const overallMetrics = await this.pgPool.query(
            `SELECT 
                COUNT(DISTINCT tweet_id) as total_tweets,
                SUM(likes) as total_likes,
                SUM(retweets) as total_retweets,
                SUM(replies) as total_replies,
                AVG(engagement_rate) as avg_engagement_rate,
                AVG(virality) as avg_virality,
                SUM(reach) as total_reach
             FROM engagement_metrics
             WHERE timestamp > NOW() - INTERVAL '${interval}'`
        );
        
        // Get mention statistics
        const mentionStats = await this.pgPool.query(
            `SELECT 
                COUNT(*) as total_mentions,
                COUNT(CASE WHEN responded = true THEN 1 END) as responded_mentions,
                COUNT(CASE WHEN urgency = 'high' THEN 1 END) as high_urgency,
                AVG(CASE WHEN sentiment = 'positive' THEN 1 
                        WHEN sentiment = 'negative' THEN -1 
                        ELSE 0 END) as sentiment_score
             FROM mention_alerts
             WHERE timestamp > NOW() - INTERVAL '${interval}'`
        );
        
        // Get session statistics
        const sessionStats = await this.pgPool.query(
            `SELECT 
                COUNT(DISTINCT session_id) as total_sessions,
                AVG(total_engagement) as avg_engagement_per_session,
                SUM(tweets_count) as total_tweets_sent,
                SUM(likes_count + retweets_count + replies_count) as total_interactions,
                AVG(sentiment_score) as avg_sentiment
             FROM session_engagement
             WHERE start_time > NOW() - INTERVAL '${interval}'`
        );
        
        // Get top performing tweets
        const topTweets = await this.pgPool.query(
            `SELECT 
                tweet_id,
                author,
                content,
                likes,
                retweets,
                engagement_rate,
                virality
             FROM engagement_metrics
             WHERE timestamp > NOW() - INTERVAL '${interval}'
             ORDER BY engagement_rate DESC
             LIMIT 10`
        );
        
        // Get raid performance
        const raidStats = await this.pgPool.query(
            `SELECT 
                COUNT(DISTINCT raid_id) as total_raids,
                AVG(likes) as avg_likes_per_raid,
                AVG(retweets) as avg_retweets_per_raid,
                SUM(reach) as total_raid_reach
             FROM engagement_metrics
             WHERE raid_id IS NOT NULL
             AND timestamp > NOW() - INTERVAL '${interval}'`
        );
        
        return {
            timeframe,
            overall: overallMetrics.rows[0],
            mentions: mentionStats.rows[0],
            sessions: sessionStats.rows[0],
            topTweets: topTweets.rows,
            raids: raidStats.rows[0],
            timestamp: new Date()
        };
    }

    /**
     * Stop the service
     */
    stop(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.mentionCheckInterval) {
            clearInterval(this.mentionCheckInterval);
        }
        if (this.pgPool) {
            this.pgPool.end();
        }
        console.log('📊 Engagement analytics service stopped');
    }
}

export default EngagementAnalyticsService;
