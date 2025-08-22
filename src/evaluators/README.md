# Evaluators

Core processing components for message analysis and response enhancement in the NUBI ElizaOS agent.

## Overview

Evaluators are specialized components that analyze and process messages at different stages of the conversation pipeline. They run in a specific order to ensure proper security, personality evolution, and response quality.

## Execution Order

1. **securityEvaluator** - FIRST - Security filter runs before all other evaluators
2. **sessionStateEvaluator** - Session state management and context tracking
3. **personalityEvolutionEvaluator** - Personality trait evolution based on interactions
4. **antiDetectionPostProcessor** - Response humanization and natural variation
5. **communityTrackingEvaluator** - Community engagement tracking and analytics

## Evaluator Details

### Security Evaluator (`security-evaluator.ts`)
- **Purpose**: Filters malicious requests and protects against prompt injection and spam
- **Execution**: Runs on ALL incoming user messages (highest priority)
- **Performance**: < 10ms typical; no LLM calls by default
- **Features**:
  - Blocks malicious content before processing
  - Integrates with SecurityFilter service
  - Graceful degradation if security service unavailable
  - Comprehensive logging for security events

### Session State Evaluator (`sessionStateEvaluator` in nubi-plugin.ts)
- **Purpose**: Manages conversation sessions with advanced state persistence
- **Execution**: 33% probability on user messages
- **Features**:
  - Analyzes conversation evolution
  - Determines relationship progression
  - Tracks conversation depth and message patterns
  - Provides context for other evaluators

### Personality Evolution Evaluator (`personality-evolution.ts`)
- **Purpose**: Evolves personality traits based on conversation interactions
- **Execution**: Runs on incoming user messages
- **Features**:
  - Dynamic personality trait adjustment
  - Solana maximalism evolution
  - Empathy and humor level adaptation
  - Integration with YAML configuration
  - Persistent personality state management

### Anti-Detection Post-Processor (`anti-detection-post-processor.ts`)
- **Purpose**: Applies humanization patterns to responses for natural variation
- **Execution**: 30% probability on agent responses
- **Performance Optimizations**:
  - LRU cache for conversation memories with automatic cleanup
  - Pre-compiled regex patterns for better performance
  - Bounded memory usage (max 1000 conversation memories)
  - Periodic cleanup every 5 minutes
  - Memory eviction after 1 hour of inactivity
- **Features**:
  - Article variation and typo introduction
  - Phrase rotation and personalization
  - Formality adjustment based on conversation history
  - Emotional state integration
  - Human-like moments and tangents

### Community Tracking Evaluator (`community-tracking-evaluator.ts`)
- **Purpose**: Tracks user interactions and community engagement patterns
- **Execution**: Runs on incoming user messages
- **Features**:
  - Integration with CommunityManagementService
  - Sentiment tracking and analysis
  - User interaction metrics
  - Background analytics processing

## Performance Guidelines

### Memory Management
- All evaluators use bounded collections to prevent memory leaks
- LRU eviction for conversation memories
- Periodic cleanup of stale data
- Maximum cache sizes enforced

### Processing Efficiency
- Security evaluator: < 10ms typical
- Other evaluators: avoid cascaded LLM chains
- Sample to <= 33% frequency unless critical
- Pre-compiled regex patterns for text processing

### Error Handling
- Graceful degradation on service failures
- Comprehensive error logging
- Fallback behaviors to prevent system disruption
- Security-first approach with fail-open on errors

## Configuration

### YAML Integration
Evaluators integrate with the YAML configuration system:
- Personality traits from `agent.personality`
- Response patterns from `agent.response_patterns`
- Security settings from security service configuration

### Environment Variables
- `ANUBIS_TYPO_RATE`: Typo introduction probability (default: 0.03)
- `ANUBIS_CONTRADICTION_RATE`: Contradiction rate (default: 0.15)
- `ANUBIS_EMOTIONAL_PERSISTENCE`: Emotional state persistence (default: 1800000ms)

## Usage

### Importing Evaluators
```typescript
import {
  securityEvaluator,
  personalityEvolutionEvaluator,
  antiDetectionPostProcessor,
  communityTrackingEvaluator
} from './evaluators';
```

### Plugin Integration
Evaluators are automatically integrated into the NUBI plugin:
```typescript
const nubiPlugin: Plugin = {
  evaluators: [
    securityEvaluator, // FIRST - security filter
    sessionStateEvaluator,
    personalityEvolutionEvaluator,
    antiDetectionPostProcessor,
    communityTrackingEvaluator,
  ],
  // ... other plugin configuration
};
```

## Monitoring and Debugging

### Logging
All evaluators use structured logging with consistent prefixes:
- `[SECURITY_EVALUATOR]` - Security-related events
- `[PERSONALITY_EVOLUTION]` - Personality changes
- `[ANTI_DETECTION]` - Humanization patterns applied
- `[COMMUNITY_TRACKING]` - Community analytics

### Metrics
Evaluators contribute to the overall system metrics:
- Message processing times
- Pattern application rates
- Security violation counts
- Personality evolution tracking

## Future Enhancements

### Planned Optimizations
- Database-backed conversation memory for persistence
- Machine learning-based pattern selection
- Real-time performance monitoring
- A/B testing framework for pattern effectiveness

### Extensibility
- Plugin architecture for custom evaluators
- Configuration-driven pattern management
- Integration with external analytics services
- Cross-platform personality synchronization

## Troubleshooting

### Common Issues
1. **Memory Leaks**: Check conversation memory cleanup intervals
2. **Performance Degradation**: Monitor regex pattern compilation
3. **Security False Positives**: Review security filter configuration
4. **Personality Drift**: Verify personality state persistence

### Debug Mode
Enable debug logging for detailed evaluator activity:
```typescript
process.env.LOG_LEVEL = 'debug';
```

## Contributing

When adding new evaluators:
1. Follow the established naming conventions
2. Implement proper error handling
3. Add comprehensive logging
4. Include performance optimizations
5. Update this documentation
6. Add appropriate tests
