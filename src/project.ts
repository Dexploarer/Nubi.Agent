import { Project, ProjectAgent } from '@elizaos/core'
import { nubiCharacter } from './character'
import { clickhouseAnalyticsPlugin } from './plugins'

/**
 * NUBI ElizaOS Project Configuration
 * 
 * This file defines the project structure following ElizaOS best practices:
 * - Single project with multiple agents
 * - Proper plugin management
 * - Character-driven configuration
 * - Framework-native lifecycle management
 */

// Define the NUBI project agent
export const nubiProjectAgent: ProjectAgent = {
  name: 'nubi',
  character: nubiCharacter,
  
  // Initialize the agent
  init: async (runtime) => {
    // Character initialization is handled by ElizaOS
    // Custom initialization logic can go here
    console.log('🚀 NUBI Agent initialized successfully')
  },

  // Plugins managed through character.plugins array
  // Additional project-level plugins can be added here
  plugins: [
    clickhouseAnalyticsPlugin
  ],

  // Project-specific configuration
  config: {
    environment: process.env.NODE_ENV || 'development',
    features: {
      telegramRaids: true,
      twitterMonitoring: true,
      discordIntegration: true,
      clickhouseAnalytics: true
    }
  }
}

// Export the project configuration
export const project: Project = {
  name: 'NUBI',
  version: '1.0.0',
  description: 'NUBI - The Symbiosis of Anubis - Advanced ElizaOS agent with personality system and Telegram raid coordination',
  agents: [nubiProjectAgent]
}

export default project