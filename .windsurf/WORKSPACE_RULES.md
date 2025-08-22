# ElizaOS Comprehensive Workspace Rules & Development Guidelines

These comprehensive rules govern how we build, test, and operate this ElizaOS-based project. They combine project-specific patterns with extensive ElizaOS framework guidelines derived from official documentation.

## Project-Specific Context

Key references in this repo:
- Plugin entry: `src/nubi-plugin.ts` and `src/plugin.ts`
- Providers: `src/providers.ts` and `src/providers/*`
- Evaluators: `src/evaluators/*`
- Services: `src/services/*`
- Config: `src/config/environment.ts`, `src/config/yaml-config-manager.ts`
- Sessions routes: `src/routes/sessions-routes.ts` (mounted in `nubi-plugin.routes`)
- Scripts and tooling: `package.json`

Official docs (selected):
- Core Concepts: Agents, Plugins, Projects, Architecture, Runtime, Services
- Bootstrap: Message flow, Examples, Testing, Complete Developer Guide
- Guides: Sessions API, Compose State, Socket.IO, MCP setup, Plugin Developer/Publishing/Schema
- Plugins: LLM (OpenAI), SQL, Knowledge, Platform (Discord/Telegram)

---

## 1) Golden Principles
- **Security-first**: run security evaluators first; never execute unvalidated user inputs.
- **Single source of truth**: register all components in `src/nubi-plugin.ts`.
- **Separation of concerns**: Actions do orchestration; Services do I/O/integrations; Providers/evaluators do state/analysis.
- **State before action**: build context with `runtime.composeState`/providers prior to response/action logic.
- **Performance-aware**: keep providers small, memory queries bounded, and model usage cost-aware.

## 2) Repository Structure & Conventions
- **Actions**: `src/actions/` ➜ register in `nubi-plugin.actions` via `withActionMiddleware(...)`.
- **Providers**: `src/providers/` ➜ register in `nubi-plugin.providers`.
- **Evaluators**: `src/evaluators/` ➜ register in `nubi-plugin.evaluators`.
- **Services**: `src/services/` ➜ register in `nubi-plugin.services`.
- **Config**: `src/config/` for environment and YAML config management.
- **Migrations**: `src/migrations/` for database schema changes.
- **Testing**: Follow official patterns; use `jest` and e2e test suites.


---

# ELIZAOS FRAMEWORK COMPREHENSIVE DEVELOPMENT RULES


# ElizaOS Framework: Comprehensive Development Rules & Guidelines

This document contains extensive rules and guidelines for developing with the ElizaOS framework, extracted from comprehensive documentation analysis. It serves as the definitive reference for building AI agents, plugins, and applications within the ElizaOS ecosystem.

## Table of Contents

