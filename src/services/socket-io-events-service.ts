import { Service, IAgentRuntime, logger, UUID, EventType } from "@elizaos/core";

/**
 * FIXED: Socket.IO Events Service using ElizaOS Event System
 * 
 * This service properly integrates with ElizaOS's event system
 * instead of trying to directly access Socket.IO
 */
export class SocketIOEventsService extends Service {
    static serviceType = "socket_events" as const;
    capabilityDescription = "Real-time events for NUBI features via ElizaOS event system";

    private eventSubscriptions: Map<string, Function> = new Map();
    
    async initialize(): Promise<void> {
        logger.info("[SOCKET_EVENTS] Initializing with ElizaOS event system...");
        
        // Register for ElizaOS events that should be broadcast
        this.registerBroadcastEvents();
        
        logger.info("[SOCKET_EVENTS] Service initialized using ElizaOS event patterns");
    }

    /**
     * FIXED: Use ElizaOS event system instead of direct Socket.IO
     */
    private registerBroadcastEvents() {
        const broadcastEvents = [
            'broadcast.raid.started',
            'broadcast.raid.participation', 
            'broadcast.raid.engagement',
            'broadcast.raid.completed',
            'broadcast.leaderboard.update',
            'broadcast.personality.evolution',
            'broadcast.emotional.state',
            'broadcast.community.update'
        ];

        for (const eventName of broadcastEvents) {
            const handler = this.createBroadcastHandler(eventName);
            (this.runtime as any).on(eventName, handler);
            this.eventSubscriptions.set(eventName, handler);
            logger.debug(`[SOCKET_EVENTS] Registered broadcast handler for: ${eventName}`);
        }
    }

    /**
     * Create a handler that broadcasts events to connected clients
     */
    private createBroadcastHandler(eventName: string) {
        return async (data: any) => {
            try {
                // Extract the actual event name (remove 'broadcast.' prefix)
                const clientEventName = eventName.replace('broadcast.', '');
                
                // Prepare event data with metadata
                const eventData: SocketEventData = {
                    agentId: this.runtime.agentId,
                    roomId: data.roomId,
                    userId: data.userId,
                    timestamp: new Date().toISOString(),
                    data: data,
                    metadata: {
                        source: 'elizaos',
                        version: '1.0.0'
                    }
                };

                // Emit to any connected Socket.IO clients via ElizaOS
                // The ElizaOS runtime will handle the actual Socket.IO broadcasting
                await (this.runtime as any).emit('socket.broadcast', {
                    event: clientEventName,
                    data: eventData
                });

                logger.debug(`[SOCKET_EVENTS] Broadcast event: ${clientEventName}`);
            } catch (error) {
                logger.error(`[SOCKET_EVENTS] Failed to broadcast ${eventName}:`, error);
            }
        };
    }

    /**
     * Emit a custom event through ElizaOS
     */
    async emitEvent(eventName: string, data: any): Promise<void> {
        try {
            const eventData: SocketEventData = {
                agentId: this.runtime.agentId,
                roomId: data.roomId,
                userId: data.userId,
                timestamp: new Date().toISOString(),
                data: data,
                metadata: {
                    source: 'nubi',
                    eventName: eventName
                }
            };

            // Use ElizaOS event system
            await (this.runtime as any).emit(`broadcast.${eventName}`, eventData);
            
            logger.debug(`[SOCKET_EVENTS] Emitted event: ${eventName}`);
        } catch (error) {
            logger.error(`[SOCKET_EVENTS] Failed to emit ${eventName}:`, error);
        }
    }

    /**
     * Emit raid-specific events
     */
    async emitRaidUpdate(raidData: any): Promise<void> {
        await this.emitEvent('raid.update', raidData);
    }

    async emitLeaderboardUpdate(leaderboardData: any): Promise<void> {
        await this.emitEvent('leaderboard.update', leaderboardData);
    }

    async emitPersonalityEvolution(personalityData: any): Promise<void> {
        await this.emitEvent('personality.evolution', personalityData);
    }

    async emitEmotionalStateChange(emotionalData: any): Promise<void> {
        await this.emitEvent('emotional.state', emotionalData);
    }

    /**
     * Handle room-specific broadcasts
     */
    async emitToRoom(roomId: string, eventName: string, data: any): Promise<void> {
        const eventData = {
            ...data,
            roomId,
            targetRoom: roomId
        };
        
        await this.emitEvent(`room.${eventName}`, eventData);
    }

    /**
     * Handle user-specific broadcasts
     */
    async emitToUser(userId: string, eventName: string, data: any): Promise<void> {
        const eventData = {
            ...data,
            userId,
            targetUser: userId
        };
        
        await this.emitEvent(`user.${eventName}`, eventData);
    }

    /**
     * Clean up on service stop
     */
    async stop(): Promise<void> {
        // Unregister all event handlers
        for (const [eventName, handler] of this.eventSubscriptions) {
            (this.runtime as any).off(eventName, handler);
        }
        this.eventSubscriptions.clear();
        
        logger.info("[SOCKET_EVENTS] Service stopped and cleaned up");
    }
}

/**
 * Socket event data structure
 */
export interface SocketEventData {
    agentId: UUID;
    roomId?: UUID | string;
    userId?: UUID | string;
    timestamp: string;
    data: any;
    metadata?: Record<string, any>;
}

/**
 * Export as default service
 */
export default SocketIOEventsService;
