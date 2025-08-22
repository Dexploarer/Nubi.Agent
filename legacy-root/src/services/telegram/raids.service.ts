import { getTwitterMCPClient } from '../twitter-mcp-client';
/**
 * Consolidated Telegram Raids Service
 * Single source of truth for all raid functionality
 */

import { Memory, State } from '@elizaos/core';
import { IAgentRuntime } from '../../types/elizaos-extensions';
import { Telegraf, Context, Markup } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { Service } from '../../core/service-registry';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

interface RaidData {
    id: string;
    tweetId: string;
    tweetUrl: string;
    tweetText: string;
    tweetAuthor: string;
    chatId: number;
    messageId?: number;
    startTime: Date;
    endTime?: Date;
    participants: Set<number>;
    actions: {
        likes: Set<number>;
        retweets: Set<number>;
        replies: Map<number, string>;
        quotes: Map<number, string>;
        views: number;
    };
    stats: {
        initialLikes: number;
        initialRetweets: number;
        initialReplies: number;
        currentLikes: number;
        currentRetweets: number;
        currentReplies: number;
        engagementRate: number;
        virality: number;
        reach: number;
    };
    leaderboard: Map<number, {
        username: string;
        points: number;
        actions: string[];
    }>;
    active: boolean;
    autoStarted: boolean;
    sessionId?: string;
    source: 'telegram' | 'auto' | 'api';
}

export class TelegramRaidsService extends EventEmitter implements Service {
    name = 'telegram-raids';
    private runtime!: IAgentRuntime;
    private bot: Telegraf | null = null;
    private activeRaids: Map<string, RaidData> = new Map();
    private monitoringInterval: NodeJS.Timeout | null = null;
    private pgPool: Pool | null = null;
    private raidDataPath: string;
    private leaderboardPath: string;
    private globalLeaderboard: Map<number, {
        username: string;
        totalPoints: number;
        raidsParticipated: number;
        totalActions: number;
    }> = new Map();

    constructor() {
        super();
        this.raidDataPath = path.join(process.cwd(), 'raid-data.json');
        this.leaderboardPath = path.join(process.cwd(), 'leaderboard.json');
    }

    async initialize(runtime: IAgentRuntime) {
        this.runtime = runtime;
        
        // Initialize database connection if available
        if (process.env.PG_HOST) {
            this.pgPool = new Pool({
                host: process.env.PG_HOST,
                port: parseInt(process.env.PG_PORT || '5432'),
                database: process.env.PG_DATABASE || 'eliza',
                user: process.env.PG_USER || 'postgres',
                password: process.env.PG_PASSWORD,
            });
            await this.createDatabaseTables();
        }

        // Initialize Telegram bot
        if (process.env.TELEGRAM_BOT_TOKEN) {
            this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
            this.setupHandlers();
        }

        // Load persisted data
        this.loadRaidData();
        this.loadLeaderboard();

        // Hook into agent actions
        this.setupAgentHooks();

        console.log('✅ Telegram Raids Service initialized');
    }

    async start() {
        if (this.bot) {
            await this.bot.launch();
            console.log('🚀 Telegram bot launched');
        }

        // Start monitoring
        this.startMonitoring();

        this.emit('service:started');
    }

    async stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        if (this.bot) {
            this.bot.stop();
        }

        if (this.pgPool) {
            await this.pgPool.end();
        }

        this.emit('service:stopped');
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Check bot is responsive
            if (this.bot) {
                // Bot health check
            }

            // Check database connection
            if (this.pgPool) {
                await this.pgPool.query('SELECT 1');
            }

            return true;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Setup Telegram command handlers
     */
    private setupHandlers() {
        if (!this.bot) return;

        // Command: /raid - Start a new raid
        this.bot.command('raid', async (ctx) => {
            await this.handleRaidCommand(ctx);
        });

        // Listen for Twitter URLs
        this.bot.on('text', async (ctx) => {
            await this.handleTextMessage(ctx);
        });

        // Command: /active - Show active raids
        this.bot.command('active', async (ctx) => {
            await this.showActiveRaids(ctx);
        });

        // Command: /stats - Show raid statistics
        this.bot.command('stats', async (ctx) => {
            await this.showRaidStats(ctx);
        });

        // Command: /leaderboard - Show global leaderboard
        this.bot.command('leaderboard', async (ctx) => {
            await this.showLeaderboard(ctx);
        });

        // Setup callback handlers for buttons
        this.setupCallbackHandlers();
    }

