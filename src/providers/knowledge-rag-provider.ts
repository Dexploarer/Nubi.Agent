import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  logger,
  ModelType,
} from "@elizaos/core";

/**
 * Knowledge RAG Provider
 *
 * Queries the knowledge plugin for relevant context and adds it to state composition.
 * Works with @elizaos/plugin-knowledge for semantic search and retrieval.
 */

export const knowledgeRagProvider: Provider = {
  name: "KNOWLEDGE_RAG",
  description:
    "Retrieves relevant knowledge snippets via RAG for context enhancement",
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<any> => {
    try {
      // Extract message text
      const messageText =
        typeof message.content === "string"
          ? message.content
          : message.content?.text || "";

      if (!messageText || messageText.length < 10) {
        return {
          text: "",
          values: { ragEnabled: false },
          data: { reason: "Message too short for RAG" },
        };
      }

      // Check if knowledge plugin is available
      const knowledgeService = runtime.getService("knowledge");
      if (!knowledgeService) {
        logger.debug("[KNOWLEDGE_RAG] Knowledge service not available");
        return {
          text: "",
          values: { ragEnabled: false },
          data: { reason: "Knowledge service not available" },
        };
      }

      // Perform semantic search using the message as query
      const searchResults = await (knowledgeService as any)
        .search({
          query: messageText,
          topK: 3,
          threshold: 0.7, // Minimum similarity threshold
        })
        .catch((error: any) => {
          logger.debug("[KNOWLEDGE_RAG] Search failed:", error);
          return null;
        });

      if (!searchResults || searchResults.length === 0) {
        return {
          text: "",
          values: { ragEnabled: true, ragHits: 0 },
          data: { searchPerformed: true, results: [] },
        };
      }

      // Format retrieved knowledge for context
      const knowledgeSnippets = searchResults.map((result: any) => ({
        content: result.content?.substring(0, 500), // Limit snippet length
        source: result.source || "knowledge_base",
        similarity: result.similarity || result.score || 0,
        metadata: result.metadata || {},
      }));

      // Build context text from high-relevance snippets
      const contextText = knowledgeSnippets
        .filter((s: any) => s.similarity > 0.75)
        .map((s: any) => `[Knowledge: ${s.source}] ${s.content}`)
        .join("\n");

      // Generate embedding for the message if needed for caching
      let messageEmbedding = null;
      try {
        messageEmbedding = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
          text: messageText,
        });
      } catch (embedError) {
        logger.debug(
          "[KNOWLEDGE_RAG] Embedding generation failed:",
          embedError,
        );
      }

      return {
        text: contextText ? `relevant_knowledge:\n${contextText}` : "",
        values: {
          ragEnabled: true,
          ragHits: knowledgeSnippets.length,
          hasRelevantKnowledge: contextText.length > 0,
          topSimilarity: knowledgeSnippets[0]?.similarity || 0,
        },
        data: {
          searchPerformed: true,
          results: knowledgeSnippets,
          messageEmbedding,
          query: messageText.substring(0, 100),
        },
      };
    } catch (error) {
      logger.error("[KNOWLEDGE_RAG_PROVIDER] Error:", error);
      return {
        text: "",
        values: { ragEnabled: false, error: true },
        data: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};

export default knowledgeRagProvider;
