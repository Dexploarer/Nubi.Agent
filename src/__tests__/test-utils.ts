/**
 * Test utilities for ElizaOS plugin testing
 * Following the patterns from https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test";
import {
    IAgentRuntime,
    Memory,
    State,
    UUID,
    Content,
    ServiceType,
    ModelClass,
    Character,
    Plugin,
    Action,
    Provider,
    Evaluator,
    IMemoryManager,
    IDatabaseAdapter,
    CacheManager,
    ITextGenerationService,
    ISpeechService,
    IVideoService,
    IBrowserService,
    IPdfService,
    IImageDescriptionService,
    ITranscriptionService,
    IAwsS3Service,
    Relationship,
    Goal,
    GenerationOptions,
    ModelProviderName,
    EmbeddingOptions,
    Room,
    SimilaritySearchOptions,
    RoomType,
} from "@elizaos/core";

/**
 * Mock Runtime implementation for testing
 */
export class MockRuntime implements Partial<IAgentRuntime> {
    agentId: UUID = "00000000-0000-0000-0000-000000000000";
    character: Character = {
        name: "TestAgent",
        id: "test-agent",
        modelProvider: ModelProviderName.OPENAI,
        plugins: [],
        clients: [],
        settings: {
            model: "gpt-4",
            voice: {
                model: "en-US-Standard-A"
            }
        },
        system: "You are a test agent",
        bio: ["Test agent bio"],
        lore: ["Test agent lore"],
        messageExamples: [],
        postExamples: [],
        topics: ["testing"],
        adjectives: ["helpful", "test-oriented"],
        knowledge: [],
        style: {
            all: ["professional", "clear"],
            chat: ["friendly"],
            post: ["informative"]
        }
    };
    
    databaseAdapter: IDatabaseAdapter = {
        init: mock(() => Promise.resolve()),
        close: mock(() => Promise.resolve()),
        getMemoriesByRoomIds: mock(() => Promise.resolve([])),
        getMemory: mock(() => Promise.resolve(null)),
        createMemory: mock(() => Promise.resolve()),
        removeMemory: mock(() => Promise.resolve()),
        removeAllMemories: mock(() => Promise.resolve()),
        countMemories: mock(() => Promise.resolve(0)),
        getMemories: mock(() => Promise.resolve([])),
        getCachedEmbeddings: mock(() => Promise.resolve([])),
        log: mock(() => Promise.resolve()),
        getActorDetails: mock(() => Promise.resolve([])),
        searchMemories: mock(() => Promise.resolve([])),
        updateGoalStatus: mock(() => Promise.resolve()),
        createGoal: mock(() => Promise.resolve()),
        removeGoal: mock(() => Promise.resolve()),
        getGoals: mock(() => Promise.resolve([])),
        updateGoal: mock(() => Promise.resolve()),
        createRoom: mock(() => Promise.resolve("test-room-id" as UUID)),
        removeRoom: mock(() => Promise.resolve()),
        listRooms: mock(() => Promise.resolve([])),
        getRoom: mock(() => Promise.resolve(null)),
        createRelationship: mock(() => Promise.resolve(true)),
        getRelationship: mock(() => Promise.resolve(null)),
        getRelationships: mock(() => Promise.resolve([])),
        getParticipantUserState: mock(() => Promise.resolve(null)),
        setParticipantUserState: mock(() => Promise.resolve()),
        getCache: mock(() => Promise.resolve(null)),
        setCache: mock(() => Promise.resolve()),
        deleteCache: mock(() => Promise.resolve()),
    };
    
    memoryManager: IMemoryManager = {
        runtime: this as any,
        addEmbeddingToMemory: mock(() => Promise.resolve()),
        getMemoriesByRoomIds: mock(() => Promise.resolve([])),
        getMemoryById: mock(() => Promise.resolve(null)),
        createMemory: mock(() => Promise.resolve()),
        removeMemory: mock(() => Promise.resolve()),
        removeAllMemories: mock(() => Promise.resolve()),
        countMemories: mock(() => Promise.resolve(0)),
        getMemories: mock(() => Promise.resolve([])),
        getCachedEmbeddings: mock(() => Promise.resolve([])),
        searchMemoriesByEmbedding: mock(() => Promise.resolve([])),
    };
    
    cacheManager: CacheManager = {
        get: mock(() => Promise.resolve(null)),
        set: mock(() => Promise.resolve()),
        delete: mock(() => Promise.resolve()),
    };
    
    services: Map<ServiceType, any> = new Map();
    actions: Action[] = [];
    providers: Provider[] = [];
    evaluators: Evaluator[] = [];
    plugins: Plugin[] = [];
    
    messageManager = {
        createMemory: mock(() => Promise.resolve()),
        getMemories: mock(() => Promise.resolve([])),
        countMemories: mock(() => Promise.resolve(0)),
    };
    
    descriptionManager = {
        getDescription: mock(() => Promise.resolve("Test description")),
    };
    
    documentsManager = {
        createMemory: mock(() => Promise.resolve()),
        getMemories: mock(() => Promise.resolve([])),
    };
    
    knowledgeManager = {
        searchMemoriesByEmbedding: mock(() => Promise.resolve([])),
    };
    
    loreManager = {
        searchMemoriesByEmbedding: mock(() => Promise.resolve([])),
    };
    
    // Service methods
    getSetting = mock((key: string) => this.character.settings?.[key]);
    getService = mock(<T = any>(service: ServiceType): T | null => {
        return this.services.get(service) as T;
    });
    registerService = mock((service: ServiceType, instance: any) => {
        this.services.set(service, instance);
    });
    
