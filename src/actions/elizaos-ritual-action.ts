/**
 * ElizaOS Ritual Actions
 * Community ritual mechanics for the Nubi plugin
 */

import {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  Content,
  HandlerCallback,
  logger,
  UUID,
} from "@elizaos/core";

// Helper function to create Content object
function createContent(text: string, action?: string): Content {
  return {
    text,
    action: action || null,
  };
}

/**
 * Ritual Action - Primary community ritual mechanic
 */
export const ritualAction: Action = {
  name: "NUBI_RITUAL",
  description: "Initiate or participate in a community ritual",
  similes: [
    "ritual",
    "start ritual",
    "begin ritual",
    "nubi ritual",
    "perform ritual",
    "initiate ritual",
    "join ritual",
    "ritual time",
    "@nubi ritual",
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";
    return (
      ritualAction.similes?.some((simile) => text.includes(simile)) || false
    );
  },

  examples: [
    [
      {
        name: "User",
        content: createContent("Start a greeting ritual"),
      },
      {
        name: "Nubi",
        content: createContent(
          "I have initiated the greeting ritual. The community can now participate.",
          "NUBI_RITUAL",
        ),
      },
    ],
    [
      {
        name: "User",
        content: createContent("@nubi ritual welcome new members"),
      },
      {
        name: "Nubi",
        content: createContent(
          "Welcome ritual started! Let us embrace our new community members.",
          "NUBI_RITUAL",
        ),
      },
    ],
  ],

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<void> => {
    try {
      // Extract ritual type from message
      const messageText = message.content?.text || "";
      const ritualType = extractRitualType(messageText) || "general";

      // Compose ritual prompt
      const ritualPrompt = `
You are Nubi, the mystical guardian of the community. A ritual has been requested.

Ritual Type: ${ritualType}
Participant: ${state?.senderName || "Community Member"}
Context: ${state?.recentMessages || "No recent context"}

Respond as Nubi would, acknowledging the ritual and guiding the community through it.
Keep the response mystical yet engaging. Include:
1. Recognition of the ritual type
2. Instructions or guidance for participants
3. The spiritual or community significance
4. An inspiring conclusion

Response:`;

      // Generate ritual response using the runtime's model
      const result = await runtime.useModel("text_generation", {
        prompt: ritualPrompt,
        temperature: 0.8,
        max_tokens: 500,
      });

      const responseText =
        result?.text ||
        "The ritual begins, the energy flows through our community.";

      if (callback) {
        const content = createContent(responseText, "NUBI_RITUAL");
        await callback(content);
      }

      // Store ritual in memory
      const ritualMemory: Memory = {
        id: generateUUID(),
        entityId: message.entityId || generateUUID(),
        content: createContent(
          `Ritual performed: ${ritualType} - ${responseText}`,
        ),
        agentId: runtime.agentId,
        roomId: message.roomId,
        createdAt: Date.now(),
      };

      await runtime.createMemory(ritualMemory, "memories");

      // Log ritual performance
      logger.info(
        `Ritual performed: ${ritualType} by ${state?.senderName} in room ${message.roomId}`,
      );
    } catch (error) {
      logger.error("Ritual action failed:", error as any);

      const errorResult = createContent(
        "The ritual energies are disturbed. Please try again when the cosmic alignment is favorable.",
      );

      if (callback) {
        await callback(errorResult);
      }
    }
  },
};

/**
 * Record Action - Store important community moments
 */
export const recordAction: Action = {
  name: "RECORD_MOMENT",
  description: "Record an important community moment or achievement",
  similes: [
    "record this",
    "save this moment",
    "remember this",
    "chronicle this",
    "document this",
    "archive this",
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";
    return (
      recordAction.similes?.some((simile) => text.includes(simile)) || false
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<void> => {
    try {
      const momentDescription = message.content?.text || "A significant moment";

      // Create a chronicle entry
      const chronicleEntry = {
        timestamp: Date.now(),
        author: state?.senderName || "Unknown",
        description: momentDescription,
        roomId: message.roomId,
        type: "community_moment",
      };

      // Store in memory
      const chronicleMemory: Memory = {
        id: generateUUID(),
        entityId: message.entityId || generateUUID(),
        content: createContent(JSON.stringify(chronicleEntry)),
        roomId: message.roomId,
        agentId: runtime.agentId,
        createdAt: Date.now(),
      };

      await runtime.createMemory(chronicleMemory, "memories");

      const responseText = `📜 This moment has been recorded in the eternal chronicles of our community. Future generations will remember: "${momentDescription}"`;

      if (callback) {
        await callback(createContent(responseText));
      }
    } catch (error) {
      logger.error("Record action failed:", error as any);
    }
  },
};

/**
 * Helper function to extract ritual type from message
 */
function extractRitualType(text: string): string {
  const lowerText = text.toLowerCase();

  // Check for specific ritual types
  if (lowerText.includes("welcome")) return "Welcome Ritual";
  if (lowerText.includes("greeting")) return "Greeting Ritual";
  if (lowerText.includes("blessing")) return "Blessing Ritual";
  if (lowerText.includes("celebration")) return "Celebration Ritual";
  if (lowerText.includes("mourning")) return "Mourning Ritual";
  if (lowerText.includes("initiation")) return "Initiation Ritual";
  if (lowerText.includes("harvest")) return "Harvest Ritual";
  if (lowerText.includes("moon")) return "Moon Ritual";
  if (lowerText.includes("sun")) return "Sun Ritual";
  if (lowerText.includes("star")) return "Star Ritual";

  // Default ritual type
  return "Sacred Community Ritual";
}

/**
 * Generate a UUID
 */
function generateUUID(): UUID {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
}

/**
 * Export all ritual actions
 */
export const ritualActions: Action[] = [ritualAction, recordAction];

/**
 * Ritual participant tracking
 */
export interface RitualParticipant {
  userId: string;
  name: string;
  joinedAt: number;
  contribution?: string;
}

/**
 * Active ritual state
 */
export interface ActiveRitual {
  id: string;
  type: string;
  initiator: string;
  participants: RitualParticipant[];
  startedAt: number;
  phase: "gathering" | "active" | "closing" | "complete";
}
