import { getTwitterMCPClient } from '../services/twitter-mcp-client';
import '../types/elizaos-extensions';
/**
 * Engagement Analytics API
 * Provides endpoints for accessing Twitter engagement data
 */

import { Router, Request, Response } from 'express';
import { EngagementAnalyticsService } from '../services/engagement-analytics-service';
import { authenticateSession } from '../middleware/auth';

const router = Router();
let analyticsService: EngagementAnalyticsService | null = null;

// Initialize analytics service
export function initializeEngagementAPI(service: EngagementAnalyticsService) {
    analyticsService = service;
}

/**
 * GET /api/v1/engagement/dashboard
 * Get comprehensive analytics dashboard
 */
router.get('/dashboard', authenticateSession, async (req: Request, res: Response) => {
    try {
        const timeframe = req.query.timeframe as string || '24h';
        const analytics = await analyticsService?.getAnalytics(timeframe);
        
        res.json({
            success: true,
            data: analytics
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

/**
 * GET /api/v1/engagement/mentions
 * Get recent @nubi mentions
 */
router.get('/mentions', authenticateSession, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const urgency = req.query.urgency as string;
        const responded = req.query.responded === 'true';
        
        let query = `
            SELECT * FROM mention_alerts 
            WHERE timestamp > NOW() - INTERVAL '24 hours'
        `;
        
        if (urgency) {
            query += ` AND urgency = '${urgency}'`;
        }
        
        if (responded !== undefined) {
            query += ` AND responded = ${responded}`;
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;
        
        const result = await (analyticsService as any)?.pgPool.query(query);
        
        res.json({
            success: true,
            data: result?.rows || []
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mentions'
        });
    }
});

/**
 * GET /api/v1/engagement/sessions/:sessionId
 * Get session-specific engagement data
 */
router.get('/sessions/:sessionId', authenticateSession, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        
        const sessionData = await (analyticsService as any)?.pgPool.query(
            `SELECT * FROM session_engagement WHERE session_id = $1`,
            [sessionId]
        );
        
        const sessionMetrics = await (analyticsService as any)?.pgPool.query(
            `SELECT * FROM engagement_metrics 
             WHERE session_id = $1 
             ORDER BY timestamp DESC`,
            [sessionId]
        );
        
        res.json({
            success: true,
            data: {
                session: sessionData?.rows[0],
                metrics: sessionMetrics?.rows || []
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session data'
        });
    }
});

/**
 * GET /api/v1/engagement/raids/:raidId
 * Get raid-specific analytics
 */
router.get('/raids/:raidId', authenticateSession, async (req: Request, res: Response) => {
    try {
        const { raidId } = req.params;
        
        const raidMetrics = await (analyticsService as any)?.pgPool.query(
            `SELECT 
                MIN(timestamp) as start_time,
                MAX(timestamp) as end_time,
                COUNT(DISTINCT session_id) as unique_participants,
                SUM(likes) as total_likes,
                SUM(retweets) as total_retweets,
                SUM(replies) as total_replies,
                AVG(engagement_rate) as avg_engagement_rate,
                MAX(virality) as peak_virality,
                SUM(reach) as total_reach
             FROM engagement_metrics
             WHERE raid_id = $1`,
            [raidId]
        );
        
        const timeline = await (analyticsService as any)?.clickhouse.query(
            `SELECT 
                toStartOfMinute(timestamp) as minute,
                sum(likes) as likes,
                sum(retweets) as retweets,
                sum(views) as views
             FROM engagement_timeseries
             WHERE raid_id = '${raidId}'
             GROUP BY minute
             ORDER BY minute`
        ).toPromise();
        
        res.json({
            success: true,
            data: {
                summary: raidMetrics?.rows[0],
                timeline: timeline
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch raid analytics'
        });
    }
});

/**
 * GET /api/v1/engagement/tweets/:tweetId
 * Get detailed analytics for a specific tweet
 */
router.get('/tweets/:tweetId', authenticateSession, async (req: Request, res: Response) => {
    try {
        const { tweetId } = req.params;
        
        const tweetMetrics = await (analyticsService as any)?.pgPool.query(
            `SELECT * FROM engagement_metrics 
             WHERE tweet_id = $1 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [tweetId]
        );
        
        const history = await (analyticsService as any)?.clickhouse.query(
            `SELECT 
                timestamp,
                likes,
                retweets,
                replies,
                views,
                engagement_rate
             FROM engagement_timeseries
             WHERE tweet_id = '${tweetId}'
             ORDER BY timestamp`
        ).toPromise();
        
        res.json({
            success: true,
            data: {
                current: tweetMetrics?.rows[0],
                history: history
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tweet analytics'
        });
    }
});

/**
 * POST /api/v1/engagement/respond
 * Manually respond to a mention
 */
router.post('/respond', authenticateSession, async (req: Request, res: Response) => {
    try {
        const { mentionId, responseText } = req.body;
        
        // Get mention details
        const mention = await (analyticsService as any)?.pgPool.query(
            `SELECT * FROM mention_alerts WHERE id = $1`,
            [mentionId]
        );
        
        if (!mention?.rows[0]) {
            return res.status(404).json({
                success: false,
                error: 'Mention not found'
            });
        }
        
        // Send response via MCP
        const response = await getTwitterMCPClient().replyToTweet(mentionId, responseText);
        
        // Update mention as responded
        await (analyticsService as any)?.pgPool.query(
            `UPDATE mention_alerts 
             SET responded = true, response_id = $1 
             WHERE id = $2`,
            [response?.id, mentionId]
        );
        
        res.json({
            success: true,
            data: {
                responseId: response?.id
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to send response'
        });
        return;
    }
});

/**
 * GET /api/v1/engagement/realtime
 * WebSocket endpoint for real-time metrics
 */
router.get('/realtime', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Connect via WebSocket to /ws/engagement for real-time updates'
    });
});

export const engagementRouter = router;
