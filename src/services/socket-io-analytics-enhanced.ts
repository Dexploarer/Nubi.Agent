import { Service, IAgentRuntime, Memory, logger, UUID } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";

/**
 * Enhanced Socket.IO Events Service with ClickHouse Analytics
 */

interface SocketEventData {
  agentId: UUID;
  roomId?: UUID;
  userId?: UUID;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

interface ClickHouseSocketEvent {
  timestamp: string;
  socket_id: string;
  connection_id: string;
  event_type: string;
  event_name: string;
  room_id?: string;
  namespace?: string;
  client_ip?: string;
  user_agent?: string;
  transport?: string;
  latency_ms?: number;
  payload_size_bytes?: number;
  connected_clients?: number;
  rooms_joined?: string[];
  session_id?: string;
  user_id?: string;
  agent_id?: string;
  metadata?: string;
}

class ClickHouseSocketAnalytics {
  private host: string;
  private auth: string;
  private queue: ClickHouseSocketEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.host = process.env.CLICKHOUSE_HOST || '';
    const user = process.env.CLICKHOUSE_USER || 'default';
    const pass = process.env.CLICKHOUSE_PASSWORD || '';
    this.auth = Buffer.from(`${user}:${pass}`).toString('base64');
    
    if (this.host) {
      this.flushTimer = setInterval(() => this.flush(), 3000);
    }
  }

