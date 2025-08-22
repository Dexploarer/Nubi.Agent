export { default } from "./nubi-plugin";
export * from "./nubi-plugin";

// Export models for ElizaOS compatibility
export {
  TEXT_SMALL,
  TEXT_LARGE,
  TEXT_CREATIVE,
  TEXT_ANALYTICAL,
  TEXT_EMBEDDING,
  models,
  modelUtils,
  type NubiModelConfig,
} from "../models";
