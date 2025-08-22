#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface MCPConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

class MCPSetup {
  private configPath = '.mcp.json';
  private envExamplePath = 'config/mcp.env.example';
  private envPath = '.env.mcp'; // This should be in the root directory

  async setup() {
    console.log('🔧 Setting up XMCPX MCP Server integration...');
    
    try {
      // 1. Validate MCP configuration
      await this.validateMCPConfig();
      
      // 2. Check environment configuration
      await this.checkEnvironmentConfig();
      
      // 3. Install dependencies
      await this.installDependencies();
      
      // 4. Test MCP server connection
      await this.testMCPServer();
      
      console.log('✅ XMCPX MCP Server setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Configure your Twitter credentials in .env.mcp');
      console.log('2. Set up database connection if using persistent storage');
      console.log('3. Run "bun run dev" to start your agent with MCP support');
      
    } catch (error) {
      console.error('❌ MCP setup failed:', error);
      process.exit(1);
    }
  }

  private async validateMCPConfig(): Promise<void> {
    console.log('📋 Validating MCP configuration...');
    
    // For ElizaOS, MCP configuration is in character settings, not .mcp.json
    // Check if the character file exists and has MCP plugin
    const characterPath = 'src/character/nubi-character.ts';
    
    if (!existsSync(characterPath)) {
      throw new Error(`Character configuration file ${characterPath} not found`);
    }

    const characterContent = readFileSync(characterPath, 'utf8');
    
    // Check if MCP plugin is included
    if (!characterContent.includes('@elizaos/plugin-mcp')) {
      throw new Error('MCP plugin not found in character configuration');
    }

    // Check if XMCPX server is configured
    if (!characterContent.includes('@promptordie/xmcpx')) {
      throw new Error('XMCPX server configuration not found in character settings');
    }

    console.log('✅ MCP configuration validated in character settings');
  }

  private async checkEnvironmentConfig(): Promise<void> {
    console.log('🔐 Checking environment configuration...');
    
    if (!existsSync(this.envPath)) {
      console.log('⚠️  .env.mcp file not found. Creating from template...');
      
      if (existsSync(this.envExamplePath)) {
        const template = readFileSync(this.envExamplePath, 'utf8');
        writeFileSync(this.envPath, template);
        console.log('✅ Created .env.mcp from template');
      } else {
        console.log('⚠️  No template found. Please create .env.mcp manually');
      }
    } else {
      console.log('✅ Environment configuration file exists');
    }
  }

  private async installDependencies(): Promise<void> {
    console.log('📦 Installing MCP dependencies...');
    
    try {
      execSync('bun install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  }

  private async testMCPServer(): Promise<void> {
    console.log('🧪 Testing MCP server connection...');
    
    try {
      // Test if the package can be resolved
      execSync('npx -y @promptordie/xmcpx@latest --help', { 
        stdio: 'pipe',
        timeout: 10000 
      });
      console.log('✅ MCP server package accessible');
    } catch (error) {
      console.log('⚠️  MCP server test failed - this may be due to:');
      console.log('   1. Missing Twitter credentials (normal for initial setup)');
      console.log('   2. Dependency issues with agent-twitter-client (deprecated package)');
      console.log('   3. Node.js version compatibility issues');
      console.log('');
      console.log('💡 The server should work once configured with valid Twitter credentials');
      console.log('   If issues persist, check the XMCPX GitHub repository for updates');
    }
  }
}

// Run setup if called directly
if (import.meta.main) {
  const setup = new MCPSetup();
  setup.setup();
}

export default MCPSetup;
