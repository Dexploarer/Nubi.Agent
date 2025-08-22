import { Provider, IAgentRuntime, Memory, State, logger } from "@elizaos/core";

/**
 * Emotional State Provider
 *
 * Converted from the original NUBI emotional state machine.
 * Provides emotional context for response generation.
 *
 * Original location: nubi-service.ts:1230 - updateEmotionalState()
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

export const emotionalStateProvider: Provider = {
  name: "EMOTIONAL_STATE",
  description: "Provides current emotional state context for responses",

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<any> => {
    try {
      const text = message.content?.text?.toLowerCase() || "";

      // Get current emotional state from service
      const emotionalService = runtime.getService("emotional_state");
      let emotionalState;

      if (emotionalService) {
        emotionalState = await (emotionalService as any).getEmotionalState();
      } else {
        emotionalState = await getCurrentEmotionalState(runtime);
      }

      // Update emotional state based on message triggers
      const newState = analyzeEmotionalTriggers(text, emotionalState);

      // Update through service if available
      if (
        emotionalService &&
        newState.emotional.current !== emotionalState.current
      ) {
        await (emotionalService as any).triggerEmotionalState(
          newState.emotional.current,
          newState.emotional.intensity,
          text.substring(0, 50),
        );
      } else {
        // Fallback to direct update
        await updateEmotionalState(runtime, newState.emotional);
      }

      // Return emotional context for response generation
      return {
        // Current emotional state
        currentEmotion: newState.emotional.current,
        emotionalIntensity: newState.emotional.intensity,
        emotionalDuration: newState.emotional.duration,
        recentTriggers: newState.emotional.triggers.slice(-3),

        // Emotional markers for response style
        shouldShowEmotion:
          newState.emotional.intensity > 60 && Math.random() < 0.4,
        emotionalMarker: getEmotionalMarker(newState.emotional),
        intensityModifier: newState.emotional.intensity / 100,

        // State for template processing
        isIntense: newState.emotional.intensity > 80,
        isPersistent: Date.now() - newState.emotional.lastUpdate > 900000, // 15 min

        // Response modification hints
        responseStyle: getResponseStyle(newState.emotional),
        voiceModification: getVoiceModification(newState.emotional),
      };
    } catch (error) {
      logger.error("[EMOTIONAL_STATE_PROVIDER] Error:", error);

      // Return neutral emotional state on error
      return {
        currentEmotion: "neutral",
        emotionalIntensity: 50,
        shouldShowEmotion: false,
        emotionalMarker: "",
        intensityModifier: 0.5,
        responseStyle: "balanced",
      };
    }
  },
};

/**
 * Analyze text for emotional triggers and update state
 */
function analyzeEmotionalTriggers(
  text: string,
  currentState: EmotionalState,
): { emotional: EmotionalState } {
  const triggers = {
    excited: [
      "amazing",
      "incredible",
      "awesome",
      "bullish",
      "moon",
      "pump",
      "lfg",
      "wagmi",
      "holy shit",
    ],
    frustrated: [
      "broken",
      "down",
      "issue",
      "problem",
      "scam",
      "rug",
      "bearish",
      "dump",
      "fud",
    ],
    curious: [
      "how",
      "why",
      "what",
      "huh",
      "wonder",
      "explain",
      "understand",
      "learn",
    ],
    confident: [
      "know",
      "sure",
      "definitely",
      "obviously",
      "clearly",
      "certain",
      "fact",
    ],
    contemplative: [
      "think",
      "wonder",
      "perhaps",
      "maybe",
      "possibly",
      "consider",
      "ponder",
    ],
    playful: [
      "lol",
      "haha",
      "meme",
      "joke",
      "fun",
      "play",
      "funny",
      "kek",
      "based",
    ],
  };

  let newState = { ...currentState };
  let stateChanged = false;

  // Check for emotional triggers
  for (const [emotion, keywords] of Object.entries(triggers)) {
    const matchCount = keywords.filter((keyword) =>
      text.includes(keyword),
    ).length;

    if (matchCount > 0) {
      const emotionType = emotion as EmotionalStateType;

      // Higher intensity for multiple matches or if already in similar state
      let intensity = 60 + Math.random() * 40; // 60-100%
      if (matchCount > 1) intensity = Math.min(100, intensity + 15);
      if (newState.current === emotionType)
        intensity = Math.min(100, intensity + 10);

      newState = {
        current: emotionType,
        intensity: Math.round(intensity),
        duration: 0, // Reset duration
        persistence: 30 * 60 * 1000, // 30 minutes
        triggers: [...newState.triggers.slice(-9), text.substring(0, 50)], // Keep last 10
        lastUpdate: Date.now(),
      };

      stateChanged = true;

      logger.debug(
        `[EMOTIONAL_STATE] Triggered ${emotionType} with intensity ${intensity} from: ${text.substring(0, 30)}`,
      );
      break; // Use first match
    }
  }

  return { emotional: newState };
}

