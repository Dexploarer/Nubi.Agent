import { Provider, IAgentRuntime, Memory, State, logger } from "@elizaos/core";

/**
 * Knowledge Base Provider
 *
 * Provides access to YAML-configured knowledge base including:
 * - Solana protocol information and opinions
 * - Personality quirks for authentic responses
 * - Market insights and strong opinions
 * - Favorite validators and preferences
 */

export const knowledgeBaseProvider: Provider = {
  name: "KNOWLEDGE_BASE",
  description: "Provides access to Anubis knowledge base and personality data",

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<any> => {
    try {
      // Get YAML configuration
      const yamlConfig = (runtime as any).yamlConfigManager?.getConfig();
      if (!yamlConfig) {
        logger.warn("[KNOWLEDGE_BASE] YAML config not available");
        return {};
      }

      const knowledge = yamlConfig.knowledge;
      const text = message.content?.text?.toLowerCase() || "";

      // Detect mentioned protocols
      const mentionedProtocols: string[] = [];
      const protocolInfo: Record<string, any> = {};

      for (const [protocolName, info] of Object.entries(
        knowledge.solana_protocols || {},
      )) {
        if (text.includes(protocolName.toLowerCase())) {
          mentionedProtocols.push(protocolName);
          protocolInfo[protocolName] = info;
        }
      }

      // Get relevant personality quirks
      const relevantQuirks: string[] = [];
      const personalityQuirks = knowledge.personality_quirks || [];

      // Add quirks based on conversation context
      if (
        text.includes("ancient") ||
        text.includes("egypt") ||
        text.includes("history")
      ) {
        relevantQuirks.push(
          ...personalityQuirks.filter(
            (q: string) =>
              q.includes("ancient") ||
              q.includes("Egypt") ||
              q.includes("deity"),
          ),
        );
      }

      if (
        text.includes("ethereum") ||
        text.includes("eth") ||
        text.includes("gas")
      ) {
        relevantQuirks.push(
          ...personalityQuirks.filter(
            (q: string) => q.includes("gas fees") || q.includes("ETH"),
          ),
        );
      }

      if (text.includes("validator") || text.includes("staking")) {
        relevantQuirks.push(
          ...personalityQuirks.filter(
            (q: string) => q.includes("validator") || q.includes("performance"),
          ),
        );
      }

      // Get relevant strong opinions
      const relevantOpinions: Record<string, string> = {};
      const strongOpinions = knowledge.strong_opinions || {};

      for (const [topic, opinion] of Object.entries(strongOpinions)) {
        if (text.includes(topic.toLowerCase())) {
          relevantOpinions[topic] = opinion as string;
        }
      }

      // Get market insights if relevant
      const marketInsights: Record<string, string> = {};
      if (
        text.includes("market") ||
        text.includes("price") ||
        text.includes("bull") ||
        text.includes("bear")
      ) {
        Object.assign(marketInsights, knowledge.market_insights || {});
      }

      // Get favorite validators if relevant
      const favoriteValidators: string[] = [];
      if (
        text.includes("validator") ||
        text.includes("staking") ||
        text.includes("recommend")
      ) {
        favoriteValidators.push(...(knowledge.favorite_validators || []));
      }

      return {
        // Protocol-specific information
        mentionedProtocols,
        protocolInfo,
        protocolCount: mentionedProtocols.length,

        // Personality elements
        personalityQuirks: relevantQuirks,
        hasPersonalityQuirks: relevantQuirks.length > 0,

        // Opinions and preferences
        strongOpinions: relevantOpinions,
        hasStrongOpinions: Object.keys(relevantOpinions).length > 0,

        // Market analysis
        marketInsights,
        hasMarketInsights: Object.keys(marketInsights).length > 0,

        // Validator recommendations
        favoriteValidators,
        hasFavoriteValidators: favoriteValidators.length > 0,

        // Context flags for response generation
        shouldShareProtocolOpinion: mentionedProtocols.length > 0,
        shouldAddPersonalityQuirk:
          relevantQuirks.length > 0 && Math.random() < 0.3,
        shouldExpressStrongOpinion:
          Object.keys(relevantOpinions).length > 0 && Math.random() < 0.4,
        shouldShareMarketInsight:
          Object.keys(marketInsights).length > 0 && Math.random() < 0.2,
        shouldRecommendValidators:
          favoriteValidators.length > 0 && Math.random() < 0.5,

        // Meta information
        knowledgeBaseLoaded: true,
        protocolsKnown: Object.keys(knowledge.solana_protocols || {}).length,
        quirksAvailable: personalityQuirks.length,
        opinionsAvailable: Object.keys(strongOpinions).length,
      };
    } catch (error) {
      logger.error(
        "[KNOWLEDGE_BASE_PROVIDER] Error:",
        error instanceof Error ? error.message : String(error),
      );

      return {
        knowledgeBaseLoaded: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export default knowledgeBaseProvider;
