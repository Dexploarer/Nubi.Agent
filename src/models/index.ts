// Model configurations for ElizaOS

// ElizaOS-compliant model configurations
export const TEXT_SMALL = {
  name: "gpt-4o-mini",
  provider: "openai" as any,
  config: {
    temperature: 0.7,
    maxTokens: 2048,
  },
};

export const TEXT_LARGE = {
  name: "gpt-4o",
  provider: "openai" as any,
  config: {
    temperature: 0.8,
    maxTokens: 4096,
  },
};

// Export models for plugin
export const models = {
  TEXT_SMALL,
  TEXT_LARGE,
};

export default models;