1. [Core Framework Architecture](#core-framework-architecture)
2. [Agent Development](#agent-development) 
3. [Plugin System Architecture](#plugin-system-architecture)
4. [Bootstrap Plugin System](#bootstrap-plugin-system)
5. [Database & Schema Management](#database--schema-management)
6. [Platform Integrations](#platform-integrations)
7. [LLM Provider Integration](#llm-provider-integration)
8. [API & Messaging System](#api--messaging-system)
9. [Sessions Architecture](#sessions-architecture)
10. [Testing & Development Practices](#testing--development-practices)
11. [Security & Performance](#security--performance)
12. [Deployment & Publishing](#deployment--publishing)

---

## Core Framework Architecture

### System Architecture Principles

**1. Modular Plugin-Based Architecture**
- ElizaOS follows a strict plugin-based architecture where functionality is extended through plugins
- Core runtime orchestrates all components without direct functional implementation
- Plugins are loaded with priority-based ordering: databases (-100), model providers (-50), core (0), features (50), platforms (100)
- Each plugin must implement the standardized Plugin interface

**2. AgentRuntime as Central Orchestrator**
The AgentRuntime serves as the central orchestrator that:
- Manages agent lifecycle and plugin coordination
- Processes messages through the message pipeline
- Handles state composition from multiple providers
- Manages services and background processes
- Coordinates memory operations and persistence

**3. State Management Flow**
```typescript
// State flows through the system in this order:
// 1. Providers contribute context data
// 2. Runtime composes unified state
// 3. Actions use state for decisions
// 4. Evaluators process results post-execution
```

**4. Memory System Hierarchy**
- **Messages**: Conversation history and communication records
- **Facts**: Extracted information and learned knowledge  
- **Documents**: Knowledge base and document storage
- **Relationships**: Entity connections and social graph data
- **Entities**: People, bots, and objects in the system

### Plugin Loading and Priority System

**Plugin Load Order (Critical):**
```typescript
const pluginLoadOrder = [
  databases,        // Priority: -100 (SQL, database adapters)
  modelProviders,   // Priority: -50  (OpenAI, Anthropic, etc.)
  corePlugins,      // Priority: 0    (Bootstrap)
  features,         // Priority: 50   (Knowledge, custom features)  
  platforms         // Priority: 100  (Discord, Telegram, etc.)
];
```

**Environment-Based Conditional Loading:**
```typescript
plugins: [
  // Core plugins first (always loaded)
  '@elizaos/plugin-sql',
  '@elizaos/plugin-bootstrap', // Essential - must be included
  
  // LLM providers (conditional)
  ...(process.env.OPENAI_API_KEY ? ['@elizaos/plugin-openai'] : []),
  ...(process.env.ANTHROPIC_API_KEY ? ['@elizaos/plugin-anthropic'] : []),
  
  // Platform integrations (conditional) 
  ...(process.env.DISCORD_API_TOKEN ? ['@elizaos/plugin-discord'] : []),
  ...(process.env.TELEGRAM_BOT_TOKEN ? ['@elizaos/plugin-telegram'] : []),
]
```

---

## Agent Development

### Character Interface (Complete Specification)

**Required Properties:**
- `name`: string - Agent's display name (required)
- `bio`: string | string[] - Agent description (required)

**Optional Configuration Properties:**
- `system`: string - System prompt defining behavior
- `plugins`: string[] - Array of plugin names to enable  
- `settings`: Record<string, any> - Configuration and secrets
- `style`: StyleConfiguration - Behavioral guidelines
- `topics`: string[] - Areas of expertise
- `adjectives`: string[] - Personality descriptors  
- `knowledge`: string[] - Knowledge base entries
- `clients`: string[] - Platform integrations to enable
- `templates`: TemplateConfiguration - Custom prompt templates

**Character Definition Example:**
```typescript
import { Character } from '@elizaos/core';

export const character: Character = {
  name: "TechnicalAssistant",
  bio: [
    "Expert technical AI assistant",
    "Specializes in software development and system architecture",
    "Provides detailed technical guidance and code examples"
  ],
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap", 
    "@elizaos/plugin-knowledge",
    ...(process.env.OPENAI_API_KEY ? ["@elizaos/plugin-openai"] : []),
    ...(process.env.DISCORD_API_TOKEN ? ["@elizaos/plugin-discord"] : []),
  ],
  system: "You are a technical assistant specialized in software development.",
  style: {
    all: [
      "Be precise and technical but approachable",
      "Provide code examples when relevant", 
      "Ask clarifying questions for vague requests",
      "Suggest best practices and alternatives"
    ],
    chat: [
      "Keep responses concise in chat",
      "Use technical terminology appropriately"  
    ]
  },
  topics: [
    "software architecture",
    "TypeScript development", 
    "database design",
    "API development"
  ],
  adjectives: [
    "technical",
    "helpful", 
    "precise",
    "knowledgeable"
  ]
};
```

### Template Customization

**Template Types and Usage:**

1. **shouldRespondTemplate** - Controls engagement decisions
```typescript
templates: {
  shouldRespondTemplate: `
<task>Decide if {{agentName}} should respond to technical questions.</task>
{{providers}}
<technical-rules>
- ALWAYS respond to: coding questions, architecture discussions, technical problems
- RESPOND to: general development questions, best practice queries
- IGNORE: off-topic conversations, personal matters
- STOP if: explicitly asked to stop or be quiet
</technical-rules>
<output>
<response>
<reasoning>Technical relevance assessment</reasoning>
<action>RESPOND | IGNORE | STOP</action>
</response>
</output>`
}
```

2. **messageHandlerTemplate** - Shapes response generation
```typescript
messageHandlerTemplate: `
<task>Generate technical response as {{agentName}}.</task>
{{providers}}
Available actions: {{actionNames}}
<technical-personality>
- Use precise technical language
- Provide code examples when appropriate  
- Reference documentation and best practices
- Ask clarifying questions for ambiguous requests
</technical-personality>
<output>
<response>
<thought>Technical analysis of the request</thought>
<actions>REPLY,TECHNICAL_RESEARCH</actions>
<providers>TECHNICAL_DOCS,CODE_EXAMPLES</providers>
<text>Your technical response</text>
</response>
</output>`
```

3. **reflectionTemplate** - Post-interaction learning
```typescript  
reflectionTemplate: `
<task>Analyze technical interactions for learning opportunities.</task>
{{recentMessages}}
<technical-focus>
- Extract technical facts and solutions discussed
- Note programming patterns and architectures mentioned
- Track user expertise levels and learning progress  
- Identify knowledge gaps in technical discussions
</technical-focus>
<output>
{
  "thought": "Technical insight gained from interaction",
  "facts": [{
    "claim": "Technical fact or solution discovered", 
    "type": "technical|solution|pattern|best-practice",
    "technology": "specific technology or framework",
    "complexity": "beginner|intermediate|advanced"
  }],
  "userProfile": {
    "technicalLevel": "beginner|intermediate|advanced|expert",
    "technologies": ["list", "of", "technologies", "user", "knows"],
    "learningAreas": ["areas", "user", "wants", "to", "learn"]
  }
}
</output>`
```

### Multi-Agent Projects

**Project Structure for Multiple Agents:**
```typescript
// Multi-agent project configuration
import { AgentRuntime } from '@elizaos/core';

const agents = [
  {
    character: moderatorCharacter,
    runtime: new AgentRuntime({ 
      databaseAdapter, 
      token, 
      modelProvider, 
      character: moderatorCharacter 
    })
  },
  {
    character: developerCharacter, 
    runtime: new AgentRuntime({
      databaseAdapter,
      token,
      modelProvider, 
      character: developerCharacter
    })
  },
  {
    character: supportCharacter,
    runtime: new AgentRuntime({
      databaseAdapter,
      token, 
      modelProvider,
      character: supportCharacter
    })
  }
];

// Start all agents
for (const agent of agents) {
  await agent.runtime.start();
}
```

---

## Plugin System Architecture

### Complete Plugin Interface

**Full Plugin Interface Specification:**
```typescript
export interface Plugin {
  // Identity
  name: string;                           // Unique plugin identifier
  description: string;                    // Human-readable description
  
  // Core Components  
  actions?: Action[];                     // Tasks agents can perform
  providers?: Provider[];                 // Data sources for context
  evaluators?: Evaluator[];               // Response processors  
  services?: (typeof Service)[];          // Background services
  routes?: Route[];                       // HTTP endpoints
  events?: PluginEvents;                  // Event handlers
  
  // Advanced Features
  models?: {                              // LLM model handlers
    [key: string]: (...args: any[]) => Promise<any>;
  };
  adapter?: IDatabaseAdapter;             // Database integration
  schema?: any;                           // Database schema definitions
  
  // Configuration & Lifecycle
  init?(config: Record<string, string>, runtime: IAgentRuntime): Promise<void>;
  config?: { [key: string]: any };
  
  // Component Type Definitions
  componentTypes?: {
    name: string;
    schema: Record<string, unknown>;
    validator?: (data: any) => boolean;
  }[];
  
  // Dependency Management
  dependencies?: string[];                // Required plugins
  testDependencies?: string[];           // Test-only dependencies
  priority?: number;                     // Loading priority
  
  // Testing
  tests?: TestSuite[];                   // Plugin test suites
}
```

### Plugin Component Types

**1. Actions - Agent Capabilities**

Actions define what agents can do in response to messages:

```typescript
export interface Action {
  name: string;                          // Unique identifier (e.g., 'REPLY', 'SEND_MESSAGE')
  similes?: string[];                    // Alternative names for fuzzy matching
  description: string;                   // What this action accomplishes
  examples?: ActionExample[][];          // Training examples for LLM
  
  // Validation function - determines if action can be executed
  validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean>;
  
  // Handler function - executes the action
  handler(
    runtime: IAgentRuntime,
    message: Memory, 
    state?: State,
    options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<boolean>;
}
```

**Action Implementation Pattern:**
```typescript
export const technicalResearchAction: Action = {
  name: "TECHNICAL_RESEARCH", 
  description: "Research technical topics and provide detailed information",
  similes: ["RESEARCH", "INVESTIGATE", "LOOKUP"],
  
  validate: async (runtime, message, state) => {
    const text = message.content.text?.toLowerCase() || "";
    return text.includes("how") || text.includes("what") || text.includes("explain");
  },
  
  handler: async (runtime, message, state, options, callback) => {
    try {
      // Compose state with knowledge providers
      const researchState = await runtime.composeState(message, [
        'KNOWLEDGE',
        'TECHNICAL_DOCS', 
        'RECENT_MESSAGES'
      ]);
      
      // Generate research response
      const prompt = `Research the technical topic: ${message.content.text}`;
      const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
      
      // Return structured response
      const responseContent = {
        text: response,
        action: "TECHNICAL_RESEARCH",
        source: message.content.source,
        metadata: {
          researchQuery: message.content.text,
          timestamp: new Date().toISOString()
        }
      };
      
      if (callback) {
        await callback(responseContent);
      }
      
      return true;
    } catch (error) {
      runtime.logger.error("Technical research action failed:", error);
      return false;
    }
  },
  
  examples: [[
    { 
      user: "user123", 
      content: { text: "How do I implement dependency injection in TypeScript?" } 
    },
    { 
      user: "assistant", 
      content: { 
        text: "Dependency injection in TypeScript can be implemented using...",
        action: "TECHNICAL_RESEARCH" 
      } 
    }
  ]]
};
```

**2. Providers - Context Data Sources**

Providers supply contextual information during agent decision-making:

```typescript
export interface Provider {
  name: string;                          // Unique identifier
  description?: string;                  // What data this provides  
  dynamic?: boolean;                     // Only runs when explicitly requested
  position?: number;                     // Execution order (lower = earlier)
  private?: boolean;                     // Hidden from provider lists
  
  get(
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State
  ): Promise<ProviderResult>;
}

export interface ProviderResult {
  values?: { [key: string]: any };       // Template variables
  data?: { [key: string]: any };         // Structured data  
  text?: string;                         // Formatted text for prompts
}
```

**Provider Implementation Patterns:**

```typescript
// Static Information Provider
export const technicalStackProvider: Provider = {
  name: 'TECHNICAL_STACK',
  description: 'Current technical stack and capabilities',
  position: 10, // Early in execution order
  
  get: async (runtime, message, state) => {
    const stack = {
      runtime: 'Node.js', 
      framework: 'ElizaOS',
      database: 'PostgreSQL',
      languages: ['TypeScript', 'JavaScript']
    };
    
    return {
      values: { techStack: stack },
      data: { technologies: stack },
      text: `Technical Stack: ${Object.entries(stack).map(([k,v]) => `${k}: ${v}`).join(', ')}`
    };
  }
};

// Dynamic Data Provider  
export const userProjectsProvider: Provider = {
  name: 'USER_PROJECTS',
  description: 'User project information and context',
  dynamic: true, // Only runs when explicitly requested
  
  get: async (runtime, message, state) => {
    try {
      const userId = message.userId || message.entityId;
      const projects = await runtime.databaseAdapter.getProjects(userId);
      
      if (!projects.length) {
        return { values: {}, data: {}, text: '' };
      }
      
      const projectList = projects.map(p => `${p.name}: ${p.description}`).join('\n');
      
      return {
        values: { 
          hasProjects: true,
          projectCount: projects.length 
        },
        data: { projects },
        text: `User Projects:\n${projectList}`
      };
    } catch (error) {
      runtime.logger.error('Failed to fetch user projects:', error);
      return { values: {}, data: {}, text: '' };
    }
  }
};
```

**3. Evaluators - Post-Response Processing** 

Evaluators analyze interactions after responses are generated:

```typescript
export interface Evaluator {
  name: string;                          // Unique identifier
  description: string;                   // What this evaluator does
  similes?: string[];                    // Alternative names
  examples?: EvaluationExample[];        // Usage examples
  alwaysRun?: boolean;                   // Run after every response
  
  validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean>;
  
  handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State, 
    options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void>;
}
```

**Evaluator Implementation:**
```typescript
export const technicalAccuracyEvaluator: Evaluator = {
  name: 'TECHNICAL_ACCURACY',
  description: 'Evaluates technical accuracy and completeness of responses',
  alwaysRun: false, // Only run for technical content
  
  validate: async (runtime, message, state) => {
    const hasCode = message.content.text?.includes('```') || false;
    const hasTechnicalTerms = /\b(function|class|interface|async|await|Promise)\b/.test(
      message.content.text || ''
    );
    return hasCode || hasTechnicalTerms;
  },
  
  handler: async (runtime, message, state, options, callback, responses) => {
    if (!responses || responses.length === 0) return;
    
    const response = responses[0];
    const responseText = response.content.text || '';
    
    // Analyze technical accuracy
    const hasCodeExamples = responseText.includes('```');
    const explainsConcepts = responseText.length > 200;
    const providesContext = responseText.includes('because') || responseText.includes('since');
    
    // Store evaluation results
    await runtime.createMemory({
      id: generateId(),
      entityId: message.entityId,
      roomId: message.roomId,
      content: {
        text: `Technical response evaluation: ${hasCodeExamples ? 'includes code' : 'no code'}, ${explainsConcepts ? 'detailed' : 'brief'}, ${providesContext ? 'contextual' : 'direct'}`,
        type: 'technical_evaluation',
        data: {
          hasCodeExamples,
          explainsConcepts, 
          providesContext,
          responseLength: responseText.length,
          evaluator: 'TECHNICAL_ACCURACY'
        }
      }
    }, 'evaluations');
  }
};
```

**4. Services - Background Processes**

Services handle long-running background tasks and integrations:

```typescript
export abstract class Service {
  protected runtime!: IAgentRuntime;
  static serviceType: string;
  abstract capabilityDescription: string;
  config?: Record<string, any>;
  
  constructor(runtime?: IAgentRuntime) {
    if (runtime) {
      this.runtime = runtime;
    }
  }
  
  abstract stop(): Promise<void>;
  static async start(runtime: IAgentRuntime): Promise<Service>;
}
```

**Service Implementation Pattern:**
```typescript
export class TechnicalDocumentationService extends Service {
  static serviceType = 'technical-docs';
  capabilityDescription = 'Maintains and searches technical documentation';
  
  private documentIndex: Map<string, any> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new TechnicalDocumentationService(runtime);
    await service.initialize();
    return service;
  }
  
  async stop(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.runtime.logger.info('Technical documentation service stopped');
  }
  
  private async initialize(): Promise<void> {
    // Load initial documentation
    await this.loadDocumentation();
    
    // Set up periodic refresh
    this.refreshInterval = setInterval(async () => {
      await this.refreshDocumentation();
    }, 60 * 60 * 1000); // 1 hour
    
    this.runtime.logger.info('Technical documentation service initialized');
  }
  
  private async loadDocumentation(): Promise<void> {
    // Load technical documentation from various sources
    const docs = await this.fetchDocumentation();
    for (const doc of docs) {
      this.documentIndex.set(doc.id, doc);
    }
  }
  
  async searchDocumentation(query: string): Promise<any[]> {
    // Implement documentation search logic
    const results: any[] = [];
    for (const [id, doc] of this.documentIndex) {
      if (doc.content.toLowerCase().includes(query.toLowerCase())) {
        results.push(doc);
      }
    }
    return results.slice(0, 5); // Return top 5 results
  }
}
```

---

## Bootstrap Plugin System

The Bootstrap plugin is the essential core message handler that must be included in every ElizaOS agent. It provides the fundamental message processing, action coordination, and response generation capabilities.

### Message Processing Flow

**Complete Message Processing Pipeline:**

1. **Message Reception** - `MESSAGE_RECEIVED` event triggered
2. **Self-Check** - Skip messages from agent itself  
3. **Response ID Generation** - Prevent duplicate processing
4. **Run Tracking** - Lifecycle management with `RUN_STARTED`/`RUN_ENDED` events
5. **Memory Storage** - Store message and generate embeddings in parallel
6. **Attachment Processing** - Handle images, documents, media
7. **Agent State Check** - Verify mute status and mention detection
8. **Should Respond Evaluation** - Bypass conditions or LLM evaluation  
9. **Response Generation** - State composition and LLM processing
10. **Action Processing** - Execute selected actions with callbacks
11. **Evaluator Execution** - Post-response analysis and learning

**Critical Message Processing Code Pattern:**
```typescript
const messageReceivedHandler = async ({
  runtime,
  message, 
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  // 1. Skip self messages
  if (message.entityId === runtime.agentId) {
    return;
  }
  
  // 2. Generate response ID to prevent duplicates
  const responseId = v4();
  latestResponseIds.get(runtime.agentId).set(message.roomId, responseId);
  
  // 3. Start run tracking
  const runId = runtime.startRun();
  
  try {
    // 4. Store message and embeddings in parallel
    await Promise.all([
      runtime.addEmbeddingToMemory(message),
      runtime.createMemory(message, 'messages'),
    ]);
    
    // 5. Process attachments if present
    if (message.content.attachments?.length > 0) {
      message.content.attachments = await processAttachments(
        message.content.attachments, 
        runtime
      );
    }
    
    // 6. Check agent state (muted/mentioned)
    const agentUserState = await runtime.getParticipantUserState(
      message.roomId, 
      runtime.agentId
    );
    
    if (agentUserState === 'MUTED' && 
        !message.content.text?.toLowerCase().includes(
          runtime.character.name.toLowerCase()
        )) {
      return; // Ignore if muted and not mentioned
    }
    
    // 7. Evaluate if should respond
    let shouldRespond = true;
    if (!shouldBypassShouldRespond(runtime, room, source)) {
      shouldRespond = await evaluateShouldRespond(runtime, message);
    }
    
    if (shouldRespond) {
      // 8. Generate and process response
      await generateAndProcessResponse(runtime, message, callback);
    }
    
    // 9. Run evaluators
    await runtime.evaluate(message, state, shouldRespond, callback, responseMessages);
    
    await runtime.emitEvent(EventType.RUN_ENDED, { runId, status: 'completed' });
  } catch (error) {
    runtime.logger.error('Message processing failed:', error);
    await runtime.emitEvent(EventType.RUN_ENDED, { runId, status: 'error', error });
  }
};
```

### Core Bootstrap Actions

**Essential Actions Provided by Bootstrap:**

1. **REPLY** - Primary response action for conversations
2. **IGNORE** - Explicitly ignore messages  
3. **NONE** - No-op placeholder action
4. **FOLLOW_ROOM** - Subscribe to room updates
5. **UNFOLLOW_ROOM** - Unsubscribe from room
6. **MUTE_ROOM** - Disable responses in room 
7. **UNMUTE_ROOM** - Re-enable responses
8. **SEND_MESSAGE** - Send messages to specific rooms
9. **UPDATE_ENTITY** - Modify entity information
10. **GENERATE_IMAGE** - Create AI-generated images

**REPLY Action Implementation Pattern:**
```typescript
export const replyAction: Action = {
  name: 'REPLY',
  similes: ['GREET', 'REPLY_TO_MESSAGE', 'SEND_REPLY', 'RESPOND'], 
  description: 'Replies to the current conversation',
  
  validate: async (runtime) => true, // Always available
  
  handler: async (runtime, message, state, options, callback, responses) => {
    // Compose state with necessary providers
    const composedState = await runtime.composeState(message, [
      'RECENT_MESSAGES',
      'CHARACTER', 
      'ENTITIES',
      'RELATIONSHIPS'
    ]);
    
    // Generate response using message handler template
    const prompt = composePromptFromState({
      state: composedState,
      template: runtime.character.templates?.messageHandlerTemplate || defaultMessageHandlerTemplate
    });
    
    const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
    
    const responseContent = {
      thought: response.thought,
      text: response.message || response.text || '',
      actions: ['REPLY'],
      source: message.content.source
    };
    
    await callback(responseContent);
    return true;
  }
};
```

### Core Bootstrap Providers

**Essential Providers for Context:**

1. **RECENT_MESSAGES** (position: 100) - Conversation history
2. **CHARACTER** (position: 0) - Agent personality and traits  
3. **ENTITIES** (position: 50) - Information about users/participants
4. **RELATIONSHIPS** (position: 75) - Social connections and interactions
5. **TIME** (position: 25) - Current date and time context
6. **WORLD** (position: 60) - Environment and server information
7. **ACTIONS** (position: -1) - Available actions for current context
8. **ANXIETY** (position: 90) - Agent emotional state
9. **CAPABILITIES** (position: 80) - Available services and features
10. **FACTS** (position: 70) - Stored knowledge and learned information

**Provider Position Strategy:**
- Negative positions (-1, -50): Run early to inform other providers
- Low positions (0-25): Core identity and temporal context
- Medium positions (50-75): Social and relational context  
- High positions (80-100): Dynamic state and recent activity

### Bootstrap Evaluators

**REFLECTION Evaluator - Core Learning System:**
```typescript
export const reflectionEvaluator: Evaluator = {
  name: 'REFLECTION',
  description: 'Analyzes conversations and extracts facts and relationships',
  alwaysRun: true, // Critical for learning
  
  validate: async () => true,
  
  handler: async (runtime, message, state, options, callback, responses) => {
    const prompt = composePromptFromState({
      state,
      template: runtime.character.templates?.reflectionTemplate || defaultReflectionTemplate
    });
    
    const reflection = await runtime.useModel(ModelType.OBJECT_SMALL, { prompt });
    
    // Store extracted facts
    if (reflection.facts) {
      for (const fact of reflection.facts) {
        if (!fact.already_known) {
          await runtime.createMemory({
            id: generateId(),
            entityId: message.entityId,
            roomId: message.roomId, 
            content: {
              text: fact.claim,
              type: fact.type,
              confidence: fact.confidence || 0.8
            }
          }, 'facts', true);
        }
      }
    }
    
    // Update relationships
    if (reflection.relationships) {
      for (const rel of reflection.relationships) {
        await runtime.createRelationship({
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          tags: rel.tags
        });
      }
    }
  }
};
```

---

## Database & Schema Management

### SQL Plugin Architecture

The SQL plugin provides sophisticated database management with automatic migrations, multi-database support, and plugin integration.

**Key Features:**
- **Dual Database Support**: PGLite (development) and PostgreSQL (production)
- **Dynamic Migration System**: Automatic schema discovery and updates
- **Plugin Schema Integration**: Plugins can define their own database schemas
- **Schema Introspection**: Analyzes and updates existing database structures
- **Connection Management**: Singleton patterns and connection pooling

### Core Database Schema

**Essential Tables (Always Created):**
```sql
-- Agent identities and configurations
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memory storage for conversations and knowledge
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  agent_id UUID REFERENCES agents(id),
  entity_id UUID NOT NULL,
  room_id UUID NOT NULL,
  content JSONB NOT NULL,
  type TEXT NOT NULL DEFAULT 'message',
  unique_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entity management (users, bots, objects)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'user',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relationship tracking between entities
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID REFERENCES entities(id),
  target_entity_id UUID REFERENCES entities(id), 
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message history and communication records
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  entity_id UUID REFERENCES entities(id),
  room_id UUID NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector embeddings for semantic search
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id),
  vector VECTOR(1536), -- Adjust dimensions based on model
  model TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Custom Schema Development

**Adding Plugin-Specific Schema:**

1. **Define Schema with Drizzle ORM:**
```typescript
// In your plugin's schema.ts
import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const userPreferencesTable = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // No agentId = shared across agents
  preferences: jsonb('preferences').default({}).notNull(),
  category: varchar('category', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_user_preferences_user_id').on(table.userId),
  index('idx_user_preferences_category').on(table.category),
]);

// Export schema for plugin registration
export const customSchema = {
  userPreferencesTable,
};
```

2. **Create Repository Pattern:**
```typescript
// Repository for database operations
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { UUID } from '@elizaos/core';
import { userPreferencesTable } from './schema';

export interface UserPreferences {
  id: UUID;
  userId: UUID; 
  preferences: Record<string, any>;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserPreferencesRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}
  
  async create(userId: UUID, preferences: Record<string, any>, category?: string): Promise<UserPreferences> {
    const [created] = await this.db
      .insert(userPreferencesTable)
      .values({
        userId,
        preferences,
        category,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
      
    return this.mapToUserPreferences(created);
  }
  
  async findByUserId(userId: UUID, category?: string): Promise<UserPreferences[]> {
    const query = this.db.select().from(userPreferencesTable);
    
    if (category) {
      query.where(and(
        eq(userPreferencesTable.userId, userId),
        eq(userPreferencesTable.category, category)
      ));
    } else {
      query.where(eq(userPreferencesTable.userId, userId));
    }
    
    const results = await query;
    return results.map(this.mapToUserPreferences);
  }
  
  async update(id: UUID, preferences: Record<string, any>): Promise<UserPreferences> {
    const [updated] = await this.db
      .update(userPreferencesTable)
      .set({
        preferences,
        updatedAt: new Date(),
      })
      .where(eq(userPreferencesTable.id, id))
      .returning();
      
    return this.mapToUserPreferences(updated);
  }
  
  private mapToUserPreferences(row: any): UserPreferences {
    return {
      id: row.id,
      userId: row.userId || row.user_id,
      preferences: row.preferences || {},
      category: row.category,
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
    };
  }
}
```

3. **Database Access in Actions:**
```typescript
export const storePreferencesAction: Action = {
  name: 'STORE_PREFERENCES',
  description: 'Store user preferences in the database',
  
  validate: async (runtime, message) => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('prefer') || text.includes('setting');
  },
  
  handler: async (runtime, message, state, options, callback) => {
    try {
      // Get database access through runtime
      const db = runtime.databaseAdapter.db;
      const repository = new UserPreferencesRepository(db);
      
      // Extract preferences using LLM
      const extractionPrompt = `Extract user preferences from: "${message.content.text}"
Return JSON format: {"theme": "dark|light", "notifications": true|false, "language": "en|es|fr"}`;
      
      const llmResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: extractionPrompt
      });
      
      const userId = message.userId || message.entityId;
      const preferences = await repository.create(userId, llmResponse, 'general');
      
      await callback({
        text: `Your preferences have been saved: ${JSON.stringify(llmResponse)}`,
        action: 'STORE_PREFERENCES',
        data: { preferences }
      });
      
      return true;
    } catch (error) {
      runtime.logger.error('Failed to store preferences:', error);
      return false;
    }
  }
};
```

4. **Database Provider for Context:**
```typescript
export const userPreferencesProvider: Provider = {
  name: 'USER_PREFERENCES',
  description: 'User preferences and settings',
  dynamic: true, // Only load when explicitly requested
  
  get: async (runtime, message) => {
    try {
      const db = runtime.databaseAdapter.db;
      const repository = new UserPreferencesRepository(db);
      
      const userId = message.userId || message.entityId;
      const preferences = await repository.findByUserId(userId);
      
      if (!preferences.length) {
        return { values: {}, data: {}, text: '' };
      }
      
      const prefsText = preferences.map(p => 
        `${p.category || 'General'}: ${JSON.stringify(p.preferences)}`
      ).join('\n');
      
      return {
        values: { 
          hasPreferences: true,
          preferenceCount: preferences.length 
        },
        data: { userPreferences: preferences },
        text: `User Preferences:\n${prefsText}`
      };
    } catch (error) {
      runtime.logger.error('Failed to load user preferences:', error);
      return { values: {}, data: {}, text: '' };
    }
  }
};
```

### Database Migration Patterns

**Automatic Migration System:**
The SQL plugin automatically handles migrations when plugins are loaded:

1. **Schema Discovery**: Analyzes plugin schema definitions
2. **Dependency Resolution**: Orders tables by foreign key relationships  
3. **Incremental Updates**: Adds missing columns and indexes
4. **Data Preservation**: Never drops existing data during migrations

**Migration Best Practices:**
- Always use UUID primary keys for consistency
- Include created_at/updated_at timestamps
- Add appropriate indexes for query performance
- Use JSONB for flexible metadata storage
- Design schemas to be shared across agents (no agentId unless needed)

---

## Platform Integrations

### Discord Integration

**Complete Discord Plugin Configuration:**

**Required Environment Variables:**
```bash
DISCORD_APPLICATION_ID=your_discord_app_id
DISCORD_API_TOKEN=your_bot_token
```

**Optional Configuration:**
```bash
CHANNEL_IDS=channel1,channel2,channel3  # Restrict to specific channels
DISCORD_VOICE_CHANNEL_ID=voice_channel_id  # Default voice channel
```

**Character Configuration:**
```typescript
export const discordCharacter: Character = {
  name: "DiscordBot",
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap", 
    "@elizaos/plugin-discord",   // Must come after bootstrap
    "@elizaos/plugin-openai",    // LLM provider
  ],
  clients: ['discord'], // Enable Discord client
  
  // Discord-specific settings
  settings: {
    discord: {
      // Additional Discord configuration
      enableVoice: process.env.DISCORD_VOICE_CHANNEL_ID ? true : false,
      autoJoinVoice: true,
      moderationLevel: 'medium'
    }
  }
};
```

**Discord Service Architecture:**
```typescript
export class DiscordService extends Service {
  static serviceType = 'discord';
  capabilityDescription = 'Discord bot integration with voice, commands, and rich interactions';
  
  private client: Discord.Client;
  private voiceConnections = new Map();
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new DiscordService(runtime);
    await service.initialize();
    return service;
  }
  
  private async initialize(): Promise<void> {
    this.client = new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.DirectMessages,
      ],
    });
    
    // Set up event handlers
    this.client.on('messageCreate', this.handleMessage.bind(this));
    this.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
    this.client.on('ready', this.handleReady.bind(this));
    
    await this.client.login(process.env.DISCORD_API_TOKEN);
  }
  
  private async handleMessage(discordMessage: Discord.Message): Promise<void> {
    if (discordMessage.author.bot) return;
    
    // Convert Discord message to ElizaOS message format
    const elizaMessage: Memory = {
      id: generateId(),
      entityId: discordMessage.author.id as UUID,
      roomId: discordMessage.channel.id as UUID,
      content: {
        text: discordMessage.content,
        source: 'discord',
        attachments: discordMessage.attachments.map(att => ({
          url: att.url,
          type: att.contentType || 'unknown',
          name: att.name,
          size: att.size
        }))
      },
      createdAt: discordMessage.createdAt
    };
    
    // Process through ElizaOS runtime
    await this.runtime.messageManager.handleMessage(
      elizaMessage,
      async (response) => {
        await discordMessage.reply({
          content: response.text,
          files: response.attachments?.map(att => ({
            attachment: att.url,
            name: att.name
          }))
        });
      }
    );
  }
}
```

**Discord-Specific Actions:**
```typescript
export const joinVoiceAction: Action = {
  name: 'JOIN_VOICE',
  description: 'Join a Discord voice channel',
  
  validate: async (runtime, message) => {
    return message.content.source === 'discord' && 
           message.content.text?.toLowerCase().includes('join voice');
  },
  
  handler: async (runtime, message, state, options, callback) => {
    const discordService = runtime.getService('discord') as DiscordService;
    const channelId = process.env.DISCORD_VOICE_CHANNEL_ID;
    
    if (!channelId) {
      await callback({
        text: "No voice channel configured. Please set DISCORD_VOICE_CHANNEL_ID.",
        action: 'JOIN_VOICE'
      });
      return false;
    }
    
    try {
      await discordService.joinVoiceChannel(channelId);
      await callback({
        text: "Joined the voice channel! 🎤",
        action: 'JOIN_VOICE'
      });
      return true;
    } catch (error) {
      await callback({
        text: "Failed to join voice channel. Check permissions and configuration.",
        action: 'JOIN_VOICE'
      });
      return false;
    }
  }
};
```

### Telegram Integration

**Complete Telegram Plugin Configuration:**

**Required Environment Variables:**
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
```

**Optional Configuration:**
```bash
TELEGRAM_API_ROOT=https://api.telegram.org  # Custom API endpoint if needed
TELEGRAM_ALLOWED_CHATS=chat1,chat2,chat3   # Restrict to specific chats
```

**Character Configuration:**
```typescript
export const telegramCharacter: Character = {
  name: "TelegramBot",
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap",
    "@elizaos/plugin-telegram",  // Telegram integration
    "@elizaos/plugin-openai",
  ],
  clients: ['telegram'],
  
  settings: {
    telegram: {
      // Telegram-specific settings
      enableInlineKeyboards: true,
      allowGroups: true,
      moderationLevel: 'strict'
    }
  }
};
```

**Telegram Service Implementation:**
```typescript
export class TelegramService extends Service {
  static serviceType = TELEGRAM_SERVICE_NAME;
  capabilityDescription = 'Telegram bot with messages, media, buttons, and group management';
  
  private bot: TelegramBot;
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new TelegramService(runtime);
    await service.initialize();
    return service;
  }
  
  private async initialize(): Promise<void> {
    const token = this.runtime.getSetting('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    
    this.bot = new TelegramBot(token, { 
      polling: true,
      request: {
        agentOptions: {
          keepAlive: true,
          family: 4
        }
      }
    });
    
    this.bot.on('message', this.handleMessage.bind(this));
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    
    this.runtime.logger.info('Telegram bot initialized');
  }
  
  private async handleMessage(telegramMessage: any): Promise<void> {
    // Filter allowed chats if configured
    const allowedChats = this.runtime.getSetting('TELEGRAM_ALLOWED_CHATS');
    if (allowedChats) {
      const allowed = allowedChats.split(',');
      if (!allowed.includes(telegramMessage.chat.id.toString())) {
        return;
      }
    }
    
    const elizaMessage: Memory = {
      id: generateId(),
      entityId: telegramMessage.from.id.toString() as UUID,
      roomId: telegramMessage.chat.id.toString() as UUID,
      content: {
        text: telegramMessage.text,
        source: 'telegram',
        metadata: {
          chatType: telegramMessage.chat.type,
          messageId: telegramMessage.message_id,
          from: telegramMessage.from
        }
      },
      createdAt: new Date(telegramMessage.date * 1000)
    };
    
    await this.runtime.messageManager.handleMessage(
      elizaMessage,
      async (response) => {
        const options: any = {};
        
        // Add inline keyboard if specified
        if (response.keyboard) {
          options.reply_markup = {
            inline_keyboard: response.keyboard
          };
        }
        
        await this.bot.sendMessage(
          telegramMessage.chat.id,
          response.text,
          options
        );
      }
    );
  }
}
```

---

## LLM Provider Integration

### Multi-Provider Architecture

ElizaOS supports multiple LLM providers with automatic fallback and model type specialization:

**Model Types:**
- `TEXT_GENERATION` (`TEXT_SMALL`, `TEXT_LARGE`) - Conversations and response generation
- `TEXT_EMBEDDING` - Vector embeddings for memory and search  
- `OBJECT_GENERATION` (`OBJECT_SMALL`, `OBJECT_LARGE`) - Structured JSON output

**Provider Capabilities Matrix:**
| Provider | Text Chat | Embeddings | Structured Output | Offline |
|----------|-----------|------------|-------------------|---------|
| OpenAI | ✅ | ✅ | ✅ | ❌ |
| Anthropic | ✅ | ❌ | ✅ | ❌ |
| Google GenAI | ✅ | ✅ | ✅ | ❌ |
| Ollama | ✅ | ✅ | ✅ | ✅ |
| OpenRouter | ✅ | ❌ | ✅ | ❌ |

### OpenAI Provider Configuration

**Environment Variables:**
```bash
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional Model Configuration
OPENAI_SMALL_MODEL=gpt-4o-mini        # Default: gpt-4o-mini
OPENAI_LARGE_MODEL=gpt-4o             # Default: gpt-4o  
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Default: text-embedding-3-small

# Alternative Model Examples
# OPENAI_SMALL_MODEL=gpt-3.5-turbo
# OPENAI_LARGE_MODEL=gpt-4-turbo  
# OPENAI_LARGE_MODEL=gpt-4o-2024-11-20
# OPENAI_EMBEDDING_MODEL=text-embedding-3-large
# OPENAI_EMBEDDING_MODEL=text-embedding-ada-002
```

**Character Configuration:**
```typescript
export const openAICharacter: Character = {
  name: "OpenAI-Powered Agent",
  plugins: [
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap",
    "@elizaos/plugin-openai",  // OpenAI provider
  ],
  settings: {
    secrets: {
      OPENAI_API_KEY: "sk-your-key-here" // Can also be set via character settings
    },
    model: {
      provider: "openai",
      small: "gpt-4o-mini",
      large: "gpt-4o",
      embedding: "text-embedding-3-small"
    }
  }
};
```

**OpenAI Model Handler Implementation:**
```typescript
export const openAIModels = {
  [ModelType.TEXT_SMALL]: async (
    runtime: IAgentRuntime,
    params: GenerateTextParams
  ): Promise<string> => {
    const client = new OpenAI({
      apiKey: runtime.getSetting("OPENAI_API_KEY"),
    });
    
    const model = runtime.getSetting("OPENAI_SMALL_MODEL") || "gpt-4o-mini";
    
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: params.prompt }],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      stream: false,
    });
    
    // Emit usage tracking
    runtime.emitEvent(EventType.MODEL_USED, {
      provider: "openai",
      type: ModelType.TEXT_SMALL,
      model,
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    });
    
    return response.choices[0]?.message?.content || "";
  },
  
  [ModelType.TEXT_EMBEDDING]: async (
    runtime: IAgentRuntime,
    params: TextEmbeddingParams | string | null
  ): Promise<number[]> => {
    if (params === null) {
      // Return test embedding for null input
      return Array(1536).fill(0);
    }
    
    const client = new OpenAI({
      apiKey: runtime.getSetting("OPENAI_API_KEY"),
    });
    
    const text = typeof params === 'string' ? params : params.text;
    const model = runtime.getSetting("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small";
    
    const response = await client.embeddings.create({
      model,
      input: text,
    });
    
    return response.data[0].embedding;
  },
  
  [ModelType.OBJECT_GENERATION]: async (
    runtime: IAgentRuntime,
    params: ObjectGenerationParams
  ): Promise<any> => {
    const client = new OpenAI({
      apiKey: runtime.getSetting("OPENAI_API_KEY"),
    });
    
    const model = runtime.getSetting("OPENAI_LARGE_MODEL") || "gpt-4o";
    
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: params.prompt }],
      temperature: 0.1, // Lower temperature for structured output
      max_tokens: params.maxTokens ?? 2048,
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0]?.message?.content;
    return content ? JSON.parse(content) : {};
  }
};
```

### Anthropic Provider Integration

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Default model
```

**Model Handler Pattern:**
```typescript
export const anthropicModels = {
  [ModelType.TEXT_GENERATION]: async (
    runtime: IAgentRuntime,
    params: GenerateTextParams
  ): Promise<string> => {
    const client = new Anthropic({
      apiKey: runtime.getSetting("ANTHROPIC_API_KEY"),
    });
    
    const model = runtime.getSetting("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20241022";
    
    const response = await client.messages.create({
      model,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
      messages: [{ role: "user", content: params.prompt }],
    });
    
    runtime.emitEvent(EventType.MODEL_USED, {
      provider: "anthropic",
      type: ModelType.TEXT_GENERATION,
      model,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
    
    return response.content[0].text;
  }
};
```

### Multi-Provider Fallback Strategy

**Implementing Provider Fallback:**
```typescript
export class MultiProviderModelService {
  private providers = new Map<string, any>();
  private fallbackOrder = ['openai', 'anthropic', 'openrouter', 'ollama'];
  
  constructor(private runtime: IAgentRuntime) {
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Register available providers based on API keys
    if (this.runtime.getSetting('OPENAI_API_KEY')) {
      this.providers.set('openai', openAIModels);
    }
    if (this.runtime.getSetting('ANTHROPIC_API_KEY')) {
      this.providers.set('anthropic', anthropicModels);
    }
    // ... register other providers
  }
  
  async generateText(params: GenerateTextParams): Promise<string> {
    const modelType = params.size === 'small' ? ModelType.TEXT_SMALL : ModelType.TEXT_LARGE;
    
    for (const providerName of this.fallbackOrder) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider[modelType]) continue;
      
      try {
        const result = await provider[modelType](this.runtime, params);
        this.runtime.logger.info(`Generated text using ${providerName}`);
        return result;
      } catch (error) {
        this.runtime.logger.warn(`Provider ${providerName} failed:`, error);
        continue; // Try next provider
      }
    }
    
    throw new Error('All LLM providers failed');
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Only certain providers support embeddings
    const embeddingProviders = ['openai', 'google', 'ollama'];
    
    for (const providerName of embeddingProviders) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider[ModelType.TEXT_EMBEDDING]) continue;
      
      try {
        return await provider[ModelType.TEXT_EMBEDDING](this.runtime, text);
      } catch (error) {
        this.runtime.logger.warn(`Embedding provider ${providerName} failed:`, error);
      }
    }
    
    throw new Error('All embedding providers failed');
  }
}
```

---

## API & Messaging System

### Core API Endpoints

**Agent Management APIs:**
- `POST /agents` - Create a new agent
- `GET /agents/:id` - Get agent details  
- `GET /agents` - List all agents
- `PATCH /agents/:id` - Update agent configuration
- `DELETE /agents/:id` - Delete an agent
- `POST /agents/:id/start` - Start an agent
- `POST /agents/:id/stop` - Stop an agent

**Messaging APIs:**
- `POST /messages` - Send message to agent
- `GET /messages` - Retrieve message history with pagination
- `WebSocket /ws` - Real-time messaging interface

**Memory Management APIs:**
- `POST /memory` - Store memory/knowledge
- `GET /memory` - Retrieve memories with filters
- `POST /memory/search` - Semantic search through memories

**Media APIs:**
- `POST /audio/generate` - Generate speech from text
- `POST /audio/transcribe` - Transcribe audio to text
- `POST /media/upload` - Upload media files

### Message Processing API

**Send Message Request:**
```typescript
interface SendMessageRequest {
  text: string;                    // Message content
  userId: UUID;                    // User sending message
  roomId?: UUID;                   // Optional room context
  attachments?: MediaFile[];       // Optional file attachments
  metadata?: Record<string, any>;  // Additional context
}

interface SendMessageResponse {
  id: UUID;                       // Message ID
  response?: string;              // Agent response
  actions?: string[];             // Actions taken
  metadata?: Record<string, any>; // Response metadata
  timestamp: string;              // ISO timestamp
}
```

**Message History API:**
```typescript
interface MessageHistoryRequest {
  roomId?: UUID;                  // Filter by room
  userId?: UUID;                  // Filter by user
  limit?: number;                 // Default: 50, Max: 100
  cursor?: string;                // Pagination cursor
  startDate?: string;             // ISO date filter
  endDate?: string;               // ISO date filter
}

interface MessageHistoryResponse {
  messages: Message[];            // Message array
  nextCursor?: string;            // Next page cursor
  hasMore: boolean;              // More results available
  total?: number;                // Total count (if available)
}
```

### WebSocket Integration

**Socket.IO Event Types:**
```typescript
enum MessageType {
  MESSAGE = 'message',
  RESPONSE = 'response', 
  ACTION = 'action',
  ERROR = 'error',
  STATUS = 'status',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room'
}

// Client -> Server Events
interface ClientEvents {
  'send_message': (data: {
    text: string;
    roomId: string;
    userId: string;
    metadata?: any;
  }) => void;
  
  'join_room': (data: {
    roomId: string;
    userId: string;
  }) => void;
  
  'leave_room': (data: {
    roomId: string; 
    userId: string;
  }) => void;
}

// Server -> Client Events  
interface ServerEvents {
  'message_received': (data: {
    id: string;
    text: string;
    userId: string;
    roomId: string;
    timestamp: string;
    metadata?: any;
  }) => void;
  
  'agent_response': (data: {
    messageId: string;
    response: string;
    actions: string[];
    roomId: string;
    timestamp: string;
  }) => void;
  
  'error': (data: {
    message: string;
    code?: string;
    details?: any;
  }) => void;
}
```

**WebSocket Client Implementation:**
```typescript
import { io, Socket } from 'socket.io-client';

export class ElizaSocketClient {
  private socket: Socket;
  private currentRoomId?: string;
  
  constructor(private serverUrl: string = 'http://localhost:3000') {
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('Connected to Eliza server');
    });
    
    this.socket.on('agent_response', (data) => {
      console.log('Agent response:', data.response);
      this.onAgentResponse?.(data);
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.onError?.(error);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.onDisconnect?.(reason);
    });
  }
  
  async sendMessage(text: string, userId: string, roomId?: string): Promise<void> {
    const messageData = {
      text,
      userId,
      roomId: roomId || this.currentRoomId || 'default',
      timestamp: new Date().toISOString(),
    };
    
    this.socket.emit('send_message', messageData);
  }
  
  async joinRoom(roomId: string, userId: string): Promise<void> {
    this.currentRoomId = roomId;
    this.socket.emit('join_room', { roomId, userId });
  }
  
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    this.socket.emit('leave_room', { roomId, userId });
    if (this.currentRoomId === roomId) {
      this.currentRoomId = undefined;
    }
  }
  
  // Event handler callbacks
  onAgentResponse?: (data: any) => void;
  onError?: (error: any) => void; 
  onDisconnect?: (reason: string) => void;
}
```

### REST API Integration

**Complete API Client:**
```typescript
export class ElizaAPIClient {
  constructor(
    private baseUrl: string = 'http://localhost:3000',
    private apiKey?: string
  ) {}
  
  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }
  
  // Agent Management
  async createAgent(agentData: {
    name: string;
    character: Character;
    plugins: string[];
  }): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(agentData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getAgent(agentId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async listAgents(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Messaging
  async sendMessage(data: {
    text: string;
    userId: string;
    roomId?: string;
    agentId?: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getMessageHistory(params: {
    roomId?: string;
    userId?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<any> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, value.toString());
      }
    });
    
    const response = await fetch(`${this.baseUrl}/messages?${query}`, {
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get message history: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Memory Management
  async storeMemory(data: {
    content: any;
    type: string;
    roomId: string;
    userId: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/memory`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to store memory: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async searchMemory(query: string, options: {
    roomId?: string;
    type?: string;
    limit?: number;
  } = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}/memory/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, ...options }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search memory: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

---

## Sessions Architecture

The Sessions API provides a simplified, stateful conversation management system that automatically handles infrastructure complexity while providing advanced features like session renewal, expiration management, and persistent state.

### Session Lifecycle Management

**Core Design Principles:**

1. **Abstraction Over Complexity** - No channel management required
2. **Persistent State** - Maintains conversation context across interactions
3. **Automatic Timeout** - Configurable session expiration with warnings
4. **Renewal Mechanism** - Both automatic and manual session extension

### Session Configuration

**Timeout Configuration Hierarchy (Priority Order):**
1. Session-specific config (highest priority)
2. Agent-specific config  
3. Global defaults (lowest priority)

**Environment Variables:**
```bash
# Session timeout settings
SESSION_TIMEOUT_MINUTES=30                    # Default: 30 minutes
SESSION_AUTO_RENEW=true                       # Default: true
SESSION_MAX_DURATION_MINUTES=120              # Default: 120 minutes  
SESSION_WARNING_THRESHOLD_MINUTES=5           # Default: 5 minutes

# Cleanup settings
SESSION_CLEANUP_INTERVAL_MINUTES=5            # Default: 5 minutes
SESSION_MAX_CONCURRENT=1000                   # Default: 1000 sessions
```

**Session Interface:**
```typescript
interface Session {
  // Identity
  id: string;
  agentId: UUID;
  userId: UUID; 
  channelId: UUID;
  
  // Temporal State
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  
  // Configuration
  timeoutConfig: SessionTimeoutConfig;
  
  // Lifecycle State
  renewalCount: number;
  warningState?: {
    sent: boolean;
    sentAt: Date;
  };
  
  // Application State
  metadata: Record<string, any>;
}

interface SessionTimeoutConfig {
  timeoutMinutes: number;        // Session timeout duration
  autoRenew: boolean;           // Enable automatic renewal
  maxDurationMinutes: number;   // Maximum total session duration
  warningThresholdMinutes: number; // Warning threshold before expiration
}
```

### Session API Implementation

**1. Create Session:**
```typescript
// POST /api/sessions
const createSession = async (request: CreateSessionRequest) => {
  // Phase 1: Validation
  validateUUIDs(request.agentId, request.userId);
  validateMetadata(request.metadata);
  
  // Phase 2: Agent verification
  const agent = agents.get(request.agentId);
  if (!agent) throw new AgentNotFoundError();
  
  // Phase 3: Configuration resolution
  const agentConfig = getAgentTimeoutConfig(agent);
  const finalConfig = mergeTimeoutConfigs(
    request.timeoutConfig, 
    agentConfig
  );
  
  // Phase 4: Infrastructure setup (atomic)
  const sessionId = uuidv4();
  const channelId = uuidv4();
  
  await serverInstance.createChannel({
    id: channelId,
    name: `session-${sessionId}`,
    type: ChannelType.DM,
    messageServerId: DEFAULT_SERVER_ID,
    metadata: {
      sessionId,
      agentId: request.agentId,
      userId: request.userId,
      timeoutConfig: finalConfig,
      ...request.metadata
    }
  });
  
  // Phase 5: Session registration
  const session = new Session(sessionId, channelId, finalConfig);
  sessions.set(sessionId, session);
  
  return {
    sessionId,
    channelId,
    config: finalConfig,
    expiresAt: session.expiresAt,
    status: 'active'
  };
};
```

**2. Send Session Message:**
```typescript
// POST /api/sessions/{sessionId}/messages
const sendSessionMessage = async (sessionId: string, request: SendMessageRequest) => {
  const session = sessions.get(sessionId);
  
  // Expiration check
  if (session.isExpired()) {
    sessions.delete(sessionId);
    throw new SessionExpiredError();
  }
  
  // Activity tracking and renewal
  session.updateLastActivity();
  
  if (session.timeoutConfig.autoRenew) {
    const renewed = session.attemptRenewal();
    if (renewed) {
      logger.info(`Session ${sessionId} auto-renewed`);
    }
  }
  
  // Warning detection
  if (session.isNearExpiration()) {
    session.markWarningState();
    // Emit warning event for client notification
    await emitSessionWarning(sessionId, session);
  }
  
  // Message creation
  const dbMessage = await serverInstance.createMessage({
    channelId: session.channelId,
    authorId: session.userId,
    content: request.content,
    metadata: {
      sessionId,
      ...request.metadata
    }
  });
  
  return {
    ...dbMessage,
    sessionStatus: session.getStatus(),
    expiresAt: session.expiresAt,
    warningState: session.warningState
  };
};
```

**3. Session Renewal Logic:**
```typescript
class SessionRenewalEngine {
  attemptRenewal(session: Session): boolean {
    // Check if renewal is allowed
    if (!session.timeoutConfig.autoRenew) {
      return false;
    }
    
    // Check maximum duration constraint
    const totalDuration = Date.now() - session.createdAt.getTime();
    const maxDurationMs = session.timeoutConfig.maxDurationMinutes * 60 * 1000;
    
    if (totalDuration >= maxDurationMs) {
      logger.warn(`Session ${session.id} reached max duration`);
      return false;
    }
    
    // Calculate new expiration time
    const timeoutMs = session.timeoutConfig.timeoutMinutes * 60 * 1000;
    const remainingMaxDuration = maxDurationMs - totalDuration;
    const effectiveTimeout = Math.min(timeoutMs, remainingMaxDuration);
    
    // Update session
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + effectiveTimeout);
    session.renewalCount++;
    session.warningState = undefined; // Reset warning
    
    return true;
  }
}
```

**4. Session Cleanup Service:**
```typescript
class SessionCleanupService {
  private cleanupInterval: NodeJS.Timeout;
  
  start(intervalMs: number = 5 * 60 * 1000): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMs);
  }
  
  performCleanup(): void {
    const now = Date.now();
    const stats = { 
      cleaned: 0, 
      expired: 0, 
      warned: 0, 
      invalid: 0 
    };
    
    for (const [sessionId, session] of sessions.entries()) {
      // Validate session structure
      if (!this.isValidSession(session)) {
        sessions.delete(sessionId);
        stats.invalid++;
        continue;
      }
      
      // Remove expired sessions
      if (session.expiresAt.getTime() <= now) {
        sessions.delete(sessionId);
        stats.expired++;
        stats.cleaned++;
        
        // Optional: Clean up associated channel resources
        this.cleanupChannelResources(session.channelId);
      }
      // Issue expiration warnings
      else if (this.shouldWarn(session)) {
        session.markWarningState();
        stats.warned++;
        
        // Optional: Emit warning event
        this.emitExpirationWarning(session);
      }
    }
    
    if (stats.cleaned > 0 || stats.warned > 0) {
      logger.info('Session cleanup cycle completed:', stats);
    }
  }
  
  private shouldWarn(session: Session): boolean {
    if (session.warningState?.sent) return false;
    
    const warningThresholdMs = session.timeoutConfig.warningThresholdMinutes * 60 * 1000;
    const timeToExpiration = session.expiresAt.getTime() - Date.now();
    
    return timeToExpiration <= warningThresholdMs;
  }
}
```

### Complete Session Usage Example

**React Hook for Session Management:**
```typescript
import { useState, useCallback, useEffect, useRef } from 'react';

interface UseElizaSessionProps {
  agentId: string;
  userId: string;
  timeoutConfig?: SessionTimeoutConfig;
}

function useElizaSession({ agentId, userId, timeoutConfig }: UseElizaSessionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [expirationWarning, setExpirationWarning] = useState(false);
  
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  
  const startSession = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userId,
          timeoutConfig: timeoutConfig || {
            timeoutMinutes: 30,
            autoRenew: true,
            maxDurationMinutes: 120,
            warningThresholdMinutes: 5
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }
      
      const session = await response.json();
      setSessionId(session.sessionId);
      setSessionStatus(session);
      
      // Start heartbeat to keep session alive
      startHeartbeat(session.sessionId);
      
      return session.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [agentId, userId, timeoutConfig]);
  
  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId) {
      throw new Error('No active session');
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          userId,
          metadata: { timestamp: new Date().toISOString() }
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // Session expired
          setSessionId(null);
          setSessionStatus(null);
          throw new Error('Session expired');
        }
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update session status
      setSessionStatus(result.sessionStatus);
      
      // Check for expiration warning
      if (result.warningState?.sent) {
        setExpirationWarning(true);
      }
      
      // Add message to local state
      setMessages(prev => [...prev, {
        id: result.id,
        text: text,
        userId: userId,
        timestamp: result.timestamp,
        type: 'user'
      }]);
      
      // Add agent response if present
      if (result.response) {
        setMessages(prev => [...prev, {
          id: result.id + '_response',
          text: result.response,
          userId: agentId,
          timestamp: result.timestamp,
          type: 'agent'
        }]);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [sessionId, userId, agentId]);
  
  const renewSession = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        setSessionStatus(result);
        setExpirationWarning(false);
      }
    } catch (error) {
      console.error('Failed to renew session:', error);
    }
  }, [sessionId]);
  
  const endSession = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      setSessionId(null);
      setSessionStatus(null);
      setMessages([]);
      setExpirationWarning(false);
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [sessionId]);
  
  const startHeartbeat = useCallback((sessionId: string) => {
    // Send heartbeat every 5 minutes to keep session alive
    heartbeatInterval.current = setInterval(async () => {
      try {
        await fetch(`/api/sessions/${sessionId}/heartbeat`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
        // Session might be expired, clear local state
        setSessionId(null);
        setSessionStatus(null);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }, []);
  
  useEffect(() => {
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);
  
  return {
    sessionId,
    sessionStatus,
    messages,
    loading,
    expirationWarning,
    startSession,
    sendMessage,
    renewSession,
    endSession
  };
}
```

---

## Testing & Development Practices

### Testing Framework (Bun Test)

ElizaOS uses Bun's built-in test runner, **NOT Vitest**. This is critical for compatibility.

**Test File Structure:**
```
plugin-name/
├── src/
│   ├── index.ts
│   ├── actions/
│   ├── providers/
│   └── services/
├── __tests__/
│   ├── actions.test.ts
│   ├── providers.test.ts
│   ├── services.test.ts
│   └── integration.test.ts
└── tests.ts  // Plugin test suite
```

**Basic Test Setup:**
```typescript
// __tests__/actions.test.ts
import { test, expect, beforeEach, afterEach, describe } from 'bun:test';
import { AgentRuntime, Memory, generateId } from '@elizaos/core';
import { myAction } from '../src/actions/my-action';

describe('My Action Tests', () => {
  let runtime: AgentRuntime;
  let mockMessage: Memory;
  
  beforeEach(() => {
    // Setup test runtime
    runtime = new AgentRuntime({
      character: {
        name: 'TestAgent',
        bio: 'Test agent for unit testing'
      },
      // Mock dependencies
      databaseAdapter: createMockDatabase(),
      modelProvider: createMockModelProvider(),
    });
    
    // Create mock message
    mockMessage = {
      id: generateId(),
      entityId: 'user-123' as UUID,
      roomId: 'room-456' as UUID,
      content: {
        text: 'test message',
        source: 'test'
      },
      createdAt: new Date()
    };
  });
  
  afterEach(() => {
    // Clean up
    runtime = null;
    mockMessage = null;
  });
  
  test('action validates correctly', async () => {
    const isValid = await myAction.validate(runtime, mockMessage);
    expect(isValid).toBe(true);
  });
  
  test('action handler executes successfully', async () => {
    let callbackResult: any;
    
    const mockCallback = (result: any) => {
      callbackResult = result;
    };
    
    const success = await myAction.handler(
      runtime,
      mockMessage,
      {},
      {},
      mockCallback
    );
    
    expect(success).toBe(true);
    expect(callbackResult).toBeDefined();
    expect(callbackResult.text).toBeDefined();
    expect(callbackResult.action).toBe('MY_ACTION');
  });
  
  test('action handles errors gracefully', async () => {
    // Mock runtime to throw error
    const errorRuntime = {
      ...runtime,
      useModel: () => Promise.reject(new Error('Model failed'))
    };
    
    const success = await myAction.handler(
      errorRuntime,
      mockMessage,
      {},
      {},
      () => {}
    );
    
    expect(success).toBe(false);
  });
});
```

**Mock Utilities:**
```typescript
// __tests__/utils/mocks.ts
import { IDatabaseAdapter, IModelProvider } from '@elizaos/core';

export function createMockDatabase(): IDatabaseAdapter {
  return {
    createMemory: async (memory) => memory,
    getMemories: async () => [],
    searchMemories: async () => [],
    createEntity: async (entity) => entity,
    updateEntity: async (entity) => entity,
    // ... implement other required methods
  };
}

export function createMockModelProvider(): IModelProvider {
  return {
    generateText: async (params) => 'Mock generated text',
    generateEmbedding: async (text) => Array(1536).fill(0.1),
    generateObject: async (params) => ({ mock: 'object' }),
  };
}

export function createMockRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  const runtime = new AgentRuntime({
    character: {
      name: 'MockAgent',
      bio: 'Mock agent for testing'
    },
    databaseAdapter: createMockDatabase(),
    modelProvider: createMockModelProvider(),
    ...overrides
  });
  
  return runtime;
}
```

**Provider Testing:**
```typescript
// __tests__/providers.test.ts
import { test, expect, describe } from 'bun:test';
import { myProvider } from '../src/providers/my-provider';

describe('My Provider Tests', () => {
  test('provider returns correct data structure', async () => {
    const runtime = createMockRuntime();
    const message = createMockMessage();
    
    const result = await myProvider.get(runtime, message);
    
    expect(result).toHaveProperty('values');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('text');
    expect(typeof result.text).toBe('string');
  });
  
  test('provider handles missing data gracefully', async () => {
    const runtime = createMockRuntime({
      // Mock runtime that returns no data
      getDatabaseAdapter: () => ({
        ...createMockDatabase(),
        getMemories: async () => [] // No memories
      })
    });
    
    const message = createMockMessage();
    const result = await myProvider.get(runtime, message);
    
    expect(result.values).toEqual({});
    expect(result.data).toEqual({});
    expect(result.text).toBe('');
  });
});
```

**Service Testing:**
```typescript
// __tests__/services.test.ts
import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { MyService } from '../src/services/my-service';

describe('My Service Tests', () => {
  let service: MyService;
  let runtime: AgentRuntime;
  
  beforeAll(async () => {
    runtime = createMockRuntime();
    service = await MyService.start(runtime) as MyService;
  });
  
  afterAll(async () => {
    if (service) {
      await service.stop();
    }
  });
  
  test('service starts correctly', () => {
    expect(service).toBeDefined();
    expect(service.capabilityDescription).toBeDefined();
  });
  
  test('service performs operations', async () => {
    const result = await service.performOperation('test-data');
    expect(result).toBeDefined();
  });
  
  test('service handles errors', async () => {
    // Test error handling
    await expect(service.performOperation(null)).rejects.toThrow();
  });
});
```

### Integration Testing

**Plugin Integration Tests:**
```typescript
// __tests__/integration.test.ts  
import { test, expect, describe } from 'bun:test';
import { AgentRuntime } from '@elizaos/core';
import { myPlugin } from '../src/index';

describe('Plugin Integration Tests', () => {
  test('plugin loads correctly', () => {
    expect(myPlugin.name).toBeDefined();
    expect(myPlugin.actions).toBeDefined();
    expect(myPlugin.providers).toBeDefined();
  });
  
  test('plugin works with runtime', async () => {
    const runtime = new AgentRuntime({
      character: {
        name: 'TestAgent',
        bio: 'Integration test agent',
        plugins: ['my-plugin']
      },
      plugins: [myPlugin],
      databaseAdapter: createMockDatabase(),
      modelProvider: createMockModelProvider(),
    });
    
    await runtime.initialize();
    
    // Test that plugin components are registered
    expect(runtime.actions).toContain(myPlugin.actions[0]);
    expect(runtime.providers).toContain(myPlugin.providers[0]);
    
    // Test message processing with plugin
    const message = createMockMessage();
    const state = await runtime.composeState(message);
    
    expect(state).toBeDefined();
    expect(state.values).toBeDefined();
  });
});
```

**End-to-End Testing:**
```typescript
// __tests__/e2e.test.ts
import { test, expect, describe } from 'bun:test';
import { spawn } from 'child_process';

describe('End-to-End Tests', () => {
  test('agent responds to messages', async () => {
    // Start agent process
    const agentProcess = spawn('bun', ['run', 'start'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'test-key'
      }
    });
    
    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      // Send test message via API
      const response = await fetch('http://localhost:3000/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello, test message',
          userId: 'test-user',
          roomId: 'test-room'
        })
      });
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.response).toBeDefined();
    } finally {
      // Clean up
      agentProcess.kill();
    }
  }, 30000); // 30 second timeout
});
```

### Test Suite Implementation

**Plugin Test Suite:**
```typescript
// tests.ts - Plugin-level test suite
import type { TestSuite } from '@elizaos/core';

export const myPluginTestSuite: TestSuite = {
  name: 'My Plugin Test Suite',
  description: 'Comprehensive tests for my plugin functionality',
  
  async setup(): Promise<void> {
    // Global test setup
    console.log('Setting up plugin test suite');
  },
  
  async teardown(): Promise<void> {
    // Global test cleanup
    console.log('Tearing down plugin test suite');
  },
  
  tests: [
    {
      name: 'Action Validation Tests',
      async run(): Promise<boolean> {
        // Run action validation tests
        return true; // or false if tests fail
      }
    },
    {
      name: 'Provider Data Tests', 
      async run(): Promise<boolean> {
        // Run provider tests
        return true;
      }
    },
    {
      name: 'Service Integration Tests',
      async run(): Promise<boolean> {
        // Run service tests
        return true;
      }
    }
  ]
};

// Export test suite with plugin
export const myPlugin: Plugin = {
  name: 'my-plugin',
  description: 'My plugin with comprehensive testing',
  actions: [...],
  providers: [...],
  services: [...],
  tests: [myPluginTestSuite], // Include test suite
};
```

### Development Commands

**Essential Development Scripts:**
```json
// package.json
{
  "scripts": {
    "dev": "elizaos dev",
    "start": "elizaos start", 
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "build": "bun run build",
    "lint": "eslint src --ext ts",
    "lint:fix": "eslint src --ext ts --fix",
    "typecheck": "tsc --noEmit"
  }
}
```

**Development Workflow:**
```bash
# Start development mode with hot reloading
elizaos dev

# Run tests in watch mode during development  
bun test --watch

# Run full test suite
bun test

# Build and type check
bun run build && bun run typecheck

# Lint and fix code
bun run lint:fix
```

---

## Security & Performance

### Security Best Practices

**1. Credential Management**
Never hardcode API keys or sensitive data in source code:

```typescript
// ❌ NEVER do this
const OPENAI_API_KEY = "sk-hardcoded-key-here";

// ✅ Always use runtime settings
const apiKey = runtime.getSetting("OPENAI_API_KEY");
if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}
```

**Secret Storage Patterns:**
```typescript
// Environment variables (preferred)
const apiKey = process.env.OPENAI_API_KEY;

// Character settings (for per-agent secrets)
const character: Character = {
  name: "SecureAgent",
  settings: {
    secrets: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      DISCORD_TOKEN: process.env.DISCORD_TOKEN
    }
  }
};

// Runtime getSetting (recommended in plugins)
const secret = runtime.getSetting("API_SECRET");
```

**2. Input Validation**
Always validate and sanitize user inputs:

```typescript
export const secureAction: Action = {
  name: 'SECURE_ACTION',
  
  validate: async (runtime, message, state) => {
    // Validate input exists and is reasonable length
    const text = message.content.text;
    if (!text || text.length > 10000) {
      return false;
    }
    
    // Check for potential injection attacks
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /SELECT.*FROM/i,
      /DROP TABLE/i,
      /INSERT INTO/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        runtime.logger.warn('Suspicious input detected:', text);
        return false;
      }
    }
    
    return true;
  },
  
  handler: async (runtime, message, state, options, callback) => {
    // Sanitize input before processing
    const sanitizedText = message.content.text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s\-_.@]/g, '') // Keep only safe characters
      .substring(0, 1000); // Limit length
    
    // Process sanitized input
    const response = await processSecurely(sanitizedText);
    
    await callback({
      text: response,
      action: 'SECURE_ACTION'
    });
    
    return true;
  }
};
```

**3. Rate Limiting**
Implement rate limiting for external API calls:

```typescript
export class RateLimitedService extends Service {
  private requestCounts = new Map<string, number[]>();
  private readonly maxRequests = 100; // per hour
  private readonly windowMs = 60 * 60 * 1000; // 1 hour
  
  async makeAPIRequest(userId: string, requestData: any): Promise<any> {
    // Check rate limit
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Record request
    this.recordRequest(userId);
    
    try {
      return await this.executeAPIRequest(requestData);
    } catch (error) {
      this.runtime.logger.error('API request failed:', error);
      throw error;
    }
  }
  
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requestCounts.get(userId) || [];
    
    // Remove requests older than window
    const recentRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    this.requestCounts.set(userId, recentRequests);
    
    return recentRequests.length < this.maxRequests;
  }
  
  private recordRequest(userId: string): void {
    const userRequests = this.requestCounts.get(userId) || [];
    userRequests.push(Date.now());
    this.requestCounts.set(userId, userRequests);
  }
}
```

**4. Database Security**
Use parameterized queries and proper access controls:

```typescript
// ✅ Safe database query with parameterized inputs
export class SecureRepository {
  async getUserData(userId: UUID, dataType: string): Promise<any[]> {
    // Validate inputs
    if (!this.isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    
    if (!this.isValidDataType(dataType)) {
      throw new Error('Invalid data type');
    }
    
    // Use parameterized query
    return await this.db
      .select()
      .from(userDataTable)
      .where(
        and(
          eq(userDataTable.userId, userId),
          eq(userDataTable.dataType, dataType)
        )
      );
  }
  
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
  
  private isValidDataType(dataType: string): boolean {
    const allowedTypes = ['preferences', 'settings', 'metadata'];
    return allowedTypes.includes(dataType);
  }
}

// ❌ NEVER do raw string concatenation
// const query = `SELECT * FROM users WHERE id = '${userId}'`; // SQL injection risk!
```

### Performance Optimization

**1. Caching Strategies**

**State Caching:**
```typescript
export class CachedStateProvider implements Provider {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  name = 'CACHED_DATA';
  
  async get(runtime: IAgentRuntime, message: Memory): Promise<ProviderResult> {
    const cacheKey = this.generateCacheKey(message);
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      runtime.logger.debug('Returning cached data for provider');
      return cached.data;
    }
    
    // Fetch fresh data
    const freshData = await this.fetchFreshData(runtime, message);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: freshData,
      timestamp: Date.now()
    });
    
    return freshData;
  }
  
  private generateCacheKey(message: Memory): string {
    return `${message.roomId}-${message.entityId}`;
  }
}
```

**Connection Pooling:**
```typescript
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connectionPool: Pool;
  private readonly maxConnections = 20;
  
  private constructor() {
    this.connectionPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: this.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  
  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }
  
  async query(sql: string, params: any[] = []): Promise<any> {
    const client = await this.connectionPool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

**2. Memory Management**

**Automatic Cleanup:**
```typescript
export class MemoryManagerService extends Service {
  private cleanupInterval: NodeJS.Timeout;
  private readonly maxMemoryAge = 24 * 60 * 60 * 1000; // 24 hours
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new MemoryManagerService(runtime);
    service.startCleanupSchedule();
    return service;
  }
  
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  private startCleanupSchedule(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldMemories();
    }, 60 * 60 * 1000);
  }
  
  private async cleanupOldMemories(): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.maxMemoryAge);
    
    try {
      // Clean up old messages (keep recent ones)
      const deleteCount = await this.runtime.databaseAdapter.db
        .delete(messagesTable)
        .where(
          and(
            lt(messagesTable.createdAt, cutoffTime),
            eq(messagesTable.type, 'message')
          )
        );
      
      this.runtime.logger.info(`Cleaned up ${deleteCount} old messages`);
      
      // Clean up old embeddings for deleted messages
      await this.runtime.databaseAdapter.db
        .delete(embeddingsTable)
        .where(
          notExists(
            select({ id: messagesTable.id })
              .from(messagesTable)
              .where(eq(messagesTable.id, embeddingsTable.memoryId))
          )
        );
      
    } catch (error) {
      this.runtime.logger.error('Memory cleanup failed:', error);
    }
  }
}
```

**3. Query Optimization**

**Efficient Database Queries:**
```typescript
export class OptimizedRepository {
  // Use indexes and limit results
  async getRecentMessages(roomId: UUID, limit: number = 50): Promise<Memory[]> {
    return await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.roomId, roomId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit); // Always limit results
  }
  
  // Use pagination for large datasets
  async getMessagesPaginated(
    roomId: UUID, 
    cursor?: string, 
    limit: number = 20
  ): Promise<{ messages: Memory[]; nextCursor?: string }> {
    const query = this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.roomId, roomId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit + 1); // Get one extra to check for more
    
    if (cursor) {
      // Use cursor-based pagination
      query.where(lt(messagesTable.createdAt, new Date(cursor)));
    }
    
    const results = await query;
    const messages = results.slice(0, limit);
    const nextCursor = results.length > limit ? 
      messages[messages.length - 1].createdAt.toISOString() : 
      undefined;
    
    return { messages, nextCursor };
  }
  
  // Use batch operations for multiple inserts
  async createMultipleMemories(memories: Memory[]): Promise<void> {
    if (memories.length === 0) return;
    
    // Process in batches to avoid overwhelming database
    const batchSize = 100;
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      
      await this.db
        .insert(memoriesTable)
        .values(batch)
        .onConflictDoNothing(); // Handle duplicates gracefully
    }
  }
}
```

**4. Monitoring and Health Checks**

**Runtime Monitoring:**
```typescript
export class RuntimeMonitorService extends Service {
  static serviceType = 'runtime-monitor';
  capabilityDescription = 'Monitors runtime performance and health';
  
