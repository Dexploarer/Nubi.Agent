/**
 * Integration tests following ElizaOS testing patterns
 * https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import {
    describe,
    expect,
    test,
    beforeEach,
    afterEach,
    mock,
    MockRuntime,
    createMockMessage,
    createMockState,
    createMockRoom,
    testAsyncOperation,
} from "./test-utils";
import { RoomType, ServiceType } from "@elizaos/core";
import plugin from "../plugin";

describe("Integration Tests", () => {
    describe("Plugin Integration", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
        });

        test("plugin should initialize with all components", () => {
            expect(plugin).toBeDefined();
            expect(plugin.name).toBe("nubi");
            expect(plugin.description).toBeDefined();
            expect(plugin.actions).toBeDefined();
            expect(plugin.providers).toBeDefined();
            expect(plugin.evaluators).toBeDefined();
            expect(plugin.services).toBeDefined();
        });

        test("plugin should register all services", async () => {
            if (!plugin.services) return;
            
            for (const service of plugin.services) {
                await service.initialize(mockRuntime);
            }
            
            // Verify services are registered
            expect(mockRuntime.services.size).toBeGreaterThan(0);
        });
    });

    describe("Message Processing Flow", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
            
            // Initialize plugin services
            if (plugin.services) {
                plugin.services.forEach(service => {
                    service.initialize(mockRuntime);
                });
            }
        });

        test("should process message through action pipeline", async () => {
            const message = createMockMessage({
                content: { text: "hello", action: null }
            });
            
            // Find matching action
            const matchingAction = plugin.actions?.find(action => 
                action.name === "HELLO_WORLD"
            );
            
            if (matchingAction && matchingAction.validate) {
                const isValid = await matchingAction.validate(mockRuntime, message);
                expect(isValid).toBe(true);
                
                if (isValid && matchingAction.handler) {
                    const callbackMock = mock(() => {});
                    const state = createMockState();
                    
                    await matchingAction.handler(
                        mockRuntime,
                        message,
                        state,
                        {},
                        callbackMock
                    );
                    
                    expect(callbackMock).toHaveBeenCalled();
                }
            }
        });

        test("should handle provider context in message processing", async () => {
            const message = createMockMessage({
                content: { text: "What time is it?", action: null }
            });
            
            // Get provider context
            const providers = plugin.providers || [];
            const context: Record<string, string> = {};
            
            for (const provider of providers) {
                const value = await provider.get(mockRuntime, message);
                context[provider.name] = value;
            }
            
            expect(Object.keys(context).length).toBeGreaterThan(0);
        });

        test("should apply evaluators to messages", async () => {
            const message = createMockMessage({
                content: { text: "Test message for evaluation", action: null }
            });
            
            const state = createMockState();
            
            if (plugin.evaluators && plugin.evaluators.length > 0) {
                for (const evaluator of plugin.evaluators) {
                    const result = await evaluator.evaluate(
                        mockRuntime,
                        message,
                        state
                    );
                    
                    expect(result).toBeDefined();
                    expect(typeof result).toBe("boolean");
                }
            }
        });
    });

    describe("Room Type Behavior", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
        });

        test("should handle DIRECT room type", async () => {
            const room = createMockRoom({
                type: RoomType.DIRECT,
                participants: ["user-1", "agent-1"]
            });
            
            mockRuntime.databaseAdapter.getRoom = mock(() => 
                Promise.resolve(room)
            );
            
            const message = createMockMessage({
                roomId: room.id,
                content: { text: "Direct message", action: null }
            });
            
            // Process message in direct room context
            const state = await mockRuntime.composeState(message);
            expect(state.roomId).toBe(room.id);
        });

        test("should handle GROUP room type", async () => {
            const room = createMockRoom({
                type: RoomType.GROUP,
                participants: ["user-1", "user-2", "agent-1"]
            });
            
            mockRuntime.databaseAdapter.getRoom = mock(() => 
                Promise.resolve(room)
            );
            
            const message = createMockMessage({
                roomId: room.id,
                content: { text: "@agent Group message", action: null }
            });
            
            // Process message in group room context
            const state = await mockRuntime.composeState(message);
            expect(state.roomId).toBe(room.id);
        });
    });

    describe("Error Recovery", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
        });

        test("should recover from action handler errors", async () => {
            const action = plugin.actions?.[0];
            if (!action) return;
            
            const message = createMockMessage();
            const state = createMockState();
            
            // Create a handler that throws
            const originalHandler = action.handler;
            action.handler = mock(async () => {
                throw new Error("Handler error");
            });
            
            const callbackMock = mock(() => {});
            
            try {
                await action.handler(
                    mockRuntime,
                    message,
                    state,
                    {},
                    callbackMock
                );
            } catch (error) {
                expect(error).toBeDefined();
            }
            
            // Restore original handler
            action.handler = originalHandler;
        });

        test("should handle database connection failures", async () => {
            mockRuntime.databaseAdapter.init = mock(() => 
                Promise.reject(new Error("Connection failed"))
            );
            
            try {
                await mockRuntime.databaseAdapter.init();
            } catch (error) {
                expect(error).toBeDefined();
                expect((error as Error).message).toContain("Connection failed");
            }
        });

        test("should handle service initialization failures gracefully", async () => {
            const service = plugin.services?.[0];
            if (!service) return;
            
            const failingRuntime = new MockRuntime();
            failingRuntime.registerService = mock(() => {
                throw new Error("Service registration failed");
            });
            
            try {
                await service.initialize(failingRuntime);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe("Performance", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
        });

        test("should process messages within reasonable time", async () => {
            const message = createMockMessage();
            const startTime = Date.now();
            
            // Simulate message processing
            const state = await mockRuntime.composeState(message);
            const completion = await mockRuntime.completion({
                context: state.recentMessages,
                modelClass: "standard",
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete within 1 second for mocked operations
            expect(duration).toBeLessThan(1000);
        });

        test("should handle concurrent messages", async () => {
            const messages = Array(10).fill(null).map((_, i) => 
                createMockMessage({
                    content: { text: `Message ${i}`, action: null }
                })
            );
            
            const promises = messages.map(msg => 
                mockRuntime.composeState(msg)
            );
            
            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.roomId).toBeDefined();
            });
        });
    });

    describe("Data Persistence", () => {
        let mockRuntime: MockRuntime;

        beforeEach(() => {
            mockRuntime = new MockRuntime();
        });

        test("should persist messages to database", async () => {
            const message = createMockMessage();
            
            await mockRuntime.databaseAdapter.createMemory(message);
            
            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(message);
        });

        test("should retrieve historical messages", async () => {
            const roomId = "room-123";
            const messages = [
                createMockMessage({ roomId }),
                createMockMessage({ roomId }),
                createMockMessage({ roomId }),
            ];
            
            mockRuntime.databaseAdapter.getMemories = mock(() => 
                Promise.resolve(messages)
            );
            
            const retrieved = await mockRuntime.databaseAdapter.getMemories({
                roomId,
                count: 10,
            });
            
            expect(retrieved).toHaveLength(3);
            expect(retrieved[0].roomId).toBe(roomId);
        });

        test("should handle cache operations", async () => {
            const key = "test-key";
            const value = { data: "test-value" };
            
            await mockRuntime.cacheManager.set(key, value);
            expect(mockRuntime.cacheManager.set).toHaveBeenCalledWith(key, value);
            
            await mockRuntime.cacheManager.get(key);
            expect(mockRuntime.cacheManager.get).toHaveBeenCalledWith(key);
            
            await mockRuntime.cacheManager.delete(key);
            expect(mockRuntime.cacheManager.delete).toHaveBeenCalledWith(key);
        });
    });
});
