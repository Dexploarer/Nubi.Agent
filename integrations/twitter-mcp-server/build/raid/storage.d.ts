export interface RaidSnapshot {
    tweetId: string;
    xLink: string;
    timestamp: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    quotes?: number;
    bookmarks?: number;
    views?: number;
}
export declare class RaidStorage {
    private localDir;
    private pgPool?;
    constructor(localDir?: string);
    private localFile;
    saveSnapshot(snapshot: RaidSnapshot): Promise<void>;
    loadLocalSnapshots(tweetId: string): RaidSnapshot[];
}
