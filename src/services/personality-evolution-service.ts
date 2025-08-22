import { Service, IAgentRuntime, logger, ServiceType } from "@elizaos/core";

/**
 * Personality Evolution Service
 *
 * Background service that applies natural personality drift over time.
 * Implements proper ElizaOS Service pattern.
 *
 * Original: Extracted from nubi-service.ts startPersonalityEvolution()
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

export class PersonalityEvolutionService extends Service {
  static serviceType = "personality_evolution" as const;
  capabilityDescription = "Natural personality drift and evolution over time";

  private evolutionInterval: NodeJS.Timeout | null = null;
  protected runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<PersonalityEvolutionService> {
    const service = new PersonalityEvolutionService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    logger.info(
      "[PERSONALITY_EVOLUTION_SERVICE] Starting personality evolution background task",
    );

    // Start personality drift every hour
    this.evolutionInterval = setInterval(
      async () => {
        await this.applyNaturalDrift();
      },
      60 * 60 * 1000,
    ); // Every hour

    // Also run once on startup
    await this.applyNaturalDrift();
  }

  /**
   * Apply natural personality drift over time
   */
  private async applyNaturalDrift(): Promise<void> {
    try {
      const currentPersonality = await this.getPersonalityState();
      const driftChanges: Partial<PersonalityDimensions> = {};

      // Apply small random drift to each trait (-0.5 to +0.5)
      Object.keys(currentPersonality).forEach((trait) => {
        const drift = (Math.random() - 0.5) * 0.5;
        driftChanges[trait as keyof PersonalityDimensions] = drift;
      });

      await this.applyPersonalityChanges(driftChanges);

      logger.debug(
        "[PERSONALITY_EVOLUTION_SERVICE] Applied natural personality drift",
      );
    } catch (error) {
      logger.warn(
        "[PERSONALITY_EVOLUTION_SERVICE] Failed to apply personality drift:",
        error,
      );
    }
  }

  /**
   * Apply external personality changes (called by PersonalityEvolutionEvaluator)
   */
  async applyPersonalityChanges(
    changes: Partial<PersonalityDimensions>,
  ): Promise<void> {
    try {
      const currentPersonality = await this.getPersonalityState();
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

      // Store updated personality
      await this.storePersonalityState(updatedPersonality);

      // Log significant changes
      const significantChanges = Object.entries(changes).filter(
        ([_, change]) => Math.abs(change || 0) > 0.005,
      );
      if (significantChanges.length > 0) {
        logger.info(
          `[PERSONALITY_EVOLUTION_SERVICE] Applied changes: ${significantChanges.map(([trait, change]) => `${trait}: ${change?.toFixed(3)}`).join(", ")}`,
        );
      }
    } catch (error) {
      logger.error(
        "[PERSONALITY_EVOLUTION_SERVICE] Failed to apply personality changes:",
        error,
      );
    }
  }

  /**
   * Get current personality state
   */
  private async getPersonalityState(): Promise<PersonalityDimensions> {
    // Get YAML baseline personality or use hardcoded fallback
    const yamlConfig = (this.runtime as any).yamlConfigManager?.getConfig();
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

    try {
      const characterSettings = this.runtime.character?.settings;
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
        "[PERSONALITY_EVOLUTION_SERVICE] Could not load personality state, using YAML defaults",
      );
    }

    return defaultPersonality;
  }

  /**
   * Store personality state
   */
  private async storePersonalityState(
    personality: PersonalityDimensions,
  ): Promise<void> {
    try {
      if (this.runtime.character?.settings) {
        this.runtime.character.settings.personality = personality;
      }
    } catch (error) {
      logger.warn(
        "[PERSONALITY_EVOLUTION_SERVICE] Could not persist personality state:",
        error,
      );
    }
  }

  /**
   * Get current personality for external access
   */
  async getCurrentPersonality(): Promise<PersonalityDimensions> {
    return await this.getPersonalityState();
  }

  async stop(): Promise<void> {
    logger.info(
      "[PERSONALITY_EVOLUTION_SERVICE] Stopping personality evolution service",
    );

    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
      this.evolutionInterval = null;
    }
  }
}

// Extend ServiceTypeRegistry for proper typing
declare module "@elizaos/core" {
  interface ServiceTypeRegistry {
    personality_evolution: "personality_evolution";
  }
}

export default PersonalityEvolutionService;
