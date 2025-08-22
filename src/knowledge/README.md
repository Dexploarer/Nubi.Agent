# Knowledge Base for NUBI Agent

This directory contains knowledge files for the NUBI agent, configured to work with the `@elizaos/plugin-knowledge` for RAG (Retrieval-Augmented Generation) functionality.

## Structure

```
src/knowledge/
├── README.md                    # This file
├── config.json                  # Knowledge plugin configuration
├── anubis-chat-platform.md      # Platform overview and features
├── conversation-patterns.md     # Conversation flow patterns
├── creativity-innovation.md     # Creative thinking approaches
├── emotional-intelligence.md    # Emotional context understanding
├── technical-expertise.md       # Technical knowledge and skills
└── agent-capabilities.md        # AI agent capabilities
```

## Usage

The knowledge files are automatically loaded by the `@elizaos/plugin-knowledge` plugin when the NUBI agent starts. The plugin will:

1. **Chunk the documents** into smaller pieces for better retrieval
2. **Generate embeddings** for semantic search
3. **Store in vector database** for fast retrieval
4. **Retrieve relevant context** when responding to user queries

## Configuration

The knowledge configuration is defined in:

- `config.json` - Plugin-specific settings
- `src/nubi-character.ts` - Character knowledge configuration

## Adding New Knowledge

To add new knowledge files:

1. Add the markdown file to this directory
2. Update `config.json` with file metadata
3. Add the file path to the `knowledge.files` array in `nubi-character.ts`
4. Restart the agent to reload knowledge

## RAG Settings

- **Chunk Size**: 1000 characters
- **Chunk Overlap**: 200 characters
- **Retrieval Limit**: 5 chunks per query
- **Similarity Threshold**: 0.7 (70% similarity required)

## Best Practices

- Use clear, descriptive filenames
- Include relevant tags in config.json
- Keep content focused and well-structured
- Update knowledge regularly as the platform evolves
