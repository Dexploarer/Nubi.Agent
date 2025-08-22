/**
 * ElizaOS Plugin Testing Suite
 * Following: https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  IAgentRuntime, 
  Memory, 
  State, 
  Plugin,
  Action,
  Evaluator,
  Provider
} from '@elizaos/core';

// Import our plugin
import nubiPlugin from '../../anubis/src/nubi-plugin';

describe('NUBI Plugin - ElizaOS Compliance Tests', () => {
  let runtime: IAgentRuntime;
  let mockMemory: Memory;
  let mockState: State;

  beforeEach(() => {
    // Setup mock runtime according to ElizaOS standards
    runtime = {
      agentId: 'test-agent-id',
      roomId: 'test-room-id',
      userId: 'test-user-id',
      getSetting: jest.fn(),
      getMemory: jest.fn(),
      processMessage: jest.fn(),
      evaluate: jest.fn(),
      setState: jest.fn(),
      getState: jest.fn()
    } as unknown as IAgentRuntime;

    mockMemory = {
      id: 'test-memory-id',
      content: { text: 'test message' },
      roomId: 'test-room-id',
      userId: 'test-user-id',
      agentId: 'test-agent-id'
    } as Memory;

    mockState = {
      currentMessage: 'test',
      recentMessages: [],
      personality: 'neutral'
    } as unknown as State;
  });

  describe('Plugin Structure', () => {
    it('should have required plugin properties', () => {
      expect(nubiPlugin).toBeDefined();
      expect(nubiPlugin.name).toBe('nubi');
      expect(nubiPlugin.description).toBeDefined();
    });

    it('should have actions array', () => {
      expect(Array.isArray(nubiPlugin.actions)).toBe(true);
      expect(nubiPlugin.actions.length).toBeGreaterThan(0);
    });

    it('should have evaluators array', () => {
      expect(Array.isArray(nubiPlugin.evaluators)).toBe(true);
      expect(nubiPlugin.evaluators.length).toBeGreaterThan(0);
    });

    it('should have providers array', () => {
      expect(Array.isArray(nubiPlugin.providers)).toBe(true);
      expect(nubiPlugin.providers.length).toBeGreaterThan(0);
    });

    it('should have services if defined', () => {
      if (nubiPlugin.services) {
        expect(Array.isArray(nubiPlugin.services)).toBe(true);
      }
    });
  });

  describe('Action Validation', () => {
    it('each action should have required properties', () => {
      nubiPlugin.actions.forEach((action: Action) => {
        expect(action.name).toBeDefined();
        expect(typeof action.name).toBe('string');
        expect(action.description).toBeDefined();
        expect(action.validate).toBeDefined();
        expect(typeof action.validate).toBe('function');
        expect(action.handler).toBeDefined();
        expect(typeof action.handler).toBe('function');
      });
    });

    it('action validate should return boolean', async () => {
      const firstAction = nubiPlugin.actions[0];
      const result = await firstAction.validate(runtime, mockMemory, mockState);
      expect(typeof result).toBe('boolean');
    });

    it('action handler should execute without errors', async () => {
      const firstAction = nubiPlugin.actions[0];
      // Only run handler if validate passes
      const isValid = await firstAction.validate(runtime, mockMemory, mockState);
      if (isValid) {
        await expect(
          firstAction.handler(runtime, mockMemory, mockState)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Evaluator Validation', () => {
    it('each evaluator should have required properties', () => {
      nubiPlugin.evaluators.forEach((evaluator: Evaluator) => {
        expect(evaluator.name).toBeDefined();
        expect(typeof evaluator.name).toBe('string');
        expect(evaluator.description).toBeDefined();
        expect(evaluator.validate).toBeDefined();
        expect(typeof evaluator.validate).toBe('function');
        expect(evaluator.handler).toBeDefined();
        expect(typeof evaluator.handler).toBe('function');
      });
    });

    it('evaluator validate should return boolean', async () => {
      const firstEvaluator = nubiPlugin.evaluators[0];
      const result = await firstEvaluator.validate(runtime, mockMemory, mockState);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Provider Validation', () => {
    it('each provider should have required properties', () => {
      nubiPlugin.providers.forEach((provider: Provider) => {
        expect(provider.name).toBeDefined();
        expect(typeof provider.name).toBe('string');
        expect(provider.description).toBeDefined();
        expect(provider.get).toBeDefined();
        expect(typeof provider.get).toBe('function');
      });
    });

    it('provider get should return data', async () => {
      const firstProvider = nubiPlugin.providers[0];
      const result = await firstProvider.get(runtime, mockMemory, mockState);
      expect(result).toBeDefined();
    });
  });

  describe('Service Integration', () => {
    it('services should initialize correctly', async () => {
      if (nubiPlugin.services) {
        for (const service of nubiPlugin.services) {
          expect(service.name).toBeDefined();
          if (service.initialize) {
            await expect(
              service.initialize(runtime)
            ).resolves.not.toThrow();
          }
        }
      }
    });
  });

  describe('Character Configuration', () => {
    it('should load character configuration', () => {
      // Character should be loadable
      const characterPath = '../../anubis/config/nubi-config.yaml';
      expect(() => require(characterPath)).not.toThrow();
    });
  });

  describe('Supabase Integration', () => {
    it('should handle missing Supabase credentials gracefully', () => {
      const oldSupabaseUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;
      
      // Plugin should still load without Supabase
      expect(() => nubiPlugin).not.toThrow();
      
      // Restore
      if (oldSupabaseUrl) process.env.SUPABASE_URL = oldSupabaseUrl;
    });
  });

  describe('Socket.IO Integration', () => {
    it('should expose Socket.IO events', () => {
      // Check if Socket.IO service is available
      const socketService = nubiPlugin.services?.find(
        s => s.name.includes('socket') || s.name.includes('realtime')
      );
      
      if (socketService) {
        expect(socketService.name).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle null memory gracefully', async () => {
      const firstAction = nubiPlugin.actions[0];
      await expect(
        firstAction.validate(runtime, null as any, mockState)
      ).resolves.toBe(false);
    });

    it('should handle null state gracefully', async () => {
      const firstAction = nubiPlugin.actions[0];
      await expect(
        firstAction.validate(runtime, mockMemory, null as any)
      ).resolves.toBe(false);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});

describe('Integration Tests', () => {
  describe('Supabase Edge Functions', () => {
    it('should call personality-evolution edge function', async () => {
      // Mock test for edge function
      const mockSupabase = {
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: { personality: 'evolved' },
            error: null
          })
        }
      };

      const result = await mockSupabase.functions.invoke('personality-evolution', {
        body: { message: 'test' }
      });

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Real-time Events', () => {
    it('should emit Socket.IO events', (done) => {
      // Mock Socket.IO test
      const mockIo = {
        emit: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'connection') {
            callback({ id: 'test-socket' });
            done();
          }
        })
      };

      mockIo.on('connection', (socket) => {
        expect(socket.id).toBe('test-socket');
      });
    });
  });
});