    /**
     * Setup button callback handlers
     */
    private setupCallbackHandlers() {
        if (!this.bot) return;

        this.bot.action(/^raid_(.+)_(.+)$/, async (ctx) => {
            const [action, raidId] = ctx.match.slice(1);
            await this.handleRaidAction(ctx, raidId, action);
        });
    }

    /**
     * Handle /raid command
     */
    private async handleRaidCommand(ctx: Context): Promise<any> {
        const text = (ctx.message as any)?.text?.split(' ').slice(1).join(' ');
        if (!text) {
            return ctx.reply('Please provide tweet content or URL: /raid <text or URL>');
        }

        // Check if it's a URL
        const urlMatch = text.match(/(?:twitter|x)\.com\/(\w+)\/status\/(\d+)/i);
        if (urlMatch) {
            await this.startRaidFromUrl(ctx, urlMatch[2], urlMatch[1]);
        } else {
            await this.startRaidFromText(ctx, text);
        }
    }

    /**
     * Handle text messages for URL detection
     */
    private async handleTextMessage(ctx: Context) {
        const text = (ctx.message as any)?.text;
        if (!text || text.startsWith('/')) return;

        const urlMatch = text.match(/(?:twitter|x)\.com\/(\w+)\/status\/(\d+)/i);
        if (urlMatch) {
            const raidKeywords = ['raid', 'boost', 'engage', 'support', 'pump'];
            const hasRaidKeyword = raidKeywords.some(keyword => 
                text.toLowerCase().includes(keyword)
            );
            
            if (hasRaidKeyword) {
                await ctx.reply('🚀 Detected raid request! Starting raid...');
                await this.startRaidFromUrl(ctx, urlMatch[2], urlMatch[1]);
            }
        }
    }

    /**
     * Start raid from tweet text
     */
    private async startRaidFromText(ctx: Context, tweetText: string): Promise<any> {
        try {
            // Post tweet via MCP
            const tweetResult = await this.postTweetViaMCP(tweetText);
            
            if (!tweetResult.success) {
                return ctx.reply('❌ Failed to post tweet: ' + tweetResult.error);
            }

            const raid = await this.createRaid({
                tweetId: tweetResult.tweetId!,
                tweetUrl: tweetResult.url!,
                tweetText: tweetText,
                tweetAuthor: process.env.TWITTER_USERNAME || 'agent',
                chatId: ctx.chat!.id,
                source: 'telegram',
                sessionId: uuidv4(),
            });

            await this.sendRaidMessage(ctx, raid);
            this.emit('raid:started', raid);

        } catch (error) {
            console.error('Error starting raid:', error);
            ctx.reply('❌ Failed to start raid');
        }
    }

    /**
     * Start raid from existing tweet URL
     */
    private async startRaidFromUrl(ctx: Context, tweetId: string, username: string) {
        try {
            const tweetInfo = await this.getTweetInfo(tweetId);
            
            const raid = await this.createRaid({
                tweetId: tweetId,
                tweetUrl: `https://twitter.com/${username}/status/${tweetId}`,
                tweetText: tweetInfo.text || '',
                tweetAuthor: username,
                chatId: ctx.chat!.id,
                source: 'telegram',
                sessionId: uuidv4(),
                initialStats: tweetInfo,
            });

            await this.sendRaidMessage(ctx, raid);
            this.emit('raid:started', raid);

        } catch (error) {
            console.error('Error starting raid from URL:', error);
            ctx.reply('❌ Failed to start raid');
        }
    }

