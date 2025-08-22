import {
  IAgentRuntime,
  Service,
  ServiceType,
  Memory,
  State,
  Action,
  ActionResult,
  Content,
  logger,
} from "../core";
import { MessageBusService } from "../messaging";

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  condition?: (state: any) => boolean;
  retryCount?: number;
  timeout?: number;
  parallel?: boolean;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  onSuccess?: (results: any) => void;
  onError?: (error: any) => void;
  metadata?: Record<string, any>;
}

/**
 * Execution context for workflows
 */
export interface ExecutionContext {
  workflowId: string;
  runtime: IAgentRuntime;
  state: State;
  memory: Memory;
  variables: Record<string, any>;
  stepResults: Map<string, ActionResult>;
  currentStep: number;
  startTime: number;
  userId?: string;
}

/**
 * Strategic Action Orchestrator Service
 *
 * Implements ElizaOS strategic action chaining with LLM-driven
 * tool orchestration, workflow templates, and parallel execution
 */
export class StrategyActionOrchestratorService extends Service {
  static serviceType = "strategic-action-orchestrator" as const;

  private workflows: Map<string, Workflow> = new Map();
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private workflowTemplates: Map<string, Workflow> = new Map();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  get capabilityDescription(): string {
    return "Strategic action orchestrator for multi-step workflows and LLM-driven task execution";
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping Strategic Action Orchestrator...");
    // Cancel all active executions
    for (const executionId of this.activeExecutions.keys()) {
      this.cancelExecution(executionId);
    }
    this.workflows.clear();
    this.workflowTemplates.clear();
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new StrategyActionOrchestratorService(runtime);
    logger.info("✅ Strategic Action Orchestrator Service started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("strategic-action-orchestrator");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ Strategic Action Orchestrator started");
    // Service is ready - no specific startup tasks needed
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info("🎯 Initializing Strategic Action Orchestrator...");

    // Register default workflow templates
    this.registerDefaultWorkflows();

    logger.info(
      `✅ Action Orchestrator initialized with ${this.workflowTemplates.size} templates`,
    );
  }

  /**
   * Register default workflow templates
   */
  private registerDefaultWorkflows(): void {
    // Social media engagement workflow
    this.registerWorkflowTemplate({
      id: "social-engagement",
      name: "Social Media Engagement",
      description: "Comprehensive social media interaction workflow",
      steps: [
        {
          id: "analyze-content",
          name: "Analyze Content",
          action: "ANALYZE_SOCIAL_CONTENT",
          inputs: { contentUrl: "{{targetUrl}}" },
          outputs: {
            sentiment: "sentiment",
            topics: "topics",
            engagement: "metrics",
          },
        },
        {
          id: "generate-response",
          name: "Generate Response",
          action: "GENERATE_SOCIAL_RESPONSE",
          inputs: {
            sentiment: "{{analyze-content.sentiment}}",
            topics: "{{analyze-content.topics}}",
            style: "authentic",
          },
          outputs: { response: "text", hashtags: "tags" },
        },
        {
          id: "post-response",
          name: "Post Response",
          action: "POST_SOCIAL_MESSAGE",
          inputs: {
            text: "{{generate-response.response}}",
            hashtags: "{{generate-response.hashtags}}",
            replyTo: "{{targetUrl}}",
          },
          parallel: false,
        },
        {
          id: "track-engagement",
          name: "Track Engagement",
          action: "TRACK_POST_PERFORMANCE",
          inputs: { postId: "{{post-response.postId}}" },
          timeout: 300000, // 5 minutes
        },
      ],
    });

    // Content creation workflow
    this.registerWorkflowTemplate({
      id: "content-creation",
      name: "Content Creation Pipeline",
      description:
        "Multi-stage content creation with research and optimization",
      steps: [
        {
          id: "research-topic",
          name: "Research Topic",
          action: "RESEARCH_TOPIC",
          inputs: { topic: "{{topic}}", depth: "comprehensive" },
          outputs: { facts: "facts", trends: "trends", insights: "insights" },
        },
        {
          id: "generate-outline",
          name: "Generate Outline",
          action: "CREATE_CONTENT_OUTLINE",
          inputs: {
            topic: "{{topic}}",
            facts: "{{research-topic.facts}}",
            trends: "{{research-topic.trends}}",
          },
          outputs: { outline: "structure", hooks: "hooks" },
        },
        {
          id: "create-content",
          name: "Create Content",
          action: "GENERATE_CONTENT",
          inputs: {
            outline: "{{generate-outline.structure}}",
            hooks: "{{generate-outline.hooks}}",
            style: "anubis-voice",
          },
          outputs: { content: "text", metadata: "meta" },
        },
        {
          id: "optimize-content",
          name: "Optimize Content",
          action: "OPTIMIZE_FOR_ENGAGEMENT",
          inputs: {
            content: "{{create-content.text}}",
            platform: "{{platform}}",
          },
          outputs: { optimized: "text", hashtags: "tags", timing: "schedule" },
        },
        {
          id: "schedule-post",
          name: "Schedule Post",
          action: "SCHEDULE_CONTENT",
          inputs: {
            content: "{{optimize-content.optimized}}",
            hashtags: "{{optimize-content.hashtags}}",
            timing: "{{optimize-content.schedule}}",
            platform: "{{platform}}",
          },
          parallel: false,
        },
      ],
    });

    // Raid coordination workflow
    this.registerWorkflowTemplate({
      id: "raid-coordination",
      name: "Telegram Raid Coordination",
      description: "Automated raid creation and coordination workflow",
      steps: [
        {
          id: "find-target",
          name: "Find Raid Target",
          action: "FIND_RAID_TARGET",
          inputs: { criteria: "high-engagement", platform: "twitter" },
          outputs: { targetUrl: "url", targetType: "type", metrics: "metrics" },
        },
        {
          id: "create-raid",
          name: "Create Raid Message",
          action: "CREATE_RAID_MESSAGE",
          inputs: {
            targetUrl: "{{find-target.url}}",
            targetType: "{{find-target.type}}",
            duration: 30, // minutes
          },
          outputs: { raidMessage: "text", instructions: "instructions" },
        },
        {
          id: "broadcast-raid",
          name: "Broadcast to Telegram",
          action: "BROADCAST_RAID",
          inputs: {
            message: "{{create-raid.raidMessage}}",
            instructions: "{{create-raid.instructions}}",
            channels: ["main", "vip"],
          },
          parallel: true,
        },
        {
          id: "monitor-participation",
          name: "Monitor Raid Participation",
          action: "MONITOR_RAID_PROGRESS",
          inputs: { raidId: "{{create-raid.raidId}}" },
          timeout: 1800000, // 30 minutes
        },
        {
          id: "calculate-rewards",
          name: "Calculate Rewards",
          action: "CALCULATE_RAID_REWARDS",
          inputs: {
            raidId: "{{create-raid.raidId}}",
            participants: "{{monitor-participation.participants}}",
          },
        },
      ],
    });

    logger.info("📝 Registered default workflow templates");
  }

