import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
} from "@elizaos/core";

/**
 * Dynamic Model Parameters Provider
 *
 * Adjusts model parameters based on:
 * - Current emotional state
 * - Relationship context
 * - Message complexity
 * - Community context
 */
export const dynamicModelParametersProvider: Provider = {
  name: "DYNAMIC_MODEL_PARAMETERS",
  description:
    "Dynamically adjusts model parameters based on emotional and contextual state",
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      // Get NUBI context if available
      const nubiContext = (state as any).nubiContext;
      const baseTemperature = 0.8; // Default from character
      const baseTopP = 0.9;

      // Calculate dynamic parameters
      const parameters = calculateDynamicParameters(nubiContext, message, {
        baseTemperature,
        baseTopP,
        baseFrequencyPenalty: 0.6,
        basePresencePenalty: 0.6,
      });

      const parameterText = `model_parameters: temperature=${parameters.temperature}, topP=${parameters.topP}, creativity=${parameters.creativityLevel}`;

      logger.debug(
        "[DYNAMIC_PARAMETERS] Applied: " +
          `temp=${parameters.temperature}, ` +
          `topP=${parameters.topP}, ` +
          `reason=${parameters.reason}`,
      );

      return {
        text: parameterText,
        values: {
          dynamicTemperature: parameters.temperature,
          dynamicTopP: parameters.topP,
          dynamicFrequencyPenalty: parameters.frequencyPenalty,
          dynamicPresencePenalty: parameters.presencePenalty,
          creativityLevel: parameters.creativityLevel,
          adjustmentReason: parameters.reason,
          modelClass: parameters.modelClass,
          maxTokens: parameters.maxTokens,
        },
        data: {
          parameters,
          originalContext: nubiContext,
          messageAnalysis: analyzeMessageForParameters(message),
        },
      };
    } catch (error) {
      logger.error("[DYNAMIC_PARAMETERS] Error calculating parameters:", error);

      // Fallback to defaults
      return {
        text: "model_parameters: default settings",
        values: {
          dynamicTemperature: 0.8,
          dynamicTopP: 0.9,
          creativityLevel: "moderate",
        },
        data: { error: true },
      };
    }
  },
};

interface BaseParameters {
  baseTemperature: number;
  baseTopP: number;
  baseFrequencyPenalty: number;
  basePresencePenalty: number;
}

interface DynamicParameters {
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  creativityLevel: string;
  modelClass: string;
  maxTokens: number;
  reason: string;
}

/**
 * Calculate dynamic parameters based on context
 */