/**
 * Apply emotional decay over time
 */
function applyEmotionalDecay(state: EmotionalState): EmotionalState {
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
 * Get emotional marker for responses
 */
function getEmotionalMarker(state: EmotionalState): string {
  const markers = {
    excited: ["🚀", "🔥", "⚡", "💪", "🌙", "📈"],
    frustrated: ["😤", "🙄", "😮‍💨", "💸", "📉", "🤦"],
    curious: ["🤔", "👀", "🧐", "❓", "💭", "🔍"],
    confident: ["😎", "💯", "✅", "📊", "💎", "🎯"],
    contemplative: ["🤲", "🙏", "💭", "⚖️", "🔮", "✨"],
    playful: ["😄", "🤝", "👀", "🎉", "🔥", "💪"],
    neutral: ["", "", "", "👍", "🤝", ""],
  };

  const emotionMarkers = markers[state.current] || markers.neutral;
  return emotionMarkers[Math.floor(Math.random() * emotionMarkers.length)];
}

/**
 * Get response style based on emotional state
 */
function getResponseStyle(state: EmotionalState): string {
  const styles = {
    excited: "enthusiastic",
    frustrated: "direct",
    curious: "inquisitive",
    confident: "authoritative",
    contemplative: "reflective",
    playful: "casual",
    neutral: "balanced",
  };

  return styles[state.current] || "balanced";
}

/**
 * Get voice modification based on emotional state
 */
function getVoiceModification(state: EmotionalState): any {
  const modifications = {
    excited: {
      capitalization: state.intensity > 80 ? "CAPS" : "normal",
      punctuation: state.intensity > 70 ? "excited" : "normal",
      prefixes: ["holy shit", "lfg", "wagmi"],
    },
    frustrated: {
      punctuation: "trailing",
      prefixes: ["ugh", "seriously"],
      style: "lowercase",
    },
    curious: {
      questions: true,
      prefixes: ["hmm", "interesting"],
    },
    confident: {
      tone: "definitive",
      prefixes: ["clearly", "obviously"],
    },
    contemplative: {
      ellipsis: true,
      prefixes: ["thinking about this", "pondering"],
    },
    playful: {
      emojis: true,
      slang: true,
      prefixes: ["lol", "ngl"],
    },
    neutral: {},
  };

  return modifications[state.current] || {};
}

/**
 * Get current emotional state from runtime storage
 */
async function getCurrentEmotionalState(
  runtime: IAgentRuntime,
): Promise<EmotionalState> {
  const defaultState: EmotionalState = {
    current: "neutral",
    intensity: 50,
    duration: 0,
    persistence: 30 * 60 * 1000, // 30 minutes
    triggers: [],
    lastUpdate: Date.now(),
  };

  try {
    // Try to get from character settings or runtime state
    const stored = runtime.character?.settings?.emotionalState;
    if (stored && typeof stored === "object") {
      return { ...defaultState, ...stored };
    }
  } catch (error) {
    logger.warn("[EMOTIONAL_STATE] Could not load state, using default");
  }

  return defaultState;
}

/**
 * Update emotional state in runtime storage
 */
async function updateEmotionalState(
  runtime: IAgentRuntime,
  state: EmotionalState,
): Promise<void> {
  try {
    if (runtime.character?.settings) {
      runtime.character.settings.emotionalState = state;
    }
  } catch (error) {
    logger.warn("[EMOTIONAL_STATE] Could not persist state:", error);
  }
}

export default emotionalStateProvider;
