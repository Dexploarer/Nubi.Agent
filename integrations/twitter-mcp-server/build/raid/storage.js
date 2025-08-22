import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
export class RaidStorage {
    localDir;
    pgPool;
    constructor(localDir = '.raid_data') {
        this.localDir = localDir;
        if (!fs.existsSync(localDir))
            fs.mkdirSync(localDir, { recursive: true });
        const pgUrl = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL;
        if (pgUrl) {
            this.pgPool = new Pool({
                connectionString: pgUrl,
                ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
            });
        }
    }
    localFile(tweetId) {
        return path.join(this.localDir, `${tweetId}.jsonl`);
    }
    async saveSnapshot(snapshot) {
        // local append
        const line = JSON.stringify(snapshot);
        fs.appendFileSync(this.localFile(snapshot.tweetId), line + '\n');
        // optional postgres
        if (this.pgPool) {
            const client = await this.pgPool.connect();
            try {
                await client.query(`
          CREATE TABLE IF NOT EXISTS raid_snapshots (
            id BIGSERIAL PRIMARY KEY,
            tweet_id TEXT NOT NULL,
            x_link TEXT NOT NULL,
            ts TIMESTAMPTZ NOT NULL,
            likes INT,
            retweets INT,
            replies INT,
            quotes INT,
            bookmarks INT,
            views INT
          )`);
                await client.query(`INSERT INTO raid_snapshots (tweet_id, x_link, ts, likes, retweets, replies, quotes, bookmarks, views)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
                    snapshot.tweetId,
                    snapshot.xLink,
                    snapshot.timestamp,
                    snapshot.likes ?? null,
                    snapshot.retweets ?? null,
                    snapshot.replies ?? null,
                    snapshot.quotes ?? null,
                    snapshot.bookmarks ?? null,
                    snapshot.views ?? null,
                ]);
            }
            finally {
                client.release();
            }
        }
    }
    loadLocalSnapshots(tweetId) {
        const file = this.localFile(tweetId);
        if (!fs.existsSync(file))
            return [];
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
        return lines.map((l) => JSON.parse(l));
    }
}
//# sourceMappingURL=storage.js.map