  private metrics = {
    messageCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
    activeConnections: 0
  };
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new RuntimeMonitorService(runtime);
    await service.initialize();
    return service;
  }
  
  private async initialize(): Promise<void> {
    // Monitor message processing
    this.runtime.on('messageProcessed', (duration: number) => {
      this.metrics.messageCount++;
      this.updateAverageResponseTime(duration);
    });
    
    this.runtime.on('error', (error: Error) => {
      this.metrics.errorCount++;
      this.runtime.logger.error('Runtime error:', error);
    });
    
    // Periodic health checks
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute
  }
  
  private collectSystemMetrics(): void {
    // Collect memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    
    // Log metrics
    this.runtime.logger.info('Runtime metrics:', this.metrics);
    
    // Check for issues
    if (this.metrics.memoryUsage > 500) { // 500MB threshold
      this.runtime.logger.warn('High memory usage detected:', this.metrics.memoryUsage);
    }
    
    if (this.metrics.errorCount > 10) { // Error threshold
      this.runtime.logger.warn('High error rate detected:', this.metrics.errorCount);
    }
  }
  
  private updateAverageResponseTime(duration: number): void {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.messageCount - 1) + duration) / 
      this.metrics.messageCount;
  }
  
  // Health check endpoint
  getHealthStatus(): any {
    return {
      status: this.metrics.errorCount < 5 ? 'healthy' : 'degraded',
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## Deployment & Publishing

### Plugin Publishing Process

**1. Plugin Development Setup**

Use the elizaOS CLI for scaffolding:
```bash
# Create new plugin with CLI
elizaos create -t plugin my-awesome-plugin

# Navigate to plugin directory
cd plugin-my-awesome-plugin

# Install dependencies (automatically done)
bun install

# Start development
elizaos dev
```

**2. Plugin Structure Requirements**

**Required Files:**
```
plugin-my-awesome-plugin/
├── src/
│   └── index.ts          # Main plugin export
├── images/
│   ├── logo.jpg          # 400x400px, <500KB
│   └── banner.jpg        # 1280x640px, <1MB  
├── package.json          # Plugin metadata
├── README.md             # Documentation
├── tsconfig.json         # TypeScript config
├── tsup.config.ts        # Build configuration
└── __tests__/            # Test files
```

**3. Package.json Configuration**

**Essential Package.json:**
```json
{
  "name": "plugin-my-awesome-plugin",
  "version": "1.0.0",
  "description": "A plugin that adds awesome functionality to elizaOS agents",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": "github:yourusername/plugin-my-awesome-plugin",
  "keywords": [
    "elizaos-plugin",
    "eliza-plugin", 
    "ai",
    "chatbot",
    "automation"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "bun test",
    "lint": "eslint src --ext ts",
    "prepublishOnly": "bun run build && bun run test"
  },
  "dependencies": {
    "@elizaos/core": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  },
  "agentConfig": {
    "actions": ["MY_AWESOME_ACTION"],
    "providers": ["AWESOME_DATA"],
    "evaluators": ["AWESOME_ANALYZER"],
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "services": ["AwesomeService"]
  },
  "files": [
    "dist",
    "images",
    "README.md",
    "LICENSE"
  ]
}
```

**4. Pre-Publication Validation**

**Required Validation Steps:**
```bash
# 1. Type check
bun run tsc --noEmit

# 2. Run all tests  
bun test

# 3. Build plugin
bun run build

# 4. Lint code
bun run lint

# 5. Validate images exist and correct size
ls -la images/
# Should show logo.jpg (400x400) and banner.jpg (1280x640)

# 6. Test publish (dry run)
elizaos publish --dry-run

# 7. Validate package contents
elizaos publish --test
```

**5. Publishing Steps**

**Authentication Setup:**
```bash
# 1. NPM authentication
bunx npm login

# 2. GitHub token setup (required for registry PR)
export GITHUB_TOKEN=your_github_personal_access_token_here

# Token needs these permissions:
# - repo (full repository access)
# - read:org (read organization membership)
# - workflow (update GitHub Action workflows)
```

**Publication Command:**
```bash
# Publish plugin to npm and submit to elizaOS registry
elizaos publish --npm

# This will:
# 1. Validate plugin structure and metadata
# 2. Build TypeScript code  
# 3. Publish package to npm
# 4. Create GitHub repository (if doesn't exist)
# 5. Open pull request to elizaOS plugin registry
# 6. Upload plugin assets and documentation
```

**6. Post-Publication Process**

**What Happens After Publishing:**
1. **NPM Package**: Available immediately at `npmjs.com/package/your-plugin`
2. **GitHub Repository**: Created at `github.com/yourusername/plugin-name`
3. **Registry PR**: Opened at `github.com/elizaos-plugins/registry/pulls`
4. **Review Process**: Maintainers review for quality and safety (1-3 business days)
5. **Registry Listing**: After approval, plugin appears in elizaOS plugin registry

### Plugin Updates and Maintenance

**Updating Published Plugins:**
```bash
# 1. Make your changes and test
bun run test

# 2. Update version in package.json
bun version patch  # or minor/major

# 3. Build updated plugin  
bun run build

# 4. Publish to npm
bun publish

# 5. Push changes to GitHub
git add .
git commit -m "Update to version X.Y.Z"
git push origin main
git push --tags
```

**Version Management Best Practices:**
- **Patch (X.Y.Z)**: Bug fixes, minor improvements
- **Minor (X.Y.0)**: New features, backward compatible
- **Major (X.0.0)**: Breaking changes, API modifications

### Production Deployment

**Environment Configuration for Production:**

**1. Environment Variables Setup:**
```bash
# Core configuration
NODE_ENV=production
LOG_LEVEL=info

# Database (PostgreSQL for production)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=elizaos_production
POSTGRES_USER=elizaos_user
POSTGRES_PASSWORD=secure_password

# LLM Providers
OPENAI_API_KEY=sk-your-production-key
ANTHROPIC_API_KEY=sk-ant-your-production-key

# Platform integrations
DISCORD_APPLICATION_ID=your-discord-app-id
DISCORD_API_TOKEN=your-discord-bot-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Security
JWT_SECRET=your-jwt-secret-here
API_RATE_LIMIT=100 # requests per minute
MAX_CONCURRENT_SESSIONS=1000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_RETENTION_DAYS=30
```

**2. Docker Deployment:**

**Dockerfile:**
```dockerfile
# Use official Bun image
FROM oven/bun:1.0-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build the application
RUN bun run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S elizaos -u 1001

# Change ownership
RUN chown -R elizaos:nodejs /app
USER elizaos

# Expose ports
EXPOSE 3000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "run", "start"]
```

**Docker Compose for Production:**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  elizaos:
    build: .
    container_name: elizaos-production
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://elizaos:${POSTGRES_PASSWORD}@postgres:5432/elizaos
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DISCORD_API_TOKEN=${DISCORD_API_TOKEN}
    depends_on:
      - postgres
      - redis
    networks:
      - elizaos-network
    volumes:
      - elizaos-logs:/app/logs
    ports:
      - "3000:3000"
      - "9090:9090"

  postgres:
    image: postgres:15-alpine
    container_name: elizaos-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=elizaos
      - POSTGRES_USER=elizaos
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - elizaos-network
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: elizaos-redis
    restart: unless-stopped
    networks:
      - elizaos-network
    volumes:
      - redis-data:/data

  nginx:
    image: nginx:alpine
    container_name: elizaos-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - elizaos
    networks:
      - elizaos-network

volumes:
  postgres-data:
  redis-data:
  elizaos-logs:

networks:
  elizaos-network:
    driver: bridge
```

**3. Production Monitoring:**

**Metrics Collection:**
```typescript
// monitoring/metrics.ts
import { PrometheusRegistry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsCollector {
  private registry = new PrometheusRegistry();
  
  // Counters
  private messageCounter = new Counter({
    name: 'elizaos_messages_total',
    help: 'Total number of messages processed',
    labelNames: ['agent_id', 'platform', 'status'],
    registers: [this.registry]
  });
  
  private errorCounter = new Counter({
    name: 'elizaos_errors_total', 
    help: 'Total number of errors',
    labelNames: ['type', 'service'],
    registers: [this.registry]
  });
  
  // Histograms
  private responseTimeHistogram = new Histogram({
    name: 'elizaos_response_time_seconds',
    help: 'Response time in seconds',
    labelNames: ['agent_id', 'action'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [this.registry]
  });
  
  // Gauges
  private activeSessionsGauge = new Gauge({
    name: 'elizaos_active_sessions',
    help: 'Number of active sessions',
    registers: [this.registry]
  });
  
  recordMessage(agentId: string, platform: string, status: string): void {
    this.messageCounter.inc({ agent_id: agentId, platform, status });
  }
  
  recordError(type: string, service: string): void {
    this.errorCounter.inc({ type, service });
  }
  
  recordResponseTime(agentId: string, action: string, duration: number): void {
    this.responseTimeHistogram.observe({ agent_id: agentId, action }, duration);
  }
  
  updateActiveSessions(count: number): void {
    this.activeSessionsGauge.set(count);
  }
  
  getMetrics(): string {
    return this.registry.metrics();
  }
}
```

**Health Check Endpoint:**
```typescript
// routes/health.ts
import { Route } from '@elizaos/core';

export const healthRoute: Route = {
  type: 'GET',
  path: '/health',
  public: true,
  name: 'Health Check',
  
  handler: async (req, res, runtime) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      services: {}
    };
    
    try {
      // Check database connection
      await runtime.databaseAdapter.query('SELECT 1');
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }
    
    // Check model provider
    try {
      await runtime.useModel(ModelType.TEXT_SMALL, { 
        prompt: 'health check', 
        maxTokens: 1 
      });
      health.services.llm = 'healthy';
    } catch (error) {
      health.services.llm = 'unhealthy';
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }
};
```

**4. Scaling and Load Balancing:**

**Horizontal Scaling Configuration:**
```yaml
# kubernetes/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elizaos-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: elizaos
  template:
    metadata:
      labels:
        app: elizaos
    spec:
      containers:
      - name: elizaos
        image: elizaos:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: elizaos-secrets
              key: database-url
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: elizaos-service
spec:
  selector:
    app: elizaos
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

This comprehensive documentation provides complete coverage of the ElizaOS framework for building AI agents, plugins, and applications. It serves as the definitive guide for development within the ElizaOS ecosystem, covering everything from basic concepts to advanced deployment patterns.
