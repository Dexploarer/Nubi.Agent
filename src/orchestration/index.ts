/**
 * Orchestration Module - Strategic action orchestration and flow management
 * 
 * This module provides strategic action orchestration, flow management,
 * and coordination between different services and components.
 */

// Re-export core types
export type { IAgentRuntime, Service, Memory, State, Action, logger } from '../core';

// Orchestration types
export interface OrchestrationConfig {
  enabled: boolean;
  maxConcurrentActions: number;
  timeout: number;
  retryAttempts: number;
  enableLogging: boolean;
}

export interface ActionFlow {
  id: string;
  name: string;
  steps: ActionStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
}

export interface ActionStep {
  id: string;
  name: string;
  action: string;
  dependencies: string[];
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface OrchestrationManager {
  startFlow(flow: ActionFlow): Promise<void>;
  stopFlow(flowId: string): Promise<void>;
  getFlow(flowId: string): ActionFlow | null;
  getAllFlows(): ActionFlow[];
  updateFlow(flow: ActionFlow): void;
}

export interface StrategicContext {
  userId: string;
  roomId: string;
  platform: string;
  currentState: string;
  goals: string[];
  constraints: string[];
  metadata: Record<string, unknown>;
}

export interface StrategyConfig {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  triggers: string[];
  actions: string[];
  config: Record<string, unknown>;
}

// Service exports
export { StrategyActionOrchestratorService as StrategicActionOrchestrator } from './strategic-action-orchestrator';
export { PluginConfigurationManagerService } from './plugin-configuration-manager';

// Orchestration manager implementation
export class OrchestrationManagerImpl implements OrchestrationManager {
  private flows: Map<string, ActionFlow> = new Map();
  private flowStats: Map<string, { startTime: number; endTime?: number }> = new Map();

  async startFlow(flow: ActionFlow): Promise<void> {
    try {
      if (!validateActionFlow(flow)) {
        throw new Error(`Invalid flow configuration: ${flow.name}`);
      }
      
      this.flows.set(flow.id, flow);
      this.flowStats.set(flow.id, { startTime: Date.now() });
      
      logger.info(`🚀 Started flow: ${flow.name} (${flow.id})`);
    } catch (error) {
      logger.error(`Failed to start flow ${flow.name}:`, error);
      throw error;
    }
  }

  async stopFlow(flowId: string): Promise<void> {
    try {
      const flow = this.flows.get(flowId);
      if (flow) {
        flow.status = 'failed';
        this.flows.set(flowId, flow);
        
        const stats = this.flowStats.get(flowId);
        if (stats) {
          stats.endTime = Date.now();
          this.flowStats.set(flowId, stats);
        }
        
        logger.info(`🛑 Stopped flow: ${flow.name} (${flowId})`);
      } else {
        logger.warn(`Flow not found: ${flowId}`);
      }
    } catch (error) {
      logger.error(`Failed to stop flow ${flowId}:`, error);
      throw error;
    }
  }

  getFlow(flowId: string): ActionFlow | null {
    return this.flows.get(flowId) || null;
  }

  getAllFlows(): ActionFlow[] {
    return Array.from(this.flows.values());
  }

  updateFlow(flow: ActionFlow): void {
    try {
      if (!validateActionFlow(flow)) {
        throw new Error(`Invalid flow configuration: ${flow.name}`);
      }
      this.flows.set(flow.id, flow);
      logger.debug(`Updated flow: ${flow.name} (${flow.id})`);
    } catch (error) {
      logger.error(`Failed to update flow ${flow.id}:`, error);
      throw error;
    }
  }

  getFlowStats(flowId: string): { startTime: number; endTime?: number; duration?: number } | null {
    const stats = this.flowStats.get(flowId);
    if (!stats) return null;
    
    return {
      ...stats,
      duration: stats.endTime ? stats.endTime - stats.startTime : Date.now() - stats.startTime
    };
  }

  getAllFlowStats(): Record<string, { startTime: number; endTime?: number; duration?: number }> {
    const result: Record<string, { startTime: number; endTime?: number; duration?: number }> = {};
    
    for (const [flowId, stats] of this.flowStats.entries()) {
      result[flowId] = {
        ...stats,
        duration: stats.endTime ? stats.endTime - stats.startTime : Date.now() - stats.startTime
      };
    }
    
    return result;
  }
}

// Utility functions
export function createOrchestrationManager(): OrchestrationManager {
  return new OrchestrationManagerImpl();
}

export function createActionFlow(
  name: string,
  steps: ActionStep[]
): ActionFlow {
  return {
    id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    steps,
    currentStep: 0,
    status: 'pending',
    metadata: {}
  };
}

export function createActionStep(
  name: string,
  action: string,
  dependencies: string[] = [],
  config: Record<string, unknown> = {}
): ActionStep {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    action,
    dependencies,
    config,
    status: 'pending'
  };
}

export function createStrategicContext(
  userId: string,
  roomId: string,
  platform: string,
  currentState: string = 'idle',
  goals: string[] = [],
  constraints: string[] = []
): StrategicContext {
  return {
    userId,
    roomId,
    platform,
    currentState,
    goals,
    constraints,
    metadata: {}
  };
}

export function createStrategyConfig(
  name: string,
  description: string,
  triggers: string[] = [],
  actions: string[] = []
): StrategyConfig {
  return {
    name,
    description,
    enabled: true,
    priority: 1,
    triggers,
    actions,
    config: {}
  };
}

export function validateActionFlow(flow: ActionFlow): boolean {
  return !!(
    flow.id &&
    flow.name &&
    Array.isArray(flow.steps) &&
    flow.steps.length > 0 &&
    typeof flow.currentStep === 'number' &&
    ['pending', 'running', 'completed', 'failed'].includes(flow.status)
  );
}

export function validateActionStep(step: ActionStep): boolean {
  return !!(
    step.id &&
    step.name &&
    step.action &&
    Array.isArray(step.dependencies) &&
    ['pending', 'running', 'completed', 'failed'].includes(step.status)
  );
}
