import { AuthenticationManager } from '../authentication.js';
import { RaidStorage, RaidSnapshot } from './storage.js';
import { TwitterMcpError } from '../types.js';

interface MonitorRecord {
  tweetId: string;
  xLink: string;
  intervalMs: number;
  timer?: NodeJS.Timeout;
}

export class RaidMonitorService {
  private auth = AuthenticationManager.getInstance();
  private storage = new RaidStorage();
  private monitors = new Map<string, MonitorRecord>(); // key: tweetId

  startMonitor = async (config: any, tweetId: string, xLink: string, intervalMs = 30000) => {
    if (this.monitors.has(tweetId)) return { started: false, message: 'Already monitoring' };

    const rec: MonitorRecord = { tweetId, xLink, intervalMs };

    const tick = async () => {
      try {
        const scraper = await this.auth.getScraper(config);
        const tweet = await scraper.getTweet(tweetId);
        if (!tweet)
          throw new TwitterMcpError(`Tweet not found: ${tweetId}`, 'tweet_not_found', 404);

        const snap: RaidSnapshot = {
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
      } catch (err) {
        // log and continue
        console.error('monitor tick error', err);
      } finally {
        rec.timer = setTimeout(tick, rec.intervalMs);
      }
    };

    rec.timer = setTimeout(tick, 0);
    this.monitors.set(tweetId, rec);
    return { started: true };
  };

  stopMonitor = (tweetId: string) => {
    const rec = this.monitors.get(tweetId);
    if (rec?.timer) clearTimeout(rec.timer);
    this.monitors.delete(tweetId);
    return { stopped: true };
  };

  getStatus = (tweetId: string) => {
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
