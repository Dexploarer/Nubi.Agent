/**
 * Raid Socket Service
 * Real-time communication layer for raids using Socket.IO
 */

import { Server as SocketServer } from 'socket.io';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IAgentRuntime } from '@elizaos/core';
import { EventEmitter } from 'events';

interface RaidUpdate {
  type: 'raid_started' | 'participant_joined' | 'points_updated' | 'raid_ended' | 'leaderboard_update';
  raidId: string;
  data: any;
  timestamp: number;
}

interface SocketClient {
  id: string;
  userId?: string;
  username?: string;
  raidId?: string;
  role: 'participant' | 'observer' | 'admin';
}

export class RaidSocketService extends EventEmitter {
  private io: SocketServer | null = null;
  private supabase: SupabaseClient;
  private runtime: IAgentRuntime;
  private connectedClients: Map<string, SocketClient> = new Map();
  private raidRooms: Map<string, Set<string>> = new Map();

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_ANON_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Subscribe to Supabase real-time changes
    this.subscribeToRaidUpdates();
  }

  /**
   * Initialize Socket.IO server
   */
  public initializeSocket(server: any) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    
    console.log('🔌 Socket.IO server initialized for raids');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Handle client registration
      socket.on('register', async (data: { userId: string; username: string; role?: string }) => {
        const client: SocketClient = {
          id: socket.id,
          userId: data.userId,
          username: data.username,
          role: (data.role as any) || 'participant'
        };
        
        this.connectedClients.set(socket.id, client);
        
        // Send initial data
        socket.emit('registered', {
          socketId: socket.id,
          activeRaids: await this.getActiveRaids()
        });
      });

      // Handle joining a raid room
      socket.on('join_raid', async (raidId: string) => {
        const client = this.connectedClients.get(socket.id);
        if (!client) return;

        // Join the raid room
        socket.join(`raid:${raidId}`);
        client.raidId = raidId;
        
        // Track room membership
        if (!this.raidRooms.has(raidId)) {
          this.raidRooms.set(raidId, new Set());
        }
        this.raidRooms.get(raidId)!.add(socket.id);

        // Store subscription in Supabase
        await this.supabase.from('raid_subscriptions').insert({
          raid_id: raidId,
          socket_id: socket.id,
          user_id: client.userId,
          subscription_type: client.role
        });

        // Send current raid state
        const raidState = await this.getRaidState(raidId);
        socket.emit('raid_state', raidState);

        // Notify others
        socket.to(`raid:${raidId}`).emit('participant_joined', {
          userId: client.userId,
          username: client.username,
          timestamp: Date.now()
        });
      });

      // Handle leaving a raid room
      socket.on('leave_raid', async (raidId: string) => {
        socket.leave(`raid:${raidId}`);
        
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.raidId = undefined;
        }

        // Remove from room tracking
        this.raidRooms.get(raidId)?.delete(socket.id);
        
        // Remove subscription
        await this.supabase
          .from('raid_subscriptions')
          .delete()
          .eq('socket_id', socket.id)
          .eq('raid_id', raidId);
      });

      // Handle real-time action updates
      socket.on('raid_action', async (data: {
        raidId: string;
        action: string;
        metadata?: any;
      }) => {
        const client = this.connectedClients.get(socket.id);
        if (!client) return;

        // Process the action
        const result: any = await this.processRaidAction(data.raidId, client.userId!, data.action, data.metadata);
        
        // Emit to raid room
        this.io?.to(`raid:${data.raidId}`).emit('action_update', {
          userId: client.userId,
          username: client.username,
          action: data.action,
          result,
          timestamp: Date.now()
        });
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        const client = this.connectedClients.get(socket.id);
        
        if (client?.raidId) {
          // Notify raid room
          socket.to(`raid:${client.raidId}`).emit('participant_left', {
            userId: client.userId,
            username: client.username,
            timestamp: Date.now()
          });
          
          // Clean up room tracking
          this.raidRooms.get(client.raidId)?.delete(socket.id);
        }

        // Remove subscriptions
        await this.supabase
          .from('raid_subscriptions')
          .delete()
          .eq('socket_id', socket.id);
        
        this.connectedClients.delete(socket.id);
        console.log(`❌ Client disconnected: ${socket.id}`);
      });

      // Handle custom events
      socket.on('request_leaderboard', async (raidId: string) => {
        const leaderboard = await this.getLeaderboard(raidId);
        socket.emit('leaderboard_update', leaderboard);
      });

      socket.on('request_stats', async (raidId: string) => {
        const stats = await this.getRaidStats(raidId);
        socket.emit('stats_update', stats);
      });
    });
  }

  /**
   * Subscribe to Supabase real-time updates
   */
  private subscribeToRaidUpdates() {
    // Subscribe to raid table changes
    this.supabase
      .channel('raid-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'raids'
      }, (payload) => {
        this.handleRaidChange(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'raid_participants'
      }, (payload) => {
        this.handleParticipantChange(payload);
      })
      .subscribe();

    // Subscribe to custom broadcasts
    this.supabase
      .channel('raid-updates')
      .on('broadcast', { event: '*' }, (payload) => {
        this.handleBroadcast(payload);
      })
      .subscribe();
  }

  /**
   * Handle raid table changes
   */
  private handleRaidChange(payload: any) {
    const { eventType, new: newRaid, old: oldRaid } = payload;
    
    switch (eventType) {
      case 'INSERT':
        this.broadcastToAll('raid_created', {
          raid: newRaid,
          timestamp: Date.now()
        });
        break;
      
      case 'UPDATE':
        if (newRaid.status !== oldRaid?.status) {
          this.broadcastToRaid(newRaid.id, 'raid_status_changed', {
            status: newRaid.status,
            raid: newRaid,
            timestamp: Date.now()
          });
        }
        break;
    }
  }

  /**
   * Handle participant table changes
   */
  private handleParticipantChange(payload: any) {
    const { eventType, new: participant } = payload;
    
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      this.broadcastToRaid(participant.raid_id, 'participant_update', {
        participant,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle custom broadcasts from Supabase
   */
  private handleBroadcast(payload: any) {
    const { event, payload: data } = payload;
    
    if (data.raidId) {
      this.broadcastToRaid(data.raidId, event, data);
    } else {
      this.broadcastToAll(event, data);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  private broadcastToAll(event: string, data: any) {
    this.io?.emit(event, data);
  }

  /**
   * Broadcast to specific raid room
   */
  private broadcastToRaid(raidId: string, event: string, data: any) {
    this.io?.to(`raid:${raidId}`).emit(event, data);
  }

  /**
   * Process a raid action and update database
   */
  private async processRaidAction(raidId: string, userId: string, action: string, metadata?: any) {
    try {
      // Call Supabase Edge Function
      const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/raid-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'update',
          raidId,
          userId,
          actionType: action,
          metadata
        })
      });

      const result: any = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error processing raid action:', error);
      return null;
    }
  }

  /**
   * Get current raid state
   */
  private async getRaidState(raidId: string) {
    const { data: raid } = await this.supabase
      .from('raids')
      .select(`
        *,
        raid_participants (
          user_id,
          username,
          points,
          actions_count,
          is_active
        )
      `)
      .eq('id', raidId)
      .single();

    return raid;
  }

  /**
   * Get active raids
   */
  private async getActiveRaids() {
    const { data: raids } = await this.supabase
      .from('raids')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    return raids || [];
  }

  /**
   * Get raid statistics
   */
  private async getRaidStats(raidId: string) {
    const { data: stats } = await this.supabase
      .rpc('calculate_raid_stats', { raid_uuid: raidId });

    return stats?.[0] || null;
  }

  /**
   * Get raid leaderboard
   */
  private async getLeaderboard(raidId?: string) {
    if (raidId) {
      const { data: participants } = await this.supabase
        .from('raid_participants')
        .select('*')
        .eq('raid_id', raidId)
        .order('points', { ascending: false })
        .limit(10);

      return participants || [];
    } else {
      const { data: leaderboard } = await this.supabase
        .from('raid_leaderboard')
        .select('*')
        .limit(10);

      return leaderboard || [];
    }
  }

  /**
   * Send notification to Telegram
   */
  public async notifyTelegram(chatId: string, message: string) {
    // This would integrate with the Telegram service
    const telegramService = this.runtime.getService('telegram');
    if (telegramService) {
      await (telegramService as any).sendMessage(chatId, message);
    }
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get raid room participants
   */
  public getRaidParticipants(raidId: string): SocketClient[] {
    const roomClients = this.raidRooms.get(raidId);
    if (!roomClients) return [];

    return Array.from(roomClients)
      .map(socketId => this.connectedClients.get(socketId))
      .filter(Boolean) as SocketClient[];
  }
}

export default RaidSocketService;
