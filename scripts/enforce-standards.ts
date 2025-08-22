#!/usr/bin/env bun

/**
 * Standards Enforcement Script
 * 
 * Automatically checks for violations of:
 * - TypeScript strict configuration
 * - ElizaOS logger usage
 * - No console.log statements
 * - Proper type safety
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { logger } from '@elizaos/core';

interface Violation {
  file: string;
  line: number;
  type: 'typescript' | 'logger' | 'console' | 'any-type';
  message: string;
  code: string;
}

class StandardsEnforcer {
  private violations: Violation[] = [];
  private readonly sourceDir = './src';
  private readonly configFiles = ['./tsconfig.json', './tsconfig.build.json'];

  async run(): Promise<void> {
    logger.info('🔍 Starting standards enforcement check...');
    
    await this.checkTypeScriptConfig();
    await this.scanSourceFiles();
    await this.reportViolations();
    
    if (this.violations.length > 0) {
      process.exit(1);
    } else {
      logger.info('✅ All standards passed!');
    }
  }

  private async checkTypeScriptConfig(): Promise<void> {
    logger.info('📋 Checking TypeScript configuration...');
    
    for (const configFile of this.configFiles) {
      try {
        const content = readFileSync(configFile, 'utf-8');
        const config = JSON.parse(content);
        
        const violations = this.validateTypeScriptConfig(config, configFile);
        this.violations.push(...violations);
      } catch (error) {
        logger.error(`Failed to read ${configFile}:`, error);
      }
    }
  }

  private validateTypeScriptConfig(config: any, file: string): Violation[] {
    const violations: Violation[] = [];
    const compilerOptions = config.compilerOptions || {};

    // Check strict mode settings
    const strictSettings = [
      'strict',
      'noImplicitAny',
      'strictNullChecks',
      'strictFunctionTypes',
      'strictBindCallApply',
      'strictPropertyInitialization',
      'noImplicitThis',
      'alwaysStrict'
    ];

    for (const setting of strictSettings) {
      if (compilerOptions[setting] === false) {
        violations.push({
          file,
          line: 1,
          type: 'typescript',
          message: `TypeScript setting '${setting}' must be true for strict mode`,
          code: `${setting}: false`
        });
      }
    }

    return violations;
  }

  private async scanSourceFiles(): Promise<void> {
    logger.info('🔍 Scanning source files for violations...');
    
    const files = this.getTypeScriptFiles(this.sourceDir);
    
    for (const file of files) {
      await this.checkFile(file);
    }
  }

  private getTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getTypeScriptFiles(fullPath));
        } else if (extname(item) === '.ts' || extname(item) === '.tsx') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.warn(`Could not read directory ${dir}:`, error);
    }
    
    return files;
  }

  private async checkFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Check for console usage
      lines.forEach((line, index) => {
        if (this.hasConsoleUsage(line)) {
          this.violations.push({
            file: filePath,
            line: index + 1,
            type: 'console',
            message: 'Console usage is forbidden. Use ElizaOS logger instead.',
            code: line.trim()
          });
        }
      });

      // Check for any types
      lines.forEach((line, index) => {
        if (this.hasAnyType(line)) {
          this.violations.push({
            file: filePath,
            line: index + 1,
            type: 'any-type',
            message: 'Any types are forbidden. Use proper TypeScript types.',
            code: line.trim()
          });
        }
      });

      // Check for custom logger imports
      if (this.hasCustomLoggerImport(content)) {
        this.violations.push({
          file: filePath,
          line: 1,
          type: 'logger',
          message: 'Custom logger imports are forbidden. Use @elizaos/core logger.',
          code: 'import { logger } from "./utils/logger"'
        });
      }

      // Check for missing ElizaOS logger imports
      if (this.hasLoggingButNoElizaOSLogger(content)) {
        this.violations.push({
          file: filePath,
          line: 1,
          type: 'logger',
          message: 'Logging detected but no ElizaOS logger import found.',
          code: 'Missing: import { logger } from "@elizaos/core"'
        });
      }

    } catch (error) {
      logger.error(`Failed to check file ${filePath}:`, error);
    }
  }

  private hasConsoleUsage(line: string): boolean {
    const consolePatterns = [
      /console\.log\s*\(/,
      /console\.error\s*\(/,
      /console\.warn\s*\(/,
      /console\.debug\s*\(/,
      /console\.info\s*\(/
    ];
    
    return consolePatterns.some(pattern => pattern.test(line));
  }

  private hasAnyType(line: string): boolean {
    const anyPatterns = [
      /:\s*any\b/,
      /as\s+any\b/,
      /Promise<any>/,
      /Array<any>/,
      /Map<.*,\s*any>/,
      /Set<any>/
    ];
    
    return anyPatterns.some(pattern => pattern.test(line));
  }

  private hasCustomLoggerImport(content: string): boolean {
    const customLoggerPatterns = [
      /import.*logger.*from.*["']\.\/utils\/logger["']/,
      /import.*logger.*from.*["']\.\.\/utils\/logger["']/,
      /import.*logger.*from.*["']\.\/.*logger["']/,
      /import.*Logger.*from.*["']winston["']/,
      /import.*Logger.*from.*["']pino["']/
    ];
    
    return customLoggerPatterns.some(pattern => pattern.test(content));
  }

  private hasLoggingButNoElizaOSLogger(content: string): boolean {
    const hasLogging = /logger\.(info|error|warn|debug)\s*\(/.test(content);
    const hasElizaOSLogger = /import.*logger.*from.*["']@elizaos\/core["']/.test(content);
    
    return hasLogging && !hasElizaOSLogger;
  }

  private async reportViolations(): Promise<void> {
    if (this.violations.length === 0) {
      logger.info('✅ No violations found!');
      return;
    }

    logger.error(`❌ Found ${this.violations.length} violations:`);
    
    const groupedViolations = this.groupViolationsByType();
    
    for (const [type, violations] of Object.entries(groupedViolations)) {
      logger.error(`\n📋 ${type.toUpperCase()} Violations (${violations.length}):`);
      
      violations.forEach(violation => {
        logger.error(`  ${violation.file}:${violation.line} - ${violation.message}`);
        logger.error(`    Code: ${violation.code}`);
      });
    }

    logger.error('\n🚨 Standards enforcement failed!');
    logger.error('Please fix all violations before committing.');
  }

  private groupViolationsByType(): Record<string, Violation[]> {
    return this.violations.reduce((groups, violation) => {
      const type = violation.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(violation);
      return groups;
    }, {} as Record<string, Violation[]>);
  }
}

// Run the enforcer
if (import.meta.main) {
  const enforcer = new StandardsEnforcer();
  enforcer.run().catch(error => {
    logger.error('Standards enforcement failed:', error);
    process.exit(1);
  });
}

export default StandardsEnforcer;