  async track(event: Partial<ClickHouseSocketEvent>) {
    if (!this.host) return;
    
    const fullEvent: ClickHouseSocketEvent = {
      timestamp: new Date().toISOString(),
      socket_id: '',
      connection_id: uuidv4(),
      event_type: 'custom',
      event_name: 'unknown',
      ...event
    };
    
    this.queue.push(fullEvent);
    
    if (this.queue.length >= 100) {
      await this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0 || !this.host) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      const body = events.map(e => JSON.stringify({
        ...e,
        rooms_joined: e.rooms_joined || [],
        metadata: typeof e.metadata === 'string' ? e.metadata : JSON.stringify(e.metadata || {})
      })).join('\n');
      
      const query = 'INSERT INTO elizaos_analytics.socket_events FORMAT JSONEachRow';
      
      const response = await fetch(
        `${this.host}/?database=elizaos_analytics&query=${encodeURIComponent(query)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/x-ndjson'
          },
          body: body
        }
      );
      
      if (!response.ok) {
        logger.error('ClickHouse Socket insert failed:', String(response.status));
        this.queue.unshift(...events);
      }
    } catch (error) {
      logger.error('ClickHouse Socket error:', error);
      this.queue.unshift(...events);
    }
  }

  async close() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

export class SocketIOAnalyticsService extends Service {
    private io: any = null;
  static serviceType = "socket_analytics" as const;
  capabilityDescription = "Socket.IO with ClickHouse Analytics";

  private socketServer: any = null;
  private analytics: ClickHouseSocketAnalytics;
  private eventQueue: Array<{ event: string; data: SocketEventData }> = [];
  private subscribers: Map<string, Set<string>> = new Map();
  private connectionStats: Map<string, any> = new Map();

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.analytics = new ClickHouseSocketAnalytics();
  }

  static async start(runtime: IAgentRuntime): Promise<SocketIOAnalyticsService> {
    const service = new SocketIOAnalyticsService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    try {
      this.socketServer = this.detectSocketServer();

      if (!this.socketServer) {
        logger.warn("[SOCKET_ANALYTICS] Socket.IO server not available");
        return;
      }

      this.setupSocketAnalytics();
      logger.info("[SOCKET_ANALYTICS] Socket.IO Analytics initialized");
    } catch (error) {
      logger.error("[SOCKET_ANALYTICS] Initialization failed:", error);
    }
  }

  private detectSocketServer(): any {
    // Try to get Socket.IO from runtime or global
    const runtime = this.runtime as any;
    return runtime.socketServer || (global as any).io || null;
  }

  private setupSocketAnalytics(): void {
    if (!this.socketServer) return;

    const io = this.socketServer;

    // Track new connections
    io.on('connection', async (socket: any) => {
      const connectionId = uuidv4();
      const startTime = Date.now();
      
      this.connectionStats.set(socket.id, {
        connectionId,
        connectTime: startTime,
        rooms: new Set(['default']),
        userId: null
      });

      // Track connection event
      await this.analytics.track({
        event_type: 'connect',
        event_name: 'socket_connected',
        socket_id: socket.id,
        connection_id: connectionId,
        transport: socket.conn?.transport?.name || 'unknown',
        client_ip: socket.handshake?.address || '',
        user_agent: socket.handshake?.headers?.['user-agent'] || '',
        connected_clients: io.engine?.clientsCount || 0,
        namespace: socket.nsp?.name || '/',
        metadata: JSON.stringify({
          query: socket.handshake?.query,
          auth: socket.handshake?.auth ? 'authenticated' : 'anonymous'
        })
      });

      // Track custom events
      socket.onAny(async (eventName: string, ...args: any[]) => {
        const payload = JSON.stringify(args);
        const latency = Date.now() - startTime;
        
        await this.analytics.track({
          event_type: 'custom',
          event_name: eventName,
          socket_id: socket.id,
          connection_id: connectionId,
          latency_ms: latency,
          payload_size_bytes: new TextEncoder().encode(payload).length,
          rooms_joined: Array.from(this.connectionStats.get(socket.id)?.rooms || []),
          connected_clients: io.engine?.clientsCount || 0,
          agent_id: this.runtime.agentId,
          metadata: JSON.stringify({
            eventArgs: args.slice(0, 3), // First 3 args only
            timestamp: Date.now()
          })
        });
      });

      // Track room joins
      socket.on('join', async (room: string) => {
        const stats = this.connectionStats.get(socket.id);
        if (stats) {
          stats.rooms.add(room);
        }
        
        await this.analytics.track({
          event_type: 'room',
          event_name: 'room_joined',
          socket_id: socket.id,
          connection_id: connectionId,
          room_id: room,
          rooms_joined: Array.from(stats?.rooms || []),
          connected_clients: io.engine?.clientsCount || 0
        });
      });

      // Track room leaves
      socket.on('leave', async (room: string) => {
        const stats = this.connectionStats.get(socket.id);
        if (stats) {
          stats.rooms.delete(room);
        }
        
        await this.analytics.track({
          event_type: 'room',
          event_name: 'room_left',
          socket_id: socket.id,
          connection_id: connectionId,
          room_id: room,
          rooms_joined: Array.from(stats?.rooms || []),
          connected_clients: io.engine?.clientsCount || 0
        });
      });

      // Track disconnections
      socket.on('disconnect', async (reason: string) => {
        const stats = this.connectionStats.get(socket.id);
        const sessionDuration = stats ? Date.now() - stats.connectTime : 0;
        
        await this.analytics.track({
          event_type: 'disconnect',
          event_name: 'socket_disconnected',
          socket_id: socket.id,
          connection_id: connectionId,
          connected_clients: (io.engine?.clientsCount || 1) - 1,
          metadata: JSON.stringify({
            reason,
            sessionDurationMs: sessionDuration,
            roomsJoined: Array.from(stats?.rooms || [])
          })
        });
        
        this.connectionStats.delete(socket.id);
      });

      // Track errors
      socket.on('error', async (error: any) => {
        await this.analytics.track({
          event_type: 'error',
          event_name: 'socket_error',
          socket_id: socket.id,
          connection_id: connectionId,
          metadata: JSON.stringify({
            error: error.message || error,
            stack: error.stack
          })
        });
      });
    });

    // Periodic stats collection
    setInterval(async () => {
      const io = this.socketServer;
      if (!io) return;
      
      await this.analytics.track({
        event_type: 'stats',
        event_name: 'server_stats',
        socket_id: 'server',
        connection_id: 'server',
        connected_clients: io.engine?.clientsCount || 0,
        metadata: JSON.stringify({
          totalConnections: this.connectionStats.size,
          namespaces: Object.keys(io.nsps || {}),
          timestamp: Date.now()
        })
      });
    }, 30000); // Every 30 seconds
  }

  // Emit events with analytics
  async emit(event: string, data: SocketEventData): Promise<void> {
    if (!this.socketServer) {
      this.eventQueue.push({ event, data });
      return;
    }

    const roomId = data.roomId?.toString();
    const payload = JSON.stringify(data);
    
    // Track emission
    await this.analytics.track({
      event_type: 'emit',
      event_name: event,
      socket_id: 'server',
      connection_id: 'server',
      room_id: roomId,
      agent_id: data.agentId?.toString(),
      user_id: data.userId?.toString(),
      payload_size_bytes: new TextEncoder().encode(payload).length,
      metadata: JSON.stringify({
        broadcast: !roomId,
        timestamp: data.timestamp
      })
    });

    if (roomId) {
      this.socketServer.to(roomId).emit(event, data);
    } else {
      this.socketServer.emit(event, data);
    }
  }

  async cleanup(): Promise<void> {
    await this.analytics.close();
  }

    async stop(): Promise<void> {
        if (this.io) {
            await new Promise<void>((resolve) => {
                this.io?.close(() => {
                    logger.info("[SocketIOAnalytics] Server stopped");
                    resolve();
                });
            });
            this.io = null;
        }
    }
}

export default SocketIOAnalyticsService;
