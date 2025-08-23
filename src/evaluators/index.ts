// Evaluators - Core processing components for message analysis and response enhancement
export { antiDetectionPostProcessor } from "./anti-detection-post-processor";
export { personalityEvolutionEvaluator } from "./personality-evolution";
export { communityTrackingEvaluator } from "./community-tracking-evaluator";
export { securityEvaluator } from "./security-evaluator";
export { raidSuccessEvaluator } from "./raid-success-evaluator";
export { ResponseStrategyEvaluator } from "./response-strategy-evaluator";

// Re-export default exports for backward compatibility
export { default as securityEvaluatorDefault } from "./security-evaluator";
export { default as antiDetectionPostProcessorDefault } from "./anti-detection-post-processor";
export { default as personalityEvolutionEvaluatorDefault } from "./personality-evolution";
export { default as communityTrackingEvaluatorDefault } from "./community-tracking-evaluator";
export { default as raidSuccessEvaluatorDefault } from "./raid-success-evaluator";

// Evaluator execution order (as defined in nubi-plugin.ts):
// 1. securityEvaluator - FIRST - security filter runs before all other evaluators
// 2. sessionStateEvaluator - Session state management
// 3. personalityEvolutionEvaluator - Personality trait evolution
// 4. raidSuccessEvaluator - Raid metrics tracking and participant management
// 5. antiDetectionPostProcessor - Response humanization
// 6. communityTrackingEvaluator - Community engagement tracking

// Note: Types are defined internally in evaluators, not exported to keep them encapsulated
