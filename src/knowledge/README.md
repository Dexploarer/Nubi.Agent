# Knowledge Base for NUBI Agent

This directory contains knowledge files for the NUBI agent, configured to work with the `@elizaos/plugin-knowledge` for RAG (Retrieval-Augmented Generation) functionality.

## Structure

```
src/knowledge/
├── README.md                    # This file
├── config.json                  # Knowledge plugin configuration
├── index.md                     # Comprehensive knowledge base index
├── anubis-chat-platform.md      # Platform overview and features
├── conversation-patterns.md     # Conversation flow patterns
├── creativity-innovation.md     # Creative thinking approaches
├── emotional-intelligence.md    # Emotional context understanding
├── technical-expertise.md       # Technical knowledge and skills
├── agent-capabilities.md        # AI agent capabilities
├── solana-ecosystem.md          # Complete Solana ecosystem knowledge
├── web3-culture.md              # Crypto culture and community dynamics
├── market-analysis.md           # Trading psychology and market analysis
├── community-management.md      # Community building and moderation
├── development-practices.md     # Modern development methodologies
├── security-privacy.md          # Web3 security and privacy
├── content-creation.md          # Social media and content strategy
└── business-strategy.md         # Startup and business strategy
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

## Knowledge Base Overview

### Core Platform Knowledge

- **Anubis.Chat Platform**: Complete platform overview, features, competitive advantages
- **Technical Expertise**: Development knowledge, problem-solving, best practices
- **Agent Capabilities**: AI agent capabilities, limitations, and human-like behaviors

### Interaction & Communication

- **Conversation Patterns**: Natural conversation flow, engagement strategies
- **Emotional Intelligence**: Human psychology, empathy, relationship dynamics
- **Creativity & Innovation**: Creative thinking, innovation frameworks, problem-solving

### Enhanced Knowledge Domains

- **Solana Ecosystem**: Complete Solana knowledge, DeFi, NFTs, protocols
- **Web3 Culture**: Crypto culture, memes, community dynamics, trends
- **Market Analysis**: Trading psychology, market cycles, technical analysis
- **Community Management**: Community building, moderation, engagement
- **Development Practices**: Modern development, best practices, tools
- **Security & Privacy**: Web3 security, privacy, best practices
- **Content Creation**: Social media, content strategy, engagement
- **Business Strategy**: Startup knowledge, growth, monetization

## Content Statistics

- **Total Files**: 15 knowledge documents
- **Estimated Tokens**: ~75,000+ words of comprehensive knowledge
- **Coverage Areas**: 12 major domains with deep expertise
- **Update Frequency**: Regular updates based on platform evolution
- **RAG Optimization**: Chunked for optimal retrieval and context

## Best Practices

- Use clear, descriptive filenames
- Include relevant tags in config.json
- Keep content focused and well-structured
- Update knowledge regularly as the platform evolves
- Cross-reference related topics across files
- Maintain consistent formatting and organization
