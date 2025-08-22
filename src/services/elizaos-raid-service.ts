/**
 * ElizaOS-Compatible Raid Service
 * Manages Twitter raid campaigns with proper ElizaOS Service interface
 */

import { Service, IAgentRuntime, Memory, State, UUID } from "@elizaos/core";
import { EventEmitter } from "events";
import { logger } from "../utils/logger";

export interface RaidConfig {
  enabled: boolean;
  maxConcurrent: number;
  cooldownMinutes: number;
  pointsPerAction: {
    like: number;
    retweet: number;
    comment: number;
    view: number;
  };
}

export interface RaidSession {
  id: string;
  tweetUrl: string;
  startedAt: Date;
  endedAt?: Date;
  participants: Map<string, RaidParticipant>;
  status: "active" | "completed" | "cancelled";
}

export interface RaidParticipant {
  userId: string;
  username: string;
  actions: string[];
  points: number;
  joinedAt: Date;
}

export class ElizaOSRaidService extends Service {
  static serviceType = "raid-manager";
  capabilityDescription = "Manages coordinated Twitter engagement campaigns";

  private raids: Map<string, RaidSession> = new Map();
  private raidConfig: RaidConfig;
  private eventEmitter: EventEmitter;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.eventEmitter = new EventEmitter();
    this.raidConfig = this.loadConfig();
    logger.info("🚀 ElizaOS Raid Service initialized");
  }

  private loadConfig(): RaidConfig {
    return {
      enabled: true,
      maxConcurrent: 3,
      cooldownMinutes: 30,
      pointsPerAction: {
        like: 10,
        retweet: 20,
        comment: 30,
        view: 1,
      },
    };
  }

  async startRaid(tweetUrl: string, initiator: Memory): Promise<RaidSession> {
    const raidId = this.generateRaidId();

    const session: RaidSession = {
      id: raidId,
      tweetUrl,
      startedAt: new Date(),
      participants: new Map(),
      status: "active",
    };

    this.raids.set(raidId, session);

    // Add initiator as first participant
    const initiatorId = this.extractUserId(initiator);
    this.addParticipant(raidId, initiatorId, "initiator");

    logger.info(`🎯 Raid started: ${raidId} for ${tweetUrl}`);
    this.eventEmitter.emit("raid:started", session);

    return session;
  }

  async joinRaid(raidId: string, participant: Memory): Promise<boolean> {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      return false;
    }

    const userId = this.extractUserId(participant);
    return this.addParticipant(raidId, userId, userId);
  }

  private addParticipant(
    raidId: string,
    userId: string,
    username: string,
  ): boolean {
    const raid = this.raids.get(raidId);
    if (!raid) return false;

    if (!raid.participants.has(userId)) {
      raid.participants.set(userId, {
        userId,
        username,
        actions: [],
        points: 0,
        joinedAt: new Date(),
      });

      this.eventEmitter.emit("raid:joined", { raidId, userId });
      return true;
    }

    return false;
  }

  async recordAction(
    raidId: string,
    userId: string,
    action: string,
  ): Promise<number> {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      return 0;
    }

    const participant = raid.participants.get(userId);
    if (!participant) {
      return 0;
    }

    // Prevent duplicate actions
    if (!participant.actions.includes(action)) {
      participant.actions.push(action);
      const points =
        this.raidConfig.pointsPerAction[
          action as keyof typeof this.raidConfig.pointsPerAction
        ] || 0;
      participant.points += points;

      this.eventEmitter.emit("raid:action", { raidId, userId, action, points });
      return points;
    }

    return 0;
  }

  async endRaid(raidId: string): Promise<RaidSession | null> {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    raid.status = "completed";
    raid.endedAt = new Date();

    this.eventEmitter.emit("raid:ended", raid);
    logger.info(`✅ Raid ended: ${raidId}`);

    return raid;
  }

  getActiveRaids(): RaidSession[] {
    return Array.from(this.raids.values()).filter(
      (raid) => raid.status === "active",
    );
  }

  getRaidStats(raidId: string): any {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    const stats = {
      id: raid.id,
      url: raid.tweetUrl,
      status: raid.status,
      duration: raid.endedAt
        ? (raid.endedAt.getTime() - raid.startedAt.getTime()) / 1000
        : (Date.now() - raid.startedAt.getTime()) / 1000,
      participantCount: raid.participants.size,
      totalActions: 0,
      totalPoints: 0,
      topParticipants: [] as any[],
    };

    raid.participants.forEach((participant) => {
      stats.totalActions += participant.actions.length;
      stats.totalPoints += participant.points;
    });

    stats.topParticipants = Array.from(raid.participants.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((p) => ({
        username: p.username,
        points: p.points,
        actions: p.actions.length,
      }));

    return stats;
  }

  private extractUserId(memory: Memory): string {
    // Try multiple ways to get user ID
    return (
      (memory as any).userId ||
      (memory as any).user?.id ||
      (memory as any).userId ||
      "anonymous"
    );
  }

  private generateRaidId(): string {
    return `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async stop(): Promise<void> {
    // End all active raids
    for (const raid of this.raids.values()) {
      if (raid.status === "active") {
        await this.endRaid(raid.id);
      }
    }

    this.eventEmitter.removeAllListeners();
    logger.info("🛑 ElizaOS Raid Service stopped");
  }

  // Subscribe to raid events
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }
}

// Export singleton getter
let raidServiceInstance: ElizaOSRaidService | null = null;

export function getRaidService(runtime: IAgentRuntime): ElizaOSRaidService {
  if (!raidServiceInstance) {
    raidServiceInstance = new ElizaOSRaidService(runtime);
  }
  return raidServiceInstance;
}
