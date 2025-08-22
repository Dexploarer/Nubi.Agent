import {
  IAgentRuntime,
  Service,
  ServiceType,
  Memory,
  logger,
} from "@elizaos/core";

/**
 * Message interface for unified transport handling
 */
export interface Message {
  text: string;
  userId?: string;
  roomId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Transport configuration interface
 */
export interface TransportConfig {
  apiKey?: string;
  baseUrl?: string;
  retries?: number;
  timeout?: number;
  [key: string]: unknown;
}

/**
 * Room context interface
 */
export interface RoomContext {
  lastMessage?: {
    content: Message;
    timestamp: number;
  };
  lastActivity?: number;
  messageCount?: number;
  [key: string]: unknown;
}

/**
 * Transport info interface
 */
export interface TransportInfo {
  available: boolean;
  name: string;
}

/**
 * Transport stats interface
 */
export interface TransportStats {
  transports: Record<string, TransportInfo>;
  worlds: number;
  rooms: number;
  totalParticipants: number;
}

/**
 * Transport interface for unified message handling
 */
export interface Transport {
  name: string;
  isAvailable(): boolean;
  send(message: Message, target?: string): Promise<boolean>;
  receive?(callback: (message: Message) => void): void;
  configure?(config: string | TransportConfig): void;
}

/**
 * Discord Transport Adapter
 */
export class DiscordTransport implements Transport {
  name = "discord";

  isAvailable(): boolean {
    return !!(
      process.env.DISCORD_APPLICATION_ID && process.env.DISCORD_API_TOKEN
    );
  }

  async send(message: Message, target?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Implementation would use Discord API
      logger.info(`[Discord] Sending message to ${target}: ${message.text}`);
      return true;
    } catch (error) {
      logger.error("[Discord] Send failed:", error);
      return false;
    }
  }

  configure(config: string | TransportConfig): void {
    // Configure Discord-specific settings
    logger.info(
      "[Discord] Configured with settings:",
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }
}

/**
 * Telegram Transport Adapter
 */
export class TelegramTransport implements Transport {
  name = "telegram";

  isAvailable(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  async send(message: Message, target?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Implementation would use Telegram Bot API
      logger.info(`[Telegram] Sending message to ${target}: ${message.text}`);
      return true;
    } catch (error) {
      logger.error("[Telegram] Send failed:", error);
      return false;
    }
  }

  configure(config: string | TransportConfig): void {
    logger.info(
      "[Telegram] Configured with settings:",
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }
}

/**
 * Twitter/X Transport Adapter
 */
export class TwitterTransport implements Transport {
  name = "twitter";

  isAvailable(): boolean {
    return !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET_KEY &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
  }

  async send(message: Message, target?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Implementation would use Twitter API v2
      logger.info(`[Twitter] Posting tweet: ${message.text}`);
      return true;
    } catch (error) {
      logger.error("[Twitter] Send failed:", error);
      return false;
    }
  }

  configure(config: string | TransportConfig): void {
    logger.info(
      "[Twitter] Configured with settings:",
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }
}

/**
 * HTTP/REST Transport Adapter
 */
export class HTTPTransport implements Transport {
  name = "http";

  isAvailable(): boolean {
    return true; // HTTP always available
  }

  async send(message: Message, target?: string): Promise<boolean> {
    try {
      // Implementation would send HTTP response
      logger.info(`[HTTP] Sending response: ${message.text}`);
      return true;
    } catch (error) {
      logger.error("[HTTP] Send failed:", error);
      return false;
    }
  }

  configure(config: string | TransportConfig): void {
    logger.info(
      "[HTTP] Configured with settings:",
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }
}

/**
 * World/Room Management for Multi-Context Conversations
 */
export interface World {
  id: string;
  name: string;
  description?: string;
  rooms: Map<string, Room>;
  metadata?: Record<string, unknown>;
}

export interface Room {
  id: string;
  worldId: string;
  name: string;
  transport: string;
  context: RoomContext;
  participants: Set<string>;
  metadata?: Record<string, unknown>;
}

/**
 * Unified Message Bus Service
 *
 * Implements ElizaOS's unified message bus pattern for seamless
 * multi-transport communication and composable swarm capabilities
 */
export class MessageBusService extends Service {
  static serviceType = "message-bus" as const;

  private transports: Map<string, Transport> = new Map();
  private worlds: Map<string, World> = new Map();
  private rooms: Map<string, Room> = new Map();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  get capabilityDescription(): string {
    return "Unified message bus for multi-transport communication and world/room management";
  }

  async stop(): Promise<void> {
    logger.info("🛑 Stopping Unified Message Bus...");
    // Cleanup transports and connections
    this.transports.clear();
    this.worlds.clear();
    this.rooms.clear();
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new MessageBusService(runtime);
    logger.info("✅ Message Bus Service started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("message-bus");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ Message Bus started");
    // Service is ready - no specific startup tasks needed
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info("🚌 Initializing Unified Message Bus...");

    // Register available transports
    this.registerTransport(new DiscordTransport());
    this.registerTransport(new TelegramTransport());
    this.registerTransport(new TwitterTransport());
    this.registerTransport(new HTTPTransport());

    // Create default world and rooms
    this.createDefaultWorld(runtime);

    logger.info(
      `✅ Message Bus initialized with ${this.transports.size} transports`,
    );
    logger.info(`🌍 Worlds: ${this.worlds.size}, Rooms: ${this.rooms.size}`);
  }

