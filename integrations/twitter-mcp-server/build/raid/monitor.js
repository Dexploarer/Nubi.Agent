import { AuthenticationManager } from '../authentication.js';
import { RaidStorage } from './storage.js';
import { TwitterMcpError } from '../types.js';
export class RaidMonitorService {
    auth = AuthenticationManager.getInstance();
    storage = new RaidStorage();
    monitors = new Map(); // key: tweetId
    startMonitor = async (config, tweetId, xLink, intervalMs = 30000) => {
        if (this.monitors.has(tweetId))
            return { started: false, message: 'Already monitoring' };
        const rec = { tweetId, xLink, intervalMs };
        const tick = async () => {
            try {
                const scraper = await this.auth.getScraper(config);
                const tweet = await scraper.getTweet(tweetId);
                if (!tweet)
                    throw new TwitterMcpError(`Tweet not found: ${tweetId}`, 'tweet_not_found', 404);
                const snap = {
                    tweetId,
                    xLink,
                    timestamp: new Date().toISOString(),
                    likes: tweet.likes,
                    retweets: tweet.retweets,
                    replies: tweet.replies,
                    quotes: tweet.isQuoted ? 1 : undefined, // best-effort
                    views: tweet.views,
                };
                await this.storage.saveSnapshot(snap);
            }
            catch (err) {
                // log and continue
                console.error('monitor tick error', err);
            }
            finally {
                rec.timer = setTimeout(tick, rec.intervalMs);
            }
        };
        rec.timer = setTimeout(tick, 0);
        this.monitors.set(tweetId, rec);
        return { started: true };
    };
    stopMonitor = (tweetId) => {
        const rec = this.monitors.get(tweetId);
        if (rec?.timer)
            clearTimeout(rec.timer);
        this.monitors.delete(tweetId);
        return { stopped: true };
    };
    getStatus = (tweetId) => {
        const local = this.storage.loadLocalSnapshots(tweetId);
        return {
            tweetId,
            lastSnapshot: local[local.length - 1] || null,
            snapshots: local,
            count: local.length,
            monitoring: this.monitors.has(tweetId),
        };
    };
}
export const raidMonitorService = new RaidMonitorService();
//# sourceMappingURL=monitor.js.map