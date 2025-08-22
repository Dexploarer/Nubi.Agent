#!/usr/bin/env bun

/**
 * ElizaOS Integration Validator
 * Validates all integrations against ElizaOS standards
 */

import { createClient } from '@supabase/supabase-js';
// socket.io-client may not be installed; load lazily if present
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export class IntegrationValidator {
  public results: ValidationResult[] = [];

  async validateAll(): Promise<ValidationResult[]> {
    console.log('🔍 ElizaOS Integration Validation Starting...\n');

    // 1. Validate Plugin Structure
    await this.validatePluginStructure();

    // 2. Validate Supabase Connection
    await this.validateSupabase();

    // 3. Validate Socket.IO
    await this.validateSocketIO();

    // 4. Validate Character Configuration
    await this.validateCharacter();

    // 5. Validate Edge Functions
    await this.validateEdgeFunctions();

    // 6. Validate Services
    await this.validateServices();

    // Print results
    this.printResults();
    return this.results;
  }

  private async validatePluginStructure() {
    const pluginPath = path.join(__dirname, '..', 'src', 'nubi-plugin.ts');
    
    if (fs.existsSync(pluginPath)) {
      const content = fs.readFileSync(pluginPath, 'utf-8');
      
      // Check for required exports
      const hasDefault = content.includes('export default');
      const hasActions = content.includes('actions:');
      const hasEvaluators = content.includes('evaluators:');
      const hasProviders = content.includes('providers:');
      
      if (hasDefault && hasActions && hasEvaluators && hasProviders) {
        this.results.push({
          component: 'Plugin Structure',
          status: 'pass',
          message: 'Plugin follows ElizaOS structure'
        });
      } else {
        this.results.push({
          component: 'Plugin Structure',
          status: 'fail',
          message: 'Missing required plugin components',
          details: { hasDefault, hasActions, hasEvaluators, hasProviders }
        });
      }
    } else {
      this.results.push({
        component: 'Plugin Structure',
        status: 'fail',
        message: 'Plugin file not found'
      });
    }
  }

  private async validateSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      this.results.push({
        component: 'Supabase',
        status: 'warning',
        message: 'Supabase credentials not configured',
        details: 'Add SUPABASE_URL and SUPABASE_ANON_KEY to .env'
      });
      return;
    }

    try {
      const supabase = createClient(url, key);
      const { data, error } = await supabase.from('_test_connection').select('*').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (expected)
        throw error;
      }
      
      this.results.push({
        component: 'Supabase',
        status: 'pass',
        message: 'Supabase connection successful'
      });

      // Check edge functions
      const functions = [
        'analytics-engine',
        'personality-evolution',
        'raid-coordinator',
        'security-filter'
      ];

      for (const func of functions) {
        const funcPath = path.join(__dirname, '..', 'supabase', 'functions', func);
        if (fs.existsSync(funcPath)) {
          this.results.push({
            component: `Edge Function: ${func}`,
            status: 'pass',
            message: 'Function directory exists'
          });
        } else {
          this.results.push({
            component: `Edge Function: ${func}`,
            status: 'warning',
            message: 'Function directory not found'
          });
        }
      }
    } catch (error: any) {
      this.results.push({
        component: 'Supabase',
        status: 'fail',
        message: 'Supabase connection failed',
        details: error.message
      });
    }
  }

  private async validateSocketIO() {
    const port = process.env.PORT || 8080;
    // Dynamically import socket.io-client if available
    try {
      const mod = await import('socket.io-client');
      const io = (mod as any).io || (mod as any).default?.io || (mod as any).default;
      if (!io) throw new Error('socket.io-client export not found');

      const socket = io(`http://localhost:${port}`, {
        timeout: 5000,
        reconnection: false
      });

      return await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          this.results.push({
            component: 'Socket.IO',
            status: 'pass',
            message: `Socket.IO server running on port ${port}`
          });
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', () => {
          this.results.push({
            component: 'Socket.IO',
            status: 'warning',
            message: 'Socket.IO server not running',
            details: 'Start server with: bun run dev'
          });
          resolve();
        });

        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 3000);
      });
    } catch (e: any) {
      // socket.io-client not installed; report as warning but continue
      this.results.push({
        component: 'Socket.IO',
        status: 'warning',
        message: 'socket.io-client not installed; skipping Socket.IO check',
        details: 'Add socket.io-client to dependencies to enable check'
      });
    }
  }

  private async validateCharacter() {
    const characterPath = path.join(__dirname, '..', 'config', 'nubi-config.yaml');
    
    if (fs.existsSync(characterPath)) {
      const content = fs.readFileSync(characterPath, 'utf-8');
      
      // Check for required character fields
      const hasName = content.includes('name:');
      const hasPersonality = content.includes('personality:');
      const hasBio = content.includes('bio:');
      
      if (hasName && hasPersonality && hasBio) {
        this.results.push({
          component: 'Character Configuration',
          status: 'pass',
          message: 'NUBI character properly configured'
        });
      } else {
        this.results.push({
          component: 'Character Configuration',
          status: 'warning',
          message: 'Character configuration incomplete'
        });
      }
    } else {
      this.results.push({
        component: 'Character Configuration',
        status: 'fail',
        message: 'Character configuration not found'
      });
    }
  }

  private async validateEdgeFunctions() {
    const functionsDir = path.join(__dirname, '..', 'supabase', 'functions');
    
    if (fs.existsSync(functionsDir)) {
      const functions = fs.readdirSync(functionsDir).filter(f => 
        fs.statSync(path.join(functionsDir, f)).isDirectory()
      );
      
      this.results.push({
        component: 'Edge Functions',
        status: 'pass',
        message: `${functions.length} edge functions found`,
        details: functions
      });
    } else {
      this.results.push({
        component: 'Edge Functions',
        status: 'fail',
        message: 'Edge functions directory not found'
      });
    }
  }

  private async validateServices() {
    const services = [
      'enhanced-realtime-service.ts',
      'socket-io-analytics-enhanced.ts',
      'raid-socket-service.ts',
      'personality-service.ts'
    ];

    const servicesDir = path.join(__dirname, '..', 'src', 'services');
    
    for (const service of services) {
      const servicePath = path.join(servicesDir, service);
      if (fs.existsSync(servicePath)) {
        this.results.push({
          component: `Service: ${service}`,
          status: 'pass',
          message: 'Service file exists'
        });
      } else {
        this.results.push({
          component: `Service: ${service}`,
          status: 'warning',
          message: 'Service file not found'
        });
      }
    }
  }

  private printResults() {
    console.log('\n📊 Validation Results\n');
    console.log('═'.repeat(60));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'fail' ? '❌' : '⚠️';
      
      console.log(`${icon} ${result.component}`);
      console.log(`   ${result.message}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}`);
      }
      console.log();
    });

    console.log('═'.repeat(60));
    console.log('\n📈 Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    const score = (passed / this.results.length) * 100;
    console.log(`\n   Score: ${score.toFixed(1)}%`);
    
    if (score === 100) {
      console.log('\n🎉 Perfect! All integrations are properly configured!');
    } else if (score >= 80) {
      console.log('\n✨ Good! Most integrations are working correctly.');
    } else if (score >= 60) {
      console.log('\n💡 Some integrations need attention.');
    } else {
      console.log('\n🔧 Several integrations need to be configured.');
    }

    console.log('\n📚 ElizaOS Documentation: https://docs.elizaos.ai/');
  }
}

// Run validation when executed directly
if (import.meta.main) {
  const validator = new IntegrationValidator();
  validator.validateAll().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
