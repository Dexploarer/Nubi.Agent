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
export { StrategicActionOrchestrator } from './strategic-action-orchestrator';
export { PluginConfigurationManager } from './plugin-configuration-manager';

// Orchestration manager implementation
export class OrchestrationManagerImpl implements OrchestrationManager {
  private flows: Map<string, ActionFlow> = new Map();

  async startFlow(flow: ActionFlow): Promise<void> {
    this.flows.set(flow.id, flow);
    // Start flow execution logic
  }

  async stopFlow(flowId: string): Promise<void> {
    const flow = this.flows.get(flowId);
    if (flow) {
      flow.status = 'failed';
      this.flows.set(flowId, flow);
    }
  }

  getFlow(flowId: string): ActionFlow | null {
    return this.flows.get(flowId) || null;
  }

  getAllFlows(): ActionFlow[] {
    return Array.from(this.flows.values());
  }

  updateFlow(flow: ActionFlow): void {
    this.flows.set(flow.id, flow);
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