function calculateDynamicParameters(
  nubiContext: any,
  message: Memory,
  base: BaseParameters,
): DynamicParameters {
  let temperature = base.baseTemperature;
  let topP = base.baseTopP;
  let frequencyPenalty = base.baseFrequencyPenalty;
  let presencePenalty = base.basePresencePenalty;
  let modelClass = "MEDIUM";
  let maxTokens = 400;
  const reasons: string[] = [];

  // Emotional state adjustments
  if (nubiContext?.emotionalState) {
    const emotion = nubiContext.emotionalState.current_state;
    const intensity = nubiContext.emotionalState.intensity || 70;

    switch (emotion) {
      case "excited":
        temperature = Math.min(temperature + intensity / 1000, 1.0);
        topP = Math.min(topP + 0.05, 0.95);
        maxTokens = Math.min(maxTokens + 200, 800);
        reasons.push("excited_emotion");
        break;

      case "contemplative":
        temperature = Math.max(temperature - 0.1, 0.2);
        topP = Math.max(topP - 0.1, 0.7);
        presencePenalty = Math.min(presencePenalty + 0.1, 1.0);
        maxTokens = Math.min(maxTokens + 300, 800);
        modelClass = "LARGE";
        reasons.push("contemplative_emotion");
        break;

      case "playful":
        temperature = Math.min(temperature + 0.15, 0.95);
        frequencyPenalty = Math.max(frequencyPenalty - 0.2, 0.0);
        reasons.push("playful_emotion");
        break;

      case "frustrated":
        temperature = Math.max(temperature - 0.05, 0.6);
        presencePenalty = Math.min(presencePenalty + 0.1, 1.0);
        reasons.push("frustrated_emotion_controlled");
        break;

      case "supportive":
        temperature = Math.max(temperature - 0.1, 0.6);
        topP = Math.max(topP - 0.05, 0.8);
        maxTokens = Math.min(maxTokens + 150, 600);
        reasons.push("supportive_tone");
        break;
    }
  }

  // Relationship context adjustments
  if (nubiContext?.relationshipContext) {
    switch (nubiContext.relationshipContext) {
      case "close_friend":
        temperature = Math.min(temperature + 0.1, 0.95);
        frequencyPenalty = Math.max(frequencyPenalty - 0.1, 0.1);
        maxTokens = Math.min(maxTokens + 200, 800);
        reasons.push("close_relationship");
        break;

      case "new":
        temperature = Math.max(temperature - 0.05, 0.65);
        presencePenalty = Math.min(presencePenalty + 0.05, 1.0);
        maxTokens = Math.min(maxTokens - 100, 200);
        reasons.push("new_user_caution");
        break;
    }
  }

  // Message complexity adjustments
  const messageAnalysis = analyzeMessageForParameters(message);
  if (messageAnalysis.isComplex) {
    temperature = Math.max(temperature - 0.05, 0.6);
    modelClass = "LARGE";
    maxTokens = Math.min(maxTokens + 300, 800);
    reasons.push("complex_query");
  }

  if (messageAnalysis.isTechnical) {
    temperature = Math.max(temperature - 0.1, 0.6);
    topP = Math.max(topP - 0.05, 0.8);
    modelClass = "LARGE";
    maxTokens = Math.min(maxTokens + 200, 800);
    reasons.push("technical_content");
  }

  // User records context
  if (nubiContext?.userRecords?.length > 3) {
    // User has extensive history, can be more personalized
    frequencyPenalty = Math.max(frequencyPenalty - 0.1, 0.1);
    maxTokens = Math.min(maxTokens + 100, 600);
    reasons.push("personalized_context");
  }

  // Community context adjustments
  if (nubiContext?.communityContext?.participants > 5) {
    // Large group conversation, be more measured
    temperature = Math.max(temperature - 0.05, 0.7);
    presencePenalty = Math.min(presencePenalty + 0.05, 1.0);
    reasons.push("group_conversation");
  }

  // Determine creativity level
  let creativityLevel = "moderate";
  if (temperature > 0.85) creativityLevel = "high";
  else if (temperature < 0.7) creativityLevel = "focused";

  return {
    temperature: Math.round(temperature * 100) / 100,
    topP: Math.round(topP * 100) / 100,
    frequencyPenalty: Math.round(frequencyPenalty * 100) / 100,
    presencePenalty: Math.round(presencePenalty * 100) / 100,
    creativityLevel,
    modelClass,
    maxTokens,
    reason: reasons.join("+") || "default",
  };
}

/**
 * Analyze message for parameter adjustments
 */
function analyzeMessageForParameters(message: Memory): {
  isComplex: boolean;
  isTechnical: boolean;
  isEmotional: boolean;
  wordCount: number;
} {
  const text = message.content.text || "";
  const wordCount = text.split(/\s+/).length;

  const technicalKeywords =
    /crypto|defi|smart contract|blockchain|solana|ethereum|trading|technical|debug|code|function|api/i;
  const complexityIndicators =
    /because|however|therefore|furthermore|moreover|consequently|specifically/i;
  const emotionalIndicators =
    /love|hate|frustrated|excited|amazing|terrible|awesome|worried|concerned/i;

  return {
    isComplex: wordCount > 15 || complexityIndicators.test(text),
    isTechnical: technicalKeywords.test(text),
    isEmotional: emotionalIndicators.test(text),
    wordCount,
  };
}

export default dynamicModelParametersProvider;
