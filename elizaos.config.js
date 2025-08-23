import { defineConfig } from '@elizaos/cli'

export default defineConfig({
  name: 'NUBI',
  version: '1.0.0',
  description: 'NUBI - The Symbiosis of Anubis - Advanced ElizaOS agent with personality system and Telegram raid coordination',
  
  // Core ElizaOS configuration
  core: {
    database: {
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/nubi',
      migrations: './supabase/migrations'
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json'
    },
    security: {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      }
    }
  },

  // Agent configuration
  agents: {
    nubi: {
      character: './src/character/nubi-character.ts',
      plugins: [
        '@elizaos/plugin-telegram',
        '@elizaos/plugin-openai',
        '@elizaos/plugin-knowledge',
        '@elizaos/plugin-mcp',
        './src/plugins/clickhouse-analytics.ts'
      ],
      providers: [
        './src/providers/enhanced-context-provider.ts',
        './src/providers/emotional-state-provider.ts',
        './src/providers/session-context-provider.ts'
      ],
      actions: [
        './src/actions/elizaos-ritual-action.ts',
        './src/actions/identity-linking-actions.ts'
      ]
    }
  },

  // Plugin configuration
  plugins: {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN,
      webhook: process.env.TELEGRAM_WEBHOOK_URL
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini'
    },
    knowledge: {
      vectorStore: 'postgres',
      embeddingModel: 'text-embedding-3-small'
    },
    mcp: {
      servers: [
        {
          name: 'nubi-mcp',
          command: 'node',
          args: ['./dist/src/mcp/nubi-mcp-server.js']
        }
      ]
    }
  },

  // Development configuration
  dev: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    watch: true
  },

  // Production configuration
  production: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    workers: process.env.WORKERS || 4
  }
})