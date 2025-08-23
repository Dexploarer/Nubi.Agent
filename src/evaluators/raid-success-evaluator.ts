import {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
  ActionResult,
  HandlerCallback,
  logger,
  ModelType,
} from "@elizaos/core";

/**
 * Raid Success Evaluator
 *
 * ElizaOS-native evaluator that tracks Telegram raid performance using framework patterns:
 * - Leverages ElizaOS memory system for participant tracking
 * - Uses ActionResult format for consistent metrics reporting
 * - Integrates with existing community management patterns
 * - Provides raid analytics and success metrics
 */

interface RaidMetrics {
  raidId: string;
  targetUrl: string;
  participantCount: number;
  completionRate: number;
  engagementScore: number;
  verificationRate: number;
  avgResponseTime: number;
  successRate: number;
}

interface RaidParticipant {
  telegramId: string;
  telegramUsername: string;
  twitterUsername?: string;
  actionsCompleted: number;
  pointsEarned: number;
  verified: boolean;
  joinedAt: Date;
  completedAt?: Date;
}

export const raidSuccessEvaluator: Evaluator = {
  name: "RAID_SUCCESS_TRACKING",
  description:
    "Tracks and evaluates Telegram raid success metrics using ElizaOS memory patterns",
  examples: [], // Required field for ElizaOS Evaluator

  // Validate raid-related messages and MCP tool responses
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Check if message is related to raids
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content?.text || "";

    const isRaidRelated =
      content.toLowerCase().includes("raid") ||
      content.includes("telegram-raid") ||
      content.includes("startRaid") ||
      content.includes("monitorRaid") ||
      (state as any)?.raidContext;

    // Only process raid-related messages
    return isRaidRelated;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const memoryService = runtime.getService("database_memory");
      const communityService = runtime.getService("community_management");

      if (!memoryService) {
        logger.warn("[RAID_SUCCESS] Database memory service not available");
        return {
          success: false,
          error: new Error("Memory service unavailable"),
        };
      }

      const content =
        typeof message.content === "string"
          ? message.content
          : message.content?.text || "";

      // Extract raid information from message or state
      const raidContext = await extractRaidContext(
        runtime,
        message,
        state,
        content,
      );

      if (!raidContext.raidId) {
        // No raid context found, skip processing
        return {
          success: true,
          text: "",
          values: { skipped: true, reason: "no_raid_context" },
        };
      }

      // Store raid participant data using ElizaOS memory patterns
      if (raidContext.participants?.length > 0) {
        await storeRaidParticipants(runtime, raidContext);
      }

      // Calculate raid metrics
      const metrics = await calculateRaidMetrics(runtime, raidContext);

      // Store raid success metrics in memory
      await storeRaidMetrics(runtime, message.roomId, metrics);

      // Track community engagement if service available
      if (communityService && metrics.successRate > 0) {
        await (communityService as any).trackRaidSuccess(
          raidContext.raidId,
          metrics,
        );
      }

      logger.info(
        `[RAID_SUCCESS] Tracked raid ${raidContext.raidId}: ` +
          `${metrics.participantCount} participants, ` +
          `${Math.round(metrics.completionRate * 100)}% completion, ` +
          `${Math.round(metrics.successRate * 100)}% success`,
      );

      return {
        success: true,
        text: `Raid metrics updated: ${metrics.participantCount} participants, ${Math.round(metrics.successRate * 100)}% success`,
        values: {
          raidId: raidContext.raidId,
          metrics: metrics,
          participantCount: metrics.participantCount,
          successRate: metrics.successRate,
          completionRate: metrics.completionRate,
          engagementScore: metrics.engagementScore,
        },
      };
    } catch (error) {
      logger.error(
        "[RAID_SUCCESS] Error:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
};

/**
 * Extract raid context from message content and state
 */
async function extractRaidContext(
  runtime: IAgentRuntime,
  message: Memory,
  state?: State,
  content: string = "",
): Promise<any> {
  // Try to get raid context from state first
  if ((state as any)?.raidContext) {
    return (state as any).raidContext;
  }

  // Try to extract raid ID from message content
  const raidIdMatch = content.match(/raid[_-]([a-zA-Z0-9_-]+)/i);
  if (raidIdMatch) {
    const raidId = `raid_${raidIdMatch[1]}`;

    // Try to retrieve raid context from memory
    try {
      // Generate embedding for semantic search
      const embedding = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: raidId,
      });

      const raidMemories = await runtime.searchMemories({
        embedding: embedding,
        roomId: message.roomId,
        count: 10,
        tableName: "memories",
      });

      if (raidMemories.length > 0) {
        // Parse raid context from memory
        const raidMemory = raidMemories.find(
          (m) =>
            (m.content as any)?.raidId === raidId ||
            JSON.stringify(m.content || "").includes(raidId),
        );

        if (raidMemory) {
          return parseRaidContextFromMemory(raidMemory);
        }
      }
    } catch (error) {
      logger.warn(
        "[RAID_SUCCESS] Could not retrieve raid context from memory:",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Return minimal context with extracted raid ID
    return {
      raidId,
      participants: [],
      status: "unknown",
    };
  }

  // No raid context found
  return { raidId: null };
}

/**
 * Parse raid context from ElizaOS memory
 */
function parseRaidContextFromMemory(memory: Memory): any {
  try {
    const content =
      typeof memory.content === "string"
        ? JSON.parse(memory.content)
        : (memory.content as any);

    return {
      raidId: content.raidId || content.raid_id,
      targetUrl: content.targetUrl || content.target_url,
      participants: content.participants || [],
      status: content.status || "active",
      startTime: content.startTime || content.start_time,
      endTime: content.endTime || content.end_time,
      objectives: content.objectives || [],
      metrics: content.metrics || {},
    };
  } catch (error) {
    logger.warn(
      "[RAID_SUCCESS] Could not parse raid context from memory:",
      error instanceof Error ? error.message : String(error),
    );
    return { raidId: null };
  }
}

/**
 * Store raid participants using ElizaOS memory patterns
 */
async function storeRaidParticipants(
  runtime: IAgentRuntime,
  raidContext: any,
): Promise<void> {
  try {
    for (const participant of raidContext.participants) {
      const participantMemory: Memory = {
        id: crypto.randomUUID() as any,
        agentId: runtime.agentId,
        entityId: participant.telegramId,
        roomId: crypto.randomUUID() as any, // Use raid-specific room
        content: {
          text: `Raid participant: ${participant.telegramUsername}`,
          type: "raid_participant",
          raidId: raidContext.raidId,
          telegramId: participant.telegramId,
          telegramUsername: participant.telegramUsername,
          twitterUsername: participant.twitterUsername,
          actionsCompleted: participant.actionsCompleted,
          pointsEarned: participant.pointsEarned,
          verified: participant.verified,
          joinedAt: participant.joinedAt,
          completedAt: participant.completedAt,
        },
        embedding: undefined,
        createdAt: Date.now(),
      };

      await runtime.createMemory(participantMemory, "memories", false);
    }
  } catch (error) {
    logger.error(
      "[RAID_SUCCESS] Failed to store raid participants:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Calculate comprehensive raid metrics
 */
async function calculateRaidMetrics(
  runtime: IAgentRuntime,
  raidContext: any,
): Promise<RaidMetrics> {
  const participants = raidContext.participants || [];
  const participantCount = participants.length;

  if (participantCount === 0) {
    return {
      raidId: raidContext.raidId,
      targetUrl: raidContext.targetUrl || "",
      participantCount: 0,
      completionRate: 0,
      engagementScore: 0,
      verificationRate: 0,
      avgResponseTime: 0,
      successRate: 0,
    };
  }

  // Calculate completion rate
  const completedActions = participants.reduce(
    (sum: number, p: any) => sum + (p.actionsCompleted || 0),
    0,
  );
  const totalPossibleActions =
    participantCount * (raidContext.objectives?.length || 1);
  const completionRate =
    totalPossibleActions > 0 ? completedActions / totalPossibleActions : 0;

  // Calculate verification rate
  const verifiedParticipants = participants.filter(
    (p: any) => p.verified,
  ).length;
  const verificationRate = verifiedParticipants / participantCount;

  // Calculate engagement score
  const totalPoints = participants.reduce(
    (sum: number, p: any) => sum + (p.pointsEarned || 0),
    0,
  );
  const avgPointsPerParticipant = totalPoints / participantCount;
  const engagementScore = Math.min(avgPointsPerParticipant / 100, 1); // Normalize to 0-1

  // Calculate average response time
  const responseTimes = participants
    .filter((p: any) => p.joinedAt && p.completedAt)
    .map(
      (p: any) =>
        new Date(p.completedAt).getTime() - new Date(p.joinedAt).getTime(),
    );

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum: number, time: number) => sum + time, 0) /
        responseTimes.length /
        1000 // Convert to seconds
      : 0;

  // Calculate overall success rate
  const successRate =
    completionRate * 0.4 + verificationRate * 0.3 + engagementScore * 0.3;

  return {
    raidId: raidContext.raidId,
    targetUrl: raidContext.targetUrl || "",
    participantCount,
    completionRate,
    engagementScore,
    verificationRate,
    avgResponseTime,
    successRate,
  };
}

/**
 * Store raid metrics in ElizaOS memory
 */
async function storeRaidMetrics(
  runtime: IAgentRuntime,
  roomId: string,
  metrics: RaidMetrics,
): Promise<void> {
  try {
    const metricsMemory: Memory = {
      id: crypto.randomUUID() as any,
      agentId: runtime.agentId,
      entityId: runtime.agentId,
      roomId: roomId as any,
      content: {
        text: `Raid ${metrics.raidId} completed with ${Math.round(metrics.successRate * 100)}% success rate`,
        type: "raid_metrics",
        ...metrics,
      },
      embedding: undefined,
      createdAt: Date.now(),
    };

    await runtime.createMemory(metricsMemory, "memories", false);

    logger.debug(`[RAID_SUCCESS] Stored metrics for raid ${metrics.raidId}`);
  } catch (error) {
    logger.error(
      "[RAID_SUCCESS] Failed to store raid metrics:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export default raidSuccessEvaluator;