    /**
     * Create a new raid
     */
    private async createRaid(params: any): Promise<RaidData> {
        const raidId = uuidv4();
        const raid: RaidData = {
            id: raidId,
            tweetId: params.tweetId,
            tweetUrl: params.tweetUrl,
            tweetText: params.tweetText,
            tweetAuthor: params.tweetAuthor,
            chatId: params.chatId,
            startTime: new Date(),
            participants: new Set(),
            actions: {
                likes: new Set(),
                retweets: new Set(),
                replies: new Map(),
                quotes: new Map(),
                views: 0,
            },
            stats: {
                initialLikes: params.initialStats?.likes || 0,
                initialRetweets: params.initialStats?.retweets || 0,
                initialReplies: params.initialStats?.replies || 0,
                currentLikes: params.initialStats?.likes || 0,
                currentRetweets: params.initialStats?.retweets || 0,
                currentReplies: params.initialStats?.replies || 0,
                engagementRate: 0,
                virality: 0,
                reach: 0,
            },
            leaderboard: new Map(),
            active: true,
            autoStarted: params.autoStarted || false,
            sessionId: params.sessionId,
            source: params.source,
        };

        this.activeRaids.set(raidId, raid);
        this.saveRaidData();

        // Store in database if available
        if (this.pgPool) {
            await this.storeRaidInDatabase(raid);
        }

        // Schedule monitoring
        setTimeout(() => this.updateRaidStats(raidId), 5000);

        return raid;
    }

