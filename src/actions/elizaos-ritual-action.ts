/**
 * ElizaOS Ritual Actions
 * Community ritual mechanics for the Nubi plugin
 */

import {
    Action,
    ActionResult,
    IAgentRuntime,
    Memory,
    State,
    Content,
    HandlerCallback,
    Validator,
    logger
} from '@elizaos/core';

// Helper function to create Content object
function createContent(text: string, action?: string): Content {
    return {
        text,
        action: action || null
    };
}

/**
 * Ritual Action - Primary community ritual mechanic
 */
export const ritualAction: Action = {
    name: 'NUBI_RITUAL',
    description: 'Initiate or participate in a community ritual',
    similes: [
        'ritual',
        'start ritual',
        'begin ritual',
        'nubi ritual',
        'perform ritual',
        'initiate ritual',
        'join ritual',
        'ritual time',
        '@nubi ritual'
    ],
    
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return ritualAction.similes.some(simile => text.includes(simile));
    },
    
    examples: [
        [
            {
                name: 'User',
                content: createContent('Start a greeting ritual')
            },
            {
                name: 'Nubi',
                content: createContent('I have initiated the greeting ritual. The community can now participate.')
            }
        ],
        [
            {
                name: 'User',
                content: createContent('@nubi ritual welcome new members')
            },
            {
                name: 'Nubi',
                content: createContent('Welcome ritual started! Let us embrace our new community members.')
            }
        ]
    ],
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options?: any,
        callback?: HandlerCallback
    ): Promise<ActionResult> => {
        try {
            // Extract ritual type from message
            const messageText = message.content?.text || '';
            const ritualType = extractRitualType(messageText);
            
            // Compose ritual prompt
            const ritualPrompt = `
You are Nubi, the mystical guardian of the community. A ritual has been requested.

Ritual Type: ${ritualType}
Participant: ${state.senderName || 'Community Member'}
Context: ${state.recentMessages || 'No recent context'}

Respond as Nubi would, acknowledging the ritual and guiding the community through it.
Keep the response mystical yet engaging. Include:
1. Recognition of the ritual type
2. Instructions or guidance for participants
3. The spiritual or community significance
4. An inspiring conclusion

Response:`;

            // Generate ritual response
            const result = await runtime.completion({
                context: ritualPrompt,
                modelClass: state.modelClass
            });
            
            if (callback) {
                const content = createContent(result.text, 'NUBI_RITUAL');
                await callback(content);
            }
            
            // Store ritual in memory
            const ritualMemory: Memory = {
                ...message,
                content: createContent(`Ritual performed: ${ritualType} - ${result.text}`),
                roomId: message.roomId,
                agentId: runtime.agentId,
                createdAt: Date.now()
            };
            
            await runtime.memoryManager.createMemory(ritualMemory);
            
            // Log ritual performance
            logger.info(`Ritual performed: ${ritualType}`, {
                participant: state.senderName,
                roomId: message.roomId
            });
            
            // Return success result
            return {
                success: true,
                metadata: {
                    ritualType,
                    participant: state.senderName,
                    timestamp: Date.now()
                }
            };
            
        } catch (error) {
            logger.error('Ritual action failed:', error);
            
            const errorResult = createContent(
                "The ritual energies are disturbed. Please try again when the cosmic alignment is favorable."
            );
            
            if (callback) {
                await callback(errorResult);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Record Action - Store important community moments
 */
export const recordAction: Action = {
    name: 'RECORD_MOMENT',
    description: 'Record an important community moment or achievement',
    similes: [
        'record this',
        'save this moment',
        'remember this',
        'chronicle this',
        'document this',
        'archive this'
    ],
    
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return recordAction.similes.some(simile => text.includes(simile));
    },
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options?: any,
        callback?: HandlerCallback
    ): Promise<ActionResult> => {
        try {
            const momentDescription = message.content?.text || 'A significant moment';
            
            // Create a chronicle entry
            const chronicleEntry = {
                timestamp: Date.now(),
                author: state.senderName || 'Unknown',
                description: momentDescription,
                roomId: message.roomId,
                type: 'community_moment'
            };
            
            // Store in memory
            const chronicleMemory: Memory = {
                ...message,
                content: createContent(JSON.stringify(chronicleEntry)),
                roomId: message.roomId,
                agentId: runtime.agentId,
                createdAt: Date.now()
            };
            
            await runtime.memoryManager.createMemory(chronicleMemory);
            
            const responseText = `📜 This moment has been recorded in the eternal chronicles of our community. Future generations will remember: "${momentDescription}"`;
            
            if (callback) {
                await callback(createContent(responseText));
            }
            
            return {
                success: true,
                metadata: chronicleEntry
            };
            
        } catch (error) {
            logger.error('Record action failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Helper function to extract ritual type from message
 */
function extractRitualType(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Check for specific ritual types
    if (lowerText.includes('welcome')) return 'Welcome Ritual';
    if (lowerText.includes('greeting')) return 'Greeting Ritual';
    if (lowerText.includes('blessing')) return 'Blessing Ritual';
    if (lowerText.includes('celebration')) return 'Celebration Ritual';
    if (lowerText.includes('mourning')) return 'Mourning Ritual';
    if (lowerText.includes('initiation')) return 'Initiation Ritual';
    if (lowerText.includes('harvest')) return 'Harvest Ritual';
    if (lowerText.includes('moon')) return 'Moon Ritual';
    if (lowerText.includes('sun')) return 'Sun Ritual';
    if (lowerText.includes('star')) return 'Star Ritual';
    
    // Default ritual type
    return 'Sacred Community Ritual';
}

/**
 * Export all ritual actions
 */
export const ritualActions: Action[] = [
    ritualAction,
    recordAction
];

/**
 * Ritual participant tracking
 */
export interface RitualParticipant {
    userId: string;
    name: string;
    joinedAt: number;
    contribution?: string;
}

/**
 * Active ritual state
 */
export interface ActiveRitual {
    id: string;
    type: string;
    initiator: string;
    participants: RitualParticipant[];
    startedAt: number;
    phase: 'gathering' | 'active' | 'closing' | 'complete';
}

/**
 * Get active ritual for a room
 */
export async function getActiveRitual(
    runtime: IAgentRuntime,
    roomId: string
): Promise<ActiveRitual | null> {
    try {
        // Query for active ritual in cache
        const cacheKey = `ritual:active:${roomId}`;
        const cached = await runtime.cacheManager.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        // Query memories for recent ritual
        const memories = await runtime.memoryManager.getMemories({
            roomId,
            count: 50
        });
        
        // Find most recent ritual initiation
        for (const memory of memories) {
            const text = memory.content?.text || '';
            if (text.includes('Ritual performed:') && 
                memory.createdAt > Date.now() - 3600000) { // Within last hour
                
                // Extract ritual data
                const ritual: ActiveRitual = {
                    id: `ritual-${memory.id}`,
                    type: extractRitualType(text),
                    initiator: memory.userId || 'unknown',
                    participants: [],
                    startedAt: memory.createdAt,
                    phase: 'active'
                };
                
                // Cache the ritual
                await runtime.cacheManager.set(
                    cacheKey,
                    JSON.stringify(ritual),
                    { ttl: 3600 } // 1 hour TTL
                );
                
                return ritual;
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Failed to get active ritual:', error);
        return null;
    }
}