  /**
   * Register a transport adapter
   */
  private registerTransport(transport: Transport): void {
    if (transport.isAvailable()) {
      this.transports.set(transport.name, transport);
      logger.info(`📡 Registered transport: ${transport.name}`);
    } else {
      logger.warn(`⚠️  Transport unavailable: ${transport.name}`);
    }
  }

  /**
   * Create default world and rooms based on available transports
   */
  private createDefaultWorld(runtime: IAgentRuntime): void {
    const defaultWorld: World = {
      id: "anubis-world",
      name: "Anubis Agent World",
      description: "Main world for Anubis agent interactions",
      rooms: new Map(),
      metadata: {
        agentId: runtime.agentId,
        createdAt: Date.now(),
      },
    };

    this.worlds.set(defaultWorld.id, defaultWorld);

    // Create rooms for each available transport
    for (const [transportName, transport] of this.transports) {
      if (transport.isAvailable()) {
        const room: Room = {
          id: `${transportName}-main`,
          worldId: defaultWorld.id,
          name: `Main ${transportName.charAt(0).toUpperCase() + transportName.slice(1)} Room`,
          transport: transportName,
          context: {},
          participants: new Set(),
        };

        this.rooms.set(room.id, room);
        defaultWorld.rooms.set(room.id, room);

        logger.info(`🏠 Created room: ${room.name} (${room.id})`);
      }
    }
  }

  /**
   * Send message through unified bus
   */
  async sendMessage(
    content: Message,
    transportName: string,
    target?: string,
    roomId?: string,
  ): Promise<boolean> {
    const transport = this.transports.get(transportName);

    if (!transport) {
      logger.warn(`Transport not available: ${transportName}`);
      return false;
    }

    // Update room context if specified
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.context.lastMessage = {
          content,
          timestamp: Date.now(),
        };
      }
    }

    return await transport.send(content, target);
  }

  /**
   * Broadcast message to all available transports in parallel
   */
  async broadcastMessage(
    content: Message,
    excludeTransports: string[] = [],
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Get eligible transports
    const eligibleTransports = Array.from(this.transports.entries()).filter(
      ([transportName, transport]) =>
        !excludeTransports.includes(transportName) && transport.isAvailable(),
    );

    // Send to all transports in parallel
    const sendPromises = eligibleTransports.map(
      async ([transportName, transport]) => {
        try {
          const success = await transport.send(content);
          return { transportName, success };
        } catch (error) {
          logger.error(`Failed to send to ${transportName}:`, error);
          return { transportName, success: false };
        }
      },
    );

    const sendResults = await Promise.all(sendPromises);

    // Collect results
    sendResults.forEach(({ transportName, success }) => {
      results.set(transportName, success);
    });

    const resultsObj = Object.fromEntries(results);
    logger.info(`📢 Broadcast results:`, JSON.stringify(resultsObj));
    return results;
  }

  /**
   * Get available transports
   */
  getAvailableTransports(): string[] {
    return Array.from(this.transports.keys()).filter((name) =>
      this.transports.get(name)?.isAvailable(),
    );
  }

  /**
   * Get world information
   */
  getWorld(worldId: string): World | undefined {
    return this.worlds.get(worldId);
  }

  /**
   * Get room information
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Create new room in a world
   */
  createRoom(worldId: string, roomConfig: Partial<Room>): Room | null {
    const world = this.worlds.get(worldId);
    if (!world) {
      logger.error(`World not found: ${worldId}`);
      return null;
    }

    const room: Room = {
      id: roomConfig.id || `room-${Date.now()}`,
      worldId,
      name: roomConfig.name || `Room ${Date.now()}`,
      transport: roomConfig.transport || "http",
      context: roomConfig.context || {},
      participants: roomConfig.participants || new Set(),
      metadata: roomConfig.metadata,
    };

    this.rooms.set(room.id, room);
    world.rooms.set(room.id, room);

    logger.info(`🏠 Created new room: ${room.name} in world: ${world.name}`);
    return room;
  }

  /**
   * Handle incoming message and route to appropriate handlers
   */
  async routeMessage(message: Memory, sourceTransport: string): Promise<void> {
    // Find or create room for this message
    const userId = message.entityId || "anonymous";
    const roomId = message.roomId || `${sourceTransport}-${userId}`;

    let room = this.rooms.get(roomId);
    if (!room) {
      const createdRoom = this.createRoom("anubis-world", {
        id: roomId,
        name: `${sourceTransport} conversation`,
        transport: sourceTransport,
        context: { sourceMessage: message },
      });
      room = createdRoom || undefined;
    }

    if (room) {
      // Add participant
      room.participants.add(userId);

      // Update context
      room.context.lastActivity = Date.now();
      room.context.messageCount = (room.context.messageCount || 0) + 1;
    }

    logger.info(`📬 Routed message from ${sourceTransport} to room: ${roomId}`);
  }

  /**
   * Get transport statistics
   */
  getTransportStats(): TransportStats {
    const stats: Record<string, TransportInfo> = {};

    for (const [name, transport] of this.transports) {
      stats[name] = {
        available: transport.isAvailable(),
        name: transport.name,
      };
    }

    return {
      transports: stats,
      worlds: this.worlds.size,
      rooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce(
        (total, room) => total + room.participants.size,
        0,
      ),
    };
  }
}

export default MessageBusService;
