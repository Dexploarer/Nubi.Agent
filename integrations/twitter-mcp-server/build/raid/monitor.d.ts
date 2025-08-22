import { RaidSnapshot } from './storage.js';
export declare class RaidMonitorService {
    private auth;
    private storage;
    private monitors;
    startMonitor: (config: any, tweetId: string, xLink: string, intervalMs?: number) => Promise<{
        started: boolean;
        message: string;
    } | {
        started: boolean;
        message?: undefined;
    }>;
    stopMonitor: (tweetId: string) => {
        stopped: boolean;
    };
    getStatus: (tweetId: string) => {
        tweetId: string;
        lastSnapshot: RaidSnapshot;
        snapshots: RaidSnapshot[];
        count: number;
        monitoring: boolean;
    };
}
export declare const raidMonitorService: RaidMonitorService;
