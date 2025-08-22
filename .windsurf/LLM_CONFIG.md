# LLM Configuration

## Providers
- Use `@elizaos/plugin-openai` (OPENAI_API_KEY required). Optionally Anthropic.

## Model Classes
- TEXT_SMALL: classification, routing, summaries.
- TEXT_LARGE: user-visible responses requiring quality.
- TEXT_EMBEDDING: retrieval/semantic memory.

## Runtime Usage
- Use `runtime.useModel(ModelType.TEXT_LARGE, { text, temperature, max_tokens, stop })` per `sessions-routes.ts`.
- Derive params from state when available (e.g., dynamic temperature/top_p/max_tokens).

## Cost Control
- Prefer small model for validators/evaluators.
- Batch embeddings; cache frequently used prompts/templates.
- Set conservative defaults: temperature≈0.7–0.9, max_tokens≈200–400 for chat.

## Safety
- Apply security evaluator before generation.
- Strip system-injection patterns from user context.
