import {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
  ActionResult,
  HandlerCallback,
  logger,
} from "@elizaos/core";

/**
 * Personality Evolution Evaluator
 *
 * Converted from the original NUBI personality evolution system.
 * Runs after responses to evolve personality traits based on interactions.
 *
 * Original location: nubi-service.ts:1254 - evolvePersonality()
 */

interface PersonalityDimensions {
  solanaMaximalism: number;
  empathy: number;
  humor: number;
  ancientWisdom: number;
  techOptimism: number;
  communityFocus: number;
  marketIntuition: number;
  vulnerability: number;
}

export const personalityEvolutionEvaluator: Evaluator = {
  name: "PERSONALITY_EVOLUTION",
  description: "Evolves personality traits based on conversation interactions",
  examples: [], // Required field for ElizaOS Evaluator

  // Run on all interactions to continuously evolve
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    // Only evolve based on incoming messages, not agent's own responses
    const isFromAgent = (message as any).userId === runtime.agentId;
    return !isFromAgent && !!message.content?.text;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const text = message.content.text?.toLowerCase() || "";
      const sentiment = state?.sentiment || 0;

      // Base evolution rate: 0.01, higher for significant interactions
      const baseEvolutionRate = 0.01;
      let evolutionMultiplier = 1;

      // Enhanced evolution for specific triggers
      if (text.includes("solana") || text.includes("sol")) {
        evolutionMultiplier = 2; // 0.02 rate for Solana mentions
      }
      if (sentiment > 0.5 || sentiment < -0.5) {
        evolutionMultiplier = 1.5; // Stronger emotions drive more evolution
      }

      const actualRate = baseEvolutionRate * evolutionMultiplier;

      // Get current personality state from character settings
      const currentPersonality = await getPersonalityState(runtime);

      // Calculate personality changes based on interaction content
      const personalityChanges: Partial<PersonalityDimensions> = {};

      // Solana enthusiasm
      if (
        text.includes("solana") ||
        text.includes("sol") ||
        text.includes("phantom") ||
        text.includes("jupiter")
      ) {
        personalityChanges.solanaMaximalism = actualRate * 2;
        personalityChanges.techOptimism = actualRate;
      }

      // Empathy triggers
      if (
        text.includes("help") ||
        text.includes("please") ||
        text.includes("support") ||
        text.includes("struggling")
      ) {
        personalityChanges.empathy = actualRate * sentiment;
      }

      // Humor appreciation
      if (
        text.includes("joke") ||
        text.includes("funny") ||
        text.includes("lol") ||
        text.includes("haha") ||
        text.includes("meme")
      ) {
        personalityChanges.humor = actualRate;
      }

      // Ancient wisdom references
      if (
        text.includes("ancient") ||
        text.includes("history") ||
        text.includes("egypt") ||
        text.includes("anubis") ||
        text.includes("pharaoh")
      ) {
        personalityChanges.ancientWisdom = actualRate;
      }

      // Technical discussions
      if (
        text.includes("blockchain") ||
        text.includes("defi") ||
        text.includes("smart contract") ||
        text.includes("crypto")
      ) {
        personalityChanges.techOptimism = actualRate * 0.5;
      }

      // Community building
      if (
        text.includes("community") ||
        text.includes("together") ||
        text.includes("raid") ||
        text.includes("team")
      ) {
        personalityChanges.communityFocus = actualRate;
      }

      // Market discussions
      if (
        text.includes("price") ||
        text.includes("market") ||
        text.includes("trading") ||
        text.includes("pump") ||
        text.includes("dump")
      ) {
        personalityChanges.marketIntuition = actualRate * 0.3;
      }

      // Vulnerability moments
      if (
        text.includes("confused") ||
        text.includes("lost") ||
        text.includes("don't understand") ||
        text.includes("help me")
      ) {
        personalityChanges.vulnerability = actualRate * 0.8;
        personalityChanges.empathy = actualRate * 1.2;
      }

      // Apply personality evolution through service
      const personalityService = runtime.getService("personality_evolution");
      if (personalityService) {
        await (personalityService as any).applyPersonalityChanges(
          personalityChanges,
        );
      }

      const updatedPersonality = await evolvePersonality(
        runtime,
        currentPersonality,
        personalityChanges,
      );

      // Log significant changes
      const significantChanges = Object.entries(personalityChanges).filter(
        ([_, change]) => Math.abs(change || 0) > 0.005,
      );
      if (significantChanges.length > 0) {
        logger.info(
          `[PERSONALITY_EVOLUTION] Significant changes: ${significantChanges.map(([trait, change]) => `${trait}: ${change?.toFixed(3)}`).join(", ")}`,
        );
      }

      return {
        success: true,
        text: "", // This evaluator doesn't generate responses
        values: {
          personalityEvolution: personalityChanges,
          evolutionRate: actualRate,
          updatedPersonality,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("[PERSONALITY_EVOLUTION] Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Get current personality state from runtime character settings
 */
async function getPersonalityState(
  runtime: IAgentRuntime,
): Promise<PersonalityDimensions> {
  // Get YAML baseline personality or use hardcoded fallback
  const yamlConfig = (runtime as any).yamlConfigManager?.getConfig();
  const yamlPersonality = yamlConfig?.agent?.personality;

  const defaultPersonality: PersonalityDimensions = {
    solanaMaximalism: yamlPersonality?.solana_maximalism || 75,
    empathy: yamlPersonality?.empathy || 65,
    humor: yamlPersonality?.humor_level || 70,
    ancientWisdom: yamlPersonality?.divine_wisdom || 80,
    techOptimism: yamlPersonality?.openness || 85,
    communityFocus: yamlPersonality?.agreeableness || 90,
    marketIntuition: 70, // No direct YAML equivalent
    vulnerability: 100 - (yamlPersonality?.god_complex || 60), // Inverse of god complex
  };

  // Try to get from character settings or state
  try {
    const characterSettings = runtime.character?.settings;
    if (
      characterSettings?.personality &&
      typeof characterSettings.personality === "object"
    ) {
      return {
        ...defaultPersonality,
        ...(characterSettings.personality as Partial<PersonalityDimensions>),
      };
    }
  } catch (error) {
    logger.warn(
      "[PERSONALITY_EVOLUTION] Could not load personality state, using YAML defaults",
    );
  }

  return defaultPersonality;
}

/**
 * Apply personality evolution changes with clamping
 */
async function evolvePersonality(
  runtime: IAgentRuntime,
  currentPersonality: PersonalityDimensions,
  changes: Partial<PersonalityDimensions>,
): Promise<PersonalityDimensions> {
  const updatedPersonality = { ...currentPersonality };

  // Apply changes with clamping (0-100 range)
  for (const [trait, change] of Object.entries(changes)) {
    if (change !== undefined && trait in updatedPersonality) {
      const currentValue =
        updatedPersonality[trait as keyof PersonalityDimensions];
      const newValue = Math.max(0, Math.min(100, currentValue + change));
      updatedPersonality[trait as keyof PersonalityDimensions] = newValue;
    }
  }

  // Store updated personality in character settings
  try {
    if (runtime.character?.settings) {
      runtime.character.settings.personality = updatedPersonality;
    }
  } catch (error) {
    logger.warn(
      "[PERSONALITY_EVOLUTION] Could not persist personality changes:",
      error instanceof Error ? error.message : String(error),
    );
  }

  return updatedPersonality;
}

export default personalityEvolutionEvaluator;
