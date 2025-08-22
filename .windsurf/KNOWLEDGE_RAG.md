# Knowledge (RAG) Guide

## Plugin
- Use `@elizaos/plugin-knowledge` when retrieval is needed.

## Embeddings
- Ensure `TEXT_EMBEDDING` model configured; batch and cache embeddings.

## Ingestion
- Only supported types; normalize text (lowercasing, stripping markup) and chunk with overlap.

## Retrieval
- Top-k small (e.g., 3–5); deduplicate semantically similar chunks.
- Insert retrieved context into `state` minimally; avoid prompt bloat.

## Evaluation
- Track hit rate and response quality via `messaging_analytics` service.