    /**
     * Send raid message to Telegram
     */
    private async sendRaidMessage(ctx: Context, raid: RaidData) {
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.url('🐦 View Tweet', raid.tweetUrl),
                Markup.button.callback('🚀 Join', `raid_join_${raid.id}`),
            ],
            [
                Markup.button.callback('❤️ Like', `raid_like_${raid.id}`),
                Markup.button.callback('🔄 Retweet', `raid_retweet_${raid.id}`),
            ],
            [
                Markup.button.callback('📊 Stats', `raid_stats_${raid.id}`),
                Markup.button.callback('🏆 Leaderboard', `raid_board_${raid.id}`),
            ],
        ]);

        const message = await ctx.reply(
            this.formatRaidMessage(raid),
            {
                parse_mode: 'Markdown',
                ...keyboard
            }
        );

        raid.messageId = message.message_id;
        this.saveRaidData();
    }

    /**
     * Format raid message
     */
    private formatRaidMessage(raid: RaidData): string {
        return `🚨 **RAID ${raid.autoStarted ? 'AUTO-' : ''}STARTED!** 🚨\n\n` +
            `📝 Tweet: "${raid.tweetText.substring(0, 100)}${raid.tweetText.length > 100 ? '...' : ''}"\n` +
            `👤 Author: @${raid.tweetAuthor}\n` +
            `🔗 URL: ${raid.tweetUrl}\n\n` +
            `📊 Stats:\n` +
            `❤️ ${raid.stats.currentLikes} | 🔄 ${raid.stats.currentRetweets} | 💬 ${raid.stats.currentReplies}\n\n` +
            `👥 Participants: ${raid.participants.size}\n` +
            `📈 Engagement: ${raid.stats.engagementRate.toFixed(1)}%`;
    }

    /**
     * Handle raid action buttons
     */
    private async handleRaidAction(ctx: Context, raidId: string, action: string): Promise<any> {
        const raid = this.activeRaids.get(raidId);
        if (!raid) {
            return ctx.answerCbQuery('❌ Raid not found');
        }

        const userId = ctx.from!.id;
        const username = ctx.from!.username || 'Anonymous';

        switch (action) {
            case 'join':
                if (raid.participants.has(userId)) {
                    return ctx.answerCbQuery('Already joined!');
                }
                raid.participants.add(userId);
                this.updateUserPoints(userId, username, 'join', raid);
                ctx.answerCbQuery('🚀 Joined! +5 points');
                break;

            case 'like':
                if (raid.actions.likes.has(userId)) {
                    return ctx.answerCbQuery('Already liked!');
                }
                raid.actions.likes.add(userId);
                await this.executeTweetAction(raid.tweetId, 'like');
                this.updateUserPoints(userId, username, 'like', raid);
                ctx.answerCbQuery('❤️ Liked! +10 points');
                break;

            case 'retweet':
                if (raid.actions.retweets.has(userId)) {
                    return ctx.answerCbQuery('Already retweeted!');
                }
                raid.actions.retweets.add(userId);
                await this.executeTweetAction(raid.tweetId, 'retweet');
                this.updateUserPoints(userId, username, 'retweet', raid);
                ctx.answerCbQuery('🔄 Retweeted! +15 points');
                break;

            case 'stats':
                await this.showRaidStats(ctx, raidId);
                ctx.answerCbQuery();
                break;

            case 'board':
                await this.showRaidLeaderboard(ctx, raidId);
                ctx.answerCbQuery();
                break;
        }

        this.saveRaidData();
        await this.updateRaidMessage(raid);
    }

    /**
     * Update user points
     */
    private updateUserPoints(userId: number, username: string, action: string, raid: RaidData) {
        const points = {
            'join': 5,
            'like': 10,
            'retweet': 15,
            'reply': 20,
            'quote': 25,
        };

        const actionPoints = points[action as keyof typeof points] || 0;

        // Update raid leaderboard
        const userRaidData = raid.leaderboard.get(userId) || {
            username,
            points: 0,
            actions: []
        };
        userRaidData.points += actionPoints;
        userRaidData.actions.push(action);
        raid.leaderboard.set(userId, userRaidData);

        // Update global leaderboard
        const userGlobalData = this.globalLeaderboard.get(userId) || {
            username,
            totalPoints: 0,
            raidsParticipated: 0,
            totalActions: 0
        };
        userGlobalData.totalPoints += actionPoints;
        userGlobalData.totalActions++;
        if (!raid.participants.has(userId)) {
            userGlobalData.raidsParticipated++;
        }
        this.globalLeaderboard.set(userId, userGlobalData);

        this.saveLeaderboard();
    }

    /**
     * Update raid message
     */
    private async updateRaidMessage(raid: RaidData) {
        if (!this.bot || !raid.messageId) return;

        try {
            await this.bot.telegram.editMessageText(
                raid.chatId,
                raid.messageId,
                undefined,
                this.formatRaidMessage(raid),
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.url('🐦 View', raid.tweetUrl),
                            Markup.button.callback(`🚀 Join (${raid.participants.size})`, `raid_join_${raid.id}`),
                        ],
                        [
                            Markup.button.callback(`❤️ Like (${raid.actions.likes.size})`, `raid_like_${raid.id}`),
                            Markup.button.callback(`🔄 RT (${raid.actions.retweets.size})`, `raid_retweet_${raid.id}`),
                        ],
                        [
                            Markup.button.callback('📊 Stats', `raid_stats_${raid.id}`),
                            Markup.button.callback('🏆 Board', `raid_board_${raid.id}`),
                        ],
                    ])
                }
            );
        } catch (error) {
            console.error('Failed to update raid message:', error);
        }
    }

    /**
     * Show active raids
     */
    private async showActiveRaids(ctx: Context): Promise<any> {
        const activeRaids = Array.from(this.activeRaids.values())
            .filter(raid => raid.active);

        if (activeRaids.length === 0) {
            return ctx.reply('No active raids at the moment.');
        }

        let message = '🚨 **ACTIVE RAIDS** 🚨\n\n';
        activeRaids.forEach((raid, index) => {
            const duration = Math.floor((Date.now() - raid.startTime.getTime()) / 60000);
            message += `${index + 1}. @${raid.tweetAuthor}: "${raid.tweetText.substring(0, 30)}..."\n`;
            message += `   👥 ${raid.participants.size} raiders | ⏱ ${duration}m\n`;
            message += `   🔗 ${raid.tweetUrl}\n\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    /**
     * Show raid statistics
     */
    private async showRaidStats(ctx: Context, raidId?: string): Promise<any> {
        const raid = raidId ? this.activeRaids.get(raidId) : null;
        if (!raid) {
            return ctx.reply('Raid not found');
        }

        const duration = Math.floor((Date.now() - raid.startTime.getTime()) / 60000);
        const growthLikes = raid.stats.currentLikes - raid.stats.initialLikes;
        const growthRetweets = raid.stats.currentRetweets - raid.stats.initialRetweets;

        const message = `📊 **RAID STATISTICS** 📊\n\n` +
            `📝 Tweet: "${raid.tweetText.substring(0, 50)}..."\n` +
            `⏱ Duration: ${duration} minutes\n` +
            `👥 Participants: ${raid.participants.size}\n\n` +
            `**Growth:**\n` +
            `❤️ +${growthLikes} likes\n` +
            `🔄 +${growthRetweets} retweets\n` +
            `📈 Engagement: ${raid.stats.engagementRate.toFixed(1)}%\n` +
            `🚀 Virality: ${raid.stats.virality.toFixed(1)}\n` +
            `🌍 Reach: ${raid.stats.reach}\n\n` +
            `🔗 ${raid.tweetUrl}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    /**
     * Show raid leaderboard
     */
    private async showRaidLeaderboard(ctx: Context, raidId: string): Promise<any> {
        const raid = this.activeRaids.get(raidId);
        if (!raid) {
            return ctx.reply('Raid not found');
        }

        const sorted = Array.from(raid.leaderboard.entries())
            .sort((a, b) => b[1].points - a[1].points)
            .slice(0, 10);

        if (sorted.length === 0) {
            return ctx.reply('No participants yet');
        }

        let message = '🏆 **RAID LEADERBOARD** 🏆\n\n';
        sorted.forEach(([userId, data], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            message += `${medal} @${data.username}: ${data.points} pts\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    /**
     * Show global leaderboard
     */
    private async showLeaderboard(ctx: Context): Promise<any> {
        const sorted = Array.from(this.globalLeaderboard.entries())
            .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
            .slice(0, 10);

        if (sorted.length === 0) {
            return ctx.reply('No leaderboard data yet');
        }

        let message = '🏆 **GLOBAL LEADERBOARD** 🏆\n\n';
        sorted.forEach(([userId, data], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            message += `${medal} @${data.username}\n`;
            message += `   📊 ${data.totalPoints} points\n`;
            message += `   🎯 ${data.raidsParticipated} raids\n\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    }

    /**
     * Update raid statistics
     */
    private async updateRaidStats(raidId: string) {
        const raid = this.activeRaids.get(raidId);
        if (!raid || !raid.active) return;

        try {
            const stats = await this.getTweetInfo(raid.tweetId);
            
            raid.stats.currentLikes = stats.likes || raid.stats.currentLikes;
            raid.stats.currentRetweets = stats.retweets || raid.stats.currentRetweets;
            raid.stats.currentReplies = stats.replies || raid.stats.currentReplies;
            
            // Calculate metrics
            const totalEngagements = raid.actions.likes.size + raid.actions.retweets.size;
            raid.stats.engagementRate = raid.participants.size > 0 
                ? (totalEngagements / raid.participants.size) * 100 
                : 0;
            
            raid.stats.virality = this.calculateVirality(stats);
            raid.stats.reach = this.calculateReach(stats);

            this.saveRaidData();
            await this.updateRaidMessage(raid);

            // Store in database
            if (this.pgPool) {
                await this.updateRaidInDatabase(raid);
            }

            this.emit('raid:updated', raid);

        } catch (error) {
            console.error('Failed to update raid stats:', error);
        }
    }

    /**
     * Start monitoring
     */
    private startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.activeRaids.forEach((raid, raidId) => {
                if (raid.active) {
                    this.updateRaidStats(raidId);
                }
            });
        }, 30000); // Every 30 seconds

        // Check for stale raids
        setInterval(() => {
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
            this.activeRaids.forEach((raid, raidId) => {
                if (raid.active && raid.startTime.getTime() < twoHoursAgo) {
                    raid.active = false;
                    raid.endTime = new Date();
                    this.emit('raid:ended', raid);
                }
            });
            this.saveRaidData();
        }, 120 * 60 * 1000); // Every 2 hours
    }

    /**
     * Setup agent hooks
     */
    private setupAgentHooks() {
        if (!this.runtime) return;

//         // Agent hooks would go here in production
//         
//         // Hook implementation
//             const result = await originalProcessAction(action, data, state);
//             
//             // Auto-start raid when agent posts tweet
//             if (action === 'CALL_TOOL' && data.tool === 'post_tweet' && result) {
//                 await this.handleAgentTweet(data, result, state);
//             }
//             
//             return result;
//         };
//     }

    }
    /**
     * Handle agent tweet for auto-raid
     */
    private async handleAgentTweet(data: any, result: any, state: State) {
        const tweetId = this.extractTweetId(result);
        const username = process.env.TWITTER_USERNAME || 'agent';
        const url = `https://twitter.com/agent/status/${tweetId}`;
        
        // Create auto-raid
        const raid = await this.createRaid({
            tweetId: tweetId,
            tweetUrl: url,
            tweetText: data.arguments.text,
            tweetAuthor: username,
            chatId: 0, // Will be updated when sent to chats
            source: 'auto',
            sessionId: state.sessionId,
            autoStarted: true,
        });

        // Notify configured Telegram chats
        const allowedChats = process.env.TELEGRAM_ALLOWED_CHATS?.split(',') || [];
        for (const chatId of allowedChats) {
            if (this.bot) {
                try {
                    raid.chatId = Number(chatId);
                    const message = await this.bot.telegram.sendMessage(
                        chatId,
                        this.formatRaidMessage(raid),
                        {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                [
                                    Markup.button.url('🐦 View', url),
                                    Markup.button.callback('🚀 Join', `raid_join_${raid.id}`),
                                ],
                                [
                                    Markup.button.callback('❤️ Like', `raid_like_${raid.id}`),
                                    Markup.button.callback('🔄 RT', `raid_retweet_${raid.id}`),
                                ],
                            ])
                        }
                    );
                    raid.messageId = message.message_id;
                } catch (error) {
                    console.error('Failed to send auto-raid notification:', error);
                }
            }
        }

        this.emit('raid:auto-started', raid);
    }

    // Helper methods

    private extractTweetId(response: any): string {
        if (typeof response === 'string') {
            const patterns = [
                /ID:\s*(\d+)/,
                /status\/(\d+)/,
                /"id":\s*"(\d+)"/,
            ];
            
            for (const pattern of patterns) {
                const match = response.match(pattern);
                if (match) return match[1];
            }
        } else if (response?.id) {
            return response.id;
        }
        
        return Date.now().toString();
    }

    private async postTweetViaMCP(text: string): Promise<any> {
        try {
            return { success: false, error: "MCP integration needs updating" };
//             const mcpClient = getTwitterMCPClient(); const response = await mcpClient.postTweet(
//                 'CALL_TOOL',
//                 {
//                     tool: 'post_tweet',
//                     arguments: { text }
//                 },
//                 {} as State
//             );

            const tweetId = "placeholder-id";
            const url = `https://twitter.com/agent/status/${tweetId}`;

            return {
                success: true,
                tweetId,
                url
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    private async getTweetInfo(tweetId: string): Promise<any> {
        try {
            return null;
//             const mcpClient = getTwitterMCPClient(); const response = await mcpClient.postTweet(
//                 'CALL_TOOL',
//                 {
//                     tool: 'get_tweet_info',
//                     arguments: { tweetId }
//                 },
//                 {} as State
//             );
            
        } catch (error) {
            console.error("Failed to get tweet info:", error);
            return { likes: 0, retweets: 0, replies: 0 };
        }
    }

    private async executeTweetAction(tweetId: string, action: string) {
        try {
//                 'CALL_TOOL',
//                 {
//                     tool: action === 'like' ? 'like_tweet' : 'retweet',
//                     arguments: { tweetId }
//                 },
//                 {} as State
//             );
        } catch (error) {
            console.error(`Failed to ${action} tweet:`, error);
        }
    }

    private calculateVirality(metrics: any): number {
        const shareRatio = metrics.retweets / (metrics.views || 1);
        const quoteRatio = metrics.quotes / (metrics.views || 1);
        return (shareRatio + quoteRatio) * 1000;
    }

    private calculateReach(metrics: any): number {
        return metrics.views + (metrics.retweets * 100) + (metrics.quotes * 50);
    }

//     // Persistence methods
    private loadRaidData() {
        try {
            if (fs.existsSync(this.raidDataPath)) {
                const data = JSON.parse(fs.readFileSync(this.raidDataPath, 'utf-8'));
                data.forEach((raid: any) => {
                    const raidData: RaidData = {
                        ...raid,
                        startTime: new Date(raid.startTime),
                        endTime: raid.endTime ? new Date(raid.endTime) : undefined,
                        participants: new Set(raid.participants),
                        actions: {
                            likes: new Set(raid.actions.likes),
                            retweets: new Set(raid.actions.retweets),
                            replies: new Map(Object.entries(raid.actions.replies)),
                            quotes: new Map(Object.entries(raid.actions.quotes)),
                            views: raid.actions.views || 0,
                        },
                        leaderboard: new Map(Object.entries(raid.leaderboard || {})),
                    };
                    this.activeRaids.set(raid.id, raidData);
                });
            }
        } catch (error) {
            console.error('Failed to load raid data:', error);
        }
    }

    private saveRaidData() {
        try {
            const data = Array.from(this.activeRaids.values()).map(raid => ({
                ...raid,
                participants: Array.from(raid.participants),
                actions: {
                    likes: Array.from(raid.actions.likes),
                    retweets: Array.from(raid.actions.retweets),
                    replies: Object.fromEntries(raid.actions.replies),
                    quotes: Object.fromEntries(raid.actions.quotes),
                    views: raid.actions.views,
                },
                leaderboard: Object.fromEntries(raid.leaderboard),
            }));
            fs.writeFileSync(this.raidDataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save raid data:', error);
        }
    }

    private loadLeaderboard() {
        try {
            if (fs.existsSync(this.leaderboardPath)) {
                const data = JSON.parse(fs.readFileSync(this.leaderboardPath, 'utf-8'));
                Object.entries(data).forEach(([userId, userData]: [string, any]) => {
                    this.globalLeaderboard.set(Number(userId), userData);
                });
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    private saveLeaderboard() {
        try {
            const data = Object.fromEntries(this.globalLeaderboard);
            fs.writeFileSync(this.leaderboardPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save leaderboard:', error);
        }
    }

    // Database methods

    private async createDatabaseTables() {
        if (!this.pgPool) return;

        const queries = [
            `CREATE TABLE IF NOT EXISTS telegram_raids (
                id UUID PRIMARY KEY,
                tweet_id VARCHAR(255) NOT NULL,
                tweet_url TEXT NOT NULL,
                tweet_text TEXT,
                tweet_author VARCHAR(255),
                chat_id BIGINT,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                participants INTEGER DEFAULT 0,
                total_likes INTEGER DEFAULT 0,
                total_retweets INTEGER DEFAULT 0,
                engagement_rate DECIMAL(5,2),
                virality DECIMAL(10,2),
                reach INTEGER,
                active BOOLEAN DEFAULT TRUE,
                auto_started BOOLEAN DEFAULT FALSE,
                session_id UUID,
                source VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            
            `CREATE INDEX IF NOT EXISTS idx_raids_active ON telegram_raids(active);`,
            `CREATE INDEX IF NOT EXISTS idx_raids_tweet_id ON telegram_raids(tweet_id);`,
            `CREATE INDEX IF NOT EXISTS idx_raids_session ON telegram_raids(session_id);`,
        ];

        for (const query of queries) {
            await this.pgPool.query(query);
        }
    }

    private async storeRaidInDatabase(raid: RaidData) {
        if (!this.pgPool) return;

        await this.pgPool.query(
            `INSERT INTO telegram_raids 
            (id, tweet_id, tweet_url, tweet_text, tweet_author, chat_id, start_time, 
             participants, total_likes, total_retweets, engagement_rate, virality, 
             reach, active, auto_started, session_id, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
                participants = EXCLUDED.participants,
                total_likes = EXCLUDED.total_likes,
                total_retweets = EXCLUDED.total_retweets,
                engagement_rate = EXCLUDED.engagement_rate,
                virality = EXCLUDED.virality,
                reach = EXCLUDED.reach,
                updated_at = CURRENT_TIMESTAMP`,
            [raid.id, raid.tweetId, raid.tweetUrl, raid.tweetText, raid.tweetAuthor,
             raid.chatId, raid.startTime, raid.participants.size, raid.actions.likes.size,
             raid.actions.retweets.size, raid.stats.engagementRate, raid.stats.virality,
             raid.stats.reach, raid.active, raid.autoStarted, raid.sessionId, raid.source]
        );
    }

    private async updateRaidInDatabase(raid: RaidData) {
        if (!this.pgPool) return;

        await this.pgPool.query(
            `UPDATE telegram_raids SET
                participants = $1,
                total_likes = $2,
                total_retweets = $3,
                engagement_rate = $4,
                virality = $5,
                reach = $6,
                active = $7,
                end_time = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9`,
            [raid.participants.size, raid.actions.likes.size, raid.actions.retweets.size,
             raid.stats.engagementRate, raid.stats.virality, raid.stats.reach,
             raid.active, raid.endTime, raid.id]
        );
    }
}

// Export as singleton
let service: TelegramRaidsService | null = null;

export function getTelegramRaidsService(): TelegramRaidsService {
    if (!service) {
        service = new TelegramRaidsService();
    }
    return service;
}