    processActions = mock(() => Promise.resolve());
    evaluate = mock(() => Promise.resolve([]));
    
    updateRecentMessageState = mock(async (_state: State): Promise<State> => ({
        agentId: this.agentId,
        roomId: "test-room" as UUID,
        userId: "test-user" as UUID,
        bio: this.character.bio.join("\n"),
        lore: this.character.lore.join("\n"),
        senderName: "TestUser",
        actors: "",
        actorsData: [],
        recentMessages: "",
        recentMessagesData: [],
        goals: "",
        goalsData: [],
        actions: "",
        actionNames: [],
        evaluators: [],
        providers: [],
    }));
    
    composeState = mock(async (_message: Memory, _additionalContext?: any): Promise<State> => ({
        agentId: this.agentId,
        roomId: "test-room" as UUID,
        userId: "test-user" as UUID,
        bio: this.character.bio.join("\n"),
        lore: this.character.lore.join("\n"),
        senderName: "TestUser",
        actors: "",
        actorsData: [],
        recentMessages: "",
        recentMessagesData: [],
        goals: "",
        goalsData: [],
        actions: "",
        actionNames: [],
        evaluators: [],
        providers: [],
    }));
    
    completion = mock(async (_options: GenerationOptions): Promise<Content> => ({
        text: "Test completion response",
        action: null,
    }));
    
    embed = mock(async (_text: string): Promise<number[]> => 
        new Array(1536).fill(0).map(() => Math.random())
    );
    
    getEmbeddingProvider = mock(() => null);
    getWalletProvider = mock(() => null);
}

/**
 * Mock Message/Memory factory
 */
export function createMockMessage(overrides?: Partial<Memory>): Memory {
    return {
        id: "msg-" + Math.random().toString(36).substr(2, 9) as UUID,
        userId: "user-test" as UUID,
        agentId: "agent-test" as UUID,
        roomId: "room-test" as UUID,
        content: { text: "Test message", action: null },
        createdAt: Date.now(),
        embedding: new Array(1536).fill(0).map(() => Math.random()),
        ...overrides,
    };
}

/**
 * Mock State factory
 */
export function createMockState(overrides?: Partial<State>): State {
    return {
        agentId: "agent-test" as UUID,
        roomId: "room-test" as UUID,
        userId: "user-test" as UUID,
        bio: "Test agent bio",
        lore: "Test agent lore",
        senderName: "TestUser",
        actors: "",
        actorsData: [],
        recentMessages: "",
        recentMessagesData: [],
        goals: "",
        goalsData: [],
        actions: "",
        actionNames: [],
        evaluators: [],
        providers: [],
        ...overrides,
    };
}

/**
 * Mock Room factory
 */
export function createMockRoom(overrides?: Partial<Room>): Room {
    return {
        id: "room-test" as UUID,
        type: RoomType.DIRECT,
        participants: ["user-test" as UUID, "agent-test" as UUID],
        createdAt: Date.now(),
        ...overrides,
    };
}

/**
 * Standard test setup helper
 */
export function setupActionTest() {
    const mockRuntime = new MockRuntime();
    const mockMessage = createMockMessage();
    const mockState = createMockState();
    const callbackFn = mock(() => Promise.resolve());
    
    return {
        mockRuntime,
        mockMessage,
        mockState,
        callbackFn,
    };
}

/**
 * Setup provider test
 */
export function setupProviderTest() {
    const mockRuntime = new MockRuntime();
    const mockMessage = createMockMessage();
    
    return {
        mockRuntime,
        mockMessage,
    };
}

/**
 * Setup evaluator test
 */
export function setupEvaluatorTest() {
    const mockRuntime = new MockRuntime();
    const mockMessage = createMockMessage();
    const mockState = createMockState();
    
    return {
        mockRuntime,
        mockMessage,
        mockState,
    };
}

/**
 * Setup service test
 */
export function setupServiceTest() {
    const mockRuntime = new MockRuntime();
    
    return {
        mockRuntime,
    };
}

/**
 * Helper to mock external API calls
 */
export function mockExternalApi(url: string, response: any) {
    return spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => response,
        text: async () => JSON.stringify(response),
        status: 200,
        headers: new Headers(),
    } as Response);
}

/**
 * Helper to test async operations
 */
export async function testAsyncOperation<T>(
    operation: () => Promise<T>,
    expectedResult: T,
    timeout = 5000
) {
    const promise = operation();
    const result = await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeout)
        ),
    ]);
    expect(result).toEqual(expectedResult);
    return result;
}

/**
 * Helper to test error handling
 */
export async function testErrorHandling(
    operation: () => Promise<any>,
    expectedError: string | RegExp
) {
    try {
        await operation();
        throw new Error('Expected operation to throw');
    } catch (error: any) {
        if (typeof expectedError === 'string') {
            expect(error.message).toContain(expectedError);
        } else {
            expect(error.message).toMatch(expectedError);
        }
    }
}

/**
 * Helper to verify state changes
 */
export function verifyStateChange(
    beforeState: any,
    afterState: any,
    expectedChanges: Record<string, any>
) {
    for (const [key, value] of Object.entries(expectedChanges)) {
        expect(afterState[key]).toEqual(value);
        if (beforeState[key] !== undefined) {
            expect(afterState[key]).not.toEqual(beforeState[key]);
        }
    }
}

// Re-export Bun test utilities for convenience
export { describe, expect, test, beforeEach, afterEach, mock, spyOn, MockRuntime };
