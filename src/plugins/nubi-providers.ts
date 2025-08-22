import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
} from "@elizaos/core";

/**
 * Simple Context Provider for NUBI
 *
 * Just basic community manager context, nothing fancy
 */
export const nubiContextProvider: Provider = {
  name: "NUBI_CONTEXT",
  description: "Basic context for NUBI community manager",
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      // Get basic context from memories
      const recentMemories = await runtime.getMemories({
        roomId: message.roomId,
        count: 5,
        unique: true,
        tableName: "memories",
      });

      const messageText = message.content.text || "";
      const isQuestion = messageText.includes("?");
      const isCrypto = messageText
        .toLowerCase()
        .match(/crypto|bitcoin|sol|memecoin|portfolio|trade/);
      const isAnubisChat = messageText.toLowerCase().includes("anubis");

      // Simple context text
      const contextText = `context: community manager for anubis.chat
recent convos: ${recentMemories.length}
message type: ${isQuestion ? "question" : "comment"}
topic: ${isCrypto ? "crypto" : isAnubisChat ? "platform" : "general"}`;

      return {
        text: contextText,
        values: {
          isQuestion,
          isCrypto,
          isAnubisChat,
          recentMessages: recentMemories.length,
          role: "community_manager",
        },
        data: {
          recentMemories: recentMemories.slice(0, 3),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      logger.error("Error in context provider:", error);
      return {
        text: "context unavailable",
        values: { error: true },
        data: {},
      };
    }
  },
};

export const nubiProviders = [nubiContextProvider];
export default nubiProviders;