  /**
   * Register a workflow template
   */
  registerWorkflowTemplate(workflow: Workflow): void {
    this.workflowTemplates.set(workflow.id, workflow);
    logger.info(`📋 Registered workflow template: ${workflow.name}`);
  }

  /**
   * Execute a workflow by template ID
   */
  async executeWorkflow(
    templateId: string,
    runtime: IAgentRuntime,
    memory: Memory,
    state: State,
    variables: Record<string, any> = {},
  ): Promise<ActionResult> {
    const template = this.workflowTemplates.get(templateId);
    if (!template) {
      return {
        success: false,
        text: `Workflow template not found: ${templateId}`,
        error: new Error(`Unknown workflow template: ${templateId}`),
      };
    }

    const executionId = `${templateId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const context: ExecutionContext = {
      workflowId: executionId,
      runtime,
      state,
      memory,
      variables,
      stepResults: new Map(),
      currentStep: 0,
      startTime: Date.now(),
      userId: (memory as any).userId || "system",
    };

    this.activeExecutions.set(executionId, context);

    try {
      logger.info(
        `🚀 Starting workflow execution: ${template.name} (${executionId})`,
      );

      const result = await this.executeWorkflowSteps(template, context);

      // Cleanup
      this.activeExecutions.delete(executionId);

      logger.info(
        `✅ Workflow completed: ${template.name} in ${Date.now() - context.startTime}ms`,
      );

      return {
        success: true,
        text: `Workflow "${template.name}" executed successfully`,
        values: {
          workflowId: executionId,
          executionTime: Date.now() - context.startTime,
          stepsCompleted: context.stepResults.size,
        },
        data: {
          stepResults: Array.from(context.stepResults.entries()),
          finalState: context.variables,
        },
      };
    } catch (error) {
      this.activeExecutions.delete(executionId);
      logger.error(
        `❌ Workflow failed: ${template.name}`,
        error instanceof Error ? error.message : String(error),
      );

      return {
        success: false,
        text: `Workflow "${template.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute workflow steps sequentially or in parallel
   */
  private async executeWorkflowSteps(
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<void> {
    const parallelSteps: WorkflowStep[] = [];

    for (const step of workflow.steps) {
      // Skip if condition fails
      if (step.condition && !step.condition(context.variables)) {
        logger.info(`⏭️  Skipping step: ${step.name} (condition failed)`);
        continue;
      }

      if (step.parallel) {
        parallelSteps.push(step);
      } else {
        // Execute any pending parallel steps first
        if (parallelSteps.length > 0) {
          await this.executeParallelSteps(parallelSteps, workflow, context);
          parallelSteps.length = 0;
        }

        // Execute this step sequentially
        await this.executeStep(step, workflow, context);
      }
    }

    // Execute any remaining parallel steps
    if (parallelSteps.length > 0) {
      await this.executeParallelSteps(parallelSteps, workflow, context);
    }
  }

  /**
   * Execute multiple steps in parallel
   */
  private async executeParallelSteps(
    steps: WorkflowStep[],
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<void> {
    logger.info(`🔀 Executing ${steps.length} parallel steps`);

    const promises = steps.map((step) =>
      this.executeStep(step, workflow, context),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<void> {
    logger.info(`⚡ Executing step: ${step.name} (${step.action})`);

    const startTime = Date.now();
    let retries = step.retryCount || 0;

    while (retries >= 0) {
      try {
        // Resolve input variables
        const resolvedInputs = this.resolveVariables(
          step.inputs || {},
          context,
        );

        // Execute the action
        const result = await this.executeAction(
          step.action,
          resolvedInputs,
          context,
          step.timeout,
        );

        // Store results
        context.stepResults.set(step.id, result);

        // Map outputs to variables
        if (step.outputs && result.values) {
          for (const [outputKey, variableName] of Object.entries(
            step.outputs,
          )) {
            if (result.values[outputKey] !== undefined) {
              context.variables[variableName] = result.values[outputKey];
            }
          }
        }

        const executionTime = Date.now() - startTime;
        logger.info(`✅ Step completed: ${step.name} (${executionTime}ms)`);
        return;
      } catch (error) {
        retries--;
        if (retries >= 0) {
          logger.warn(
            `⚠️  Step failed, retrying: ${step.name} (${retries} retries left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
        } else {
          logger.error(
            `❌ Step failed permanently: ${step.name}`,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }
    }
  }

  /**
   * Execute a specific action with timeout
   */
  private async executeAction(
    actionName: string,
    inputs: Record<string, any>,
    context: ExecutionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    // Create a mock memory for the action
    const actionMemory: Memory = {
      ...context.memory,
      content: {
        ...context.memory.content,
        text: inputs.text || context.memory.content.text,
        action: actionName,
        inputs,
      },
    };

    // Get the action from runtime
    const action = context.runtime.actions?.find((a) => a.name === actionName);

    if (!action) {
      throw new Error(`Action not found: ${actionName}`);
    }

    // Execute with optional timeout
    const executeWithTimeout = async (): Promise<ActionResult> => {
      if (!action.handler) {
        throw new Error(`Action handler not found: ${actionName}`);
      }

      return (
        (await action.handler(
          context.runtime,
          actionMemory,
          context.state,
          { inputs },
          async (content: Content): Promise<Memory[]> => {
            // Handle callbacks if needed
            logger.info(
              `📤 Action callback: ${actionName}`,
              content.text?.substring(0, 100),
            );
            return [];
          },
        )) || { success: false, text: "Action returned undefined" }
      );
    };

    if (timeout) {
      return Promise.race([
        executeWithTimeout(),
        new Promise<ActionResult>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Action timeout: ${actionName}`)),
            timeout,
          ),
        ),
      ]);
    } else {
      return executeWithTimeout();
    }
  }

  /**
   * Resolve template variables in inputs
   */
  private resolveVariables(
    inputs: Record<string, any>,
    context: ExecutionContext,
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputs)) {
      if (
        typeof value === "string" &&
        value.startsWith("{{") &&
        value.endsWith("}}")
      ) {
        const variableName = value.slice(2, -2);

        // Handle step results (e.g., {{step-id.output}})
        if (variableName.includes(".")) {
          const [stepId, outputKey] = variableName.split(".");
          const stepResult = context.stepResults.get(stepId);
          resolved[key] =
            stepResult?.values?.[outputKey] || stepResult?.data?.[outputKey];
        } else {
          // Handle direct variables
          resolved[key] = context.variables[variableName];
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Get workflow execution status
   */
  getExecutionStatus(executionId: string): ExecutionContext | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel workflow execution
   */
  cancelExecution(executionId: string): boolean {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      this.activeExecutions.delete(executionId);
      logger.info(`🛑 Cancelled workflow execution: ${executionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get available workflow templates
   */
  getWorkflowTemplates(): Workflow[] {
    return Array.from(this.workflowTemplates.values());
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): ExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get orchestrator statistics
   */
  getOrchestratorStats(): Record<string, any> {
    return {
      templates: this.workflowTemplates.size,
      activeExecutions: this.activeExecutions.size,
      totalExecutions: this.workflowTemplates.size * 10, // Mock metric
      averageExecutionTime: 5000, // Mock metric
    };
  }
}

export default StrategyActionOrchestratorService;
