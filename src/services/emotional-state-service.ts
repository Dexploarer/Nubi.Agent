import { Service, IAgentRuntime, logger, ServiceType } from "@elizaos/core";

/**
 * Emotional State Service
 *
 * Background service that manages emotional state persistence and decay.
 * Implements proper ElizaOS Service pattern.
 *
 * Original: Extracted from nubi-service.ts startEmotionalTracking()
 */

export type EmotionalStateType =
  | "neutral"
  | "excited"
  | "frustrated"
  | "curious"
  | "confident"
  | "contemplative"
  | "playful";

interface EmotionalState {
  current: EmotionalStateType;
  intensity: number; // 60-100%
  duration: number; // milliseconds
  persistence: number; // 30 minutes default
  triggers: string[];
  lastUpdate: number;
}

export class EmotionalStateService extends Service {
  static serviceType = "emotional_state" as const;
  capabilityDescription = "Emotional state persistence and decay management";

  private decayInterval: NodeJS.Timeout | null = null;
  protected runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<EmotionalStateService> {
    const service = new EmotionalStateService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    logger.info(
      "[EMOTIONAL_STATE_SERVICE] Starting emotional state management",
    );

    // Check for emotional decay every 5 minutes
    this.decayInterval = setInterval(
      async () => {
        await this.processEmotionalDecay();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    // Initialize with neutral state if needed
    await this.ensureEmotionalState();
  }

  /**
   * Process emotional decay over time
   */
  private async processEmotionalDecay(): Promise<void> {
    try {
      const currentState = await this.getEmotionalState();
      const decayedState = this.applyEmotionalDecay(currentState);

      // Only update if state changed
      if (
        decayedState.current !== currentState.current ||
        Math.abs(decayedState.intensity - currentState.intensity) > 1
      ) {
        await this.updateEmotionalState(decayedState);
        logger.debug(
          `[EMOTIONAL_STATE_SERVICE] Applied decay: ${decayedState.current} (${decayedState.intensity}%)`,
        );
      }
    } catch (error) {
      logger.warn(
        "[EMOTIONAL_STATE_SERVICE] Failed to process emotional decay:",
        error,
      );
    }
  }

  /**
   * Apply emotional decay logic
   */
  private applyEmotionalDecay(state: EmotionalState): EmotionalState {
    const now = Date.now();
    const timeSinceUpdate = now - state.lastUpdate;

    // If within persistence window, just update duration
    if (timeSinceUpdate < state.persistence) {
      return {
        ...state,
        duration: state.duration + timeSinceUpdate,
        lastUpdate: now,
      };
    }

    // Apply decay
    const decayRate = 2; // points per minute
    const minutesPassed = timeSinceUpdate / (60 * 1000);
    const intensityDecay = minutesPassed * decayRate;

    const newIntensity = Math.max(30, state.intensity - intensityDecay);

    // Return to neutral if intensity is too low
    if (newIntensity <= 35) {
      return {
        current: "neutral",
        intensity: 50,
        duration: 0,
        persistence: state.persistence,
        triggers: [],
        lastUpdate: now,
      };
    }

    return {
      ...state,
      intensity: Math.round(newIntensity),
      duration: state.duration + timeSinceUpdate,
      lastUpdate: now,
    };
  }

  /**
   * Update emotional state (called by EmotionalStateProvider)
   */
  async updateEmotionalState(state: EmotionalState): Promise<void> {
    try {
      if (this.runtime.character?.settings) {
        this.runtime.character.settings.emotionalState = state;
      }
    } catch (error) {
      logger.warn(
        "[EMOTIONAL_STATE_SERVICE] Could not persist emotional state:",
        error,
      );
    }
  }

  /**
   * Get current emotional state
   */
  async getEmotionalState(): Promise<EmotionalState> {
    const defaultState: EmotionalState = {
      current: "neutral",
      intensity: 50,
      duration: 0,
      persistence: 30 * 60 * 1000, // 30 minutes
      triggers: [],
      lastUpdate: Date.now(),
    };

    try {
      const stored = this.runtime.character?.settings?.emotionalState;
      if (stored && typeof stored === "object") {
        return { ...defaultState, ...stored };
      }
    } catch (error) {
      logger.warn(
        "[EMOTIONAL_STATE_SERVICE] Could not load emotional state, using default",
      );
    }

    return defaultState;
  }

  /**
   * Ensure emotional state exists
   */
  private async ensureEmotionalState(): Promise<void> {
    const state = await this.getEmotionalState();
    await this.updateEmotionalState(state);
  }

  /**
   * Trigger emotional state change (called externally)
   */
  async triggerEmotionalState(
    emotion: EmotionalStateType,
    intensity: number,
    trigger: string,
  ): Promise<void> {
    const currentState = await this.getEmotionalState();

    // Higher intensity for multiple matches or if already in similar state
    let finalIntensity = Math.max(60, intensity);
    if (currentState.current === emotion) {
      finalIntensity = Math.min(100, finalIntensity + 10);
    }

    const newState: EmotionalState = {
      current: emotion,
      intensity: Math.round(finalIntensity),
      duration: 0, // Reset duration
      persistence: 30 * 60 * 1000, // 30 minutes
      triggers: [...currentState.triggers.slice(-9), trigger.substring(0, 50)], // Keep last 10
      lastUpdate: Date.now(),
    };

    await this.updateEmotionalState(newState);

    logger.debug(
      `[EMOTIONAL_STATE_SERVICE] Triggered ${emotion} with intensity ${finalIntensity}% from: ${trigger.substring(0, 30)}`,
    );
  }

  /**
   * Get emotional state summary for external access
   */
  async getEmotionalSummary(): Promise<{
    emotion: EmotionalStateType;
    intensity: number;
    duration: number;
    recentTriggers: string[];
  }> {
    const state = await this.getEmotionalState();
    return {
      emotion: state.current,
      intensity: state.intensity,
      duration: state.duration,
      recentTriggers: state.triggers.slice(-3),
    };
  }

  async stop(): Promise<void> {
    logger.info("[EMOTIONAL_STATE_SERVICE] Stopping emotional state service");

    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
  }
}

// Extend ServiceTypeRegistry for proper typing
declare module "@elizaos/core" {
  interface ServiceTypeRegistry {
    emotional_state: "emotional_state";
  }
}

export default EmotionalStateService;
