import { createClient } from '@supabase/supabase-js';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

export class IntegrationManager {
  private supabaseClient: any;
  private socketServer: SocketIOServer;
  
  constructor(socketServer: SocketIOServer) {
    this.socketServer = socketServer;
    this.initializeSupabase();
    this.setupEventHandlers();
  }
  
  private initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      logger.info('Supabase client initialized');
      this.subscribeToRealtimeEvents();
    } else {
      logger.warn('Supabase credentials not found, edge functions disabled');
    }
  }
  
  private subscribeToRealtimeEvents() {
    if (!this.supabaseClient) return;
    
    // Subscribe to raid events
    this.supabaseClient
      .channel('raid-events')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'raids' },
        (payload: any) => {
          logger.info('Raid event received', payload);
          this.socketServer.emit('raid:update', payload);
        }
      )
      .subscribe();
    
    // Subscribe to user events
    this.supabaseClient
      .channel('user-events')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload: any) => {
          logger.info('User event received', payload);
          this.socketServer.emit('user:update', payload);
        }
      )
      .subscribe();
  }
  
  private setupEventHandlers() {
    this.socketServer.on('connection', (socket) => {
      logger.info('Socket connected', { socketId: socket.id });
      
      // Handle agent messages
      socket.on('agent:message', async (data) => {
        if (this.supabaseClient) {
          // Call Supabase edge function for processing
          const { data: result, error } = await this.supabaseClient
            .functions
            .invoke('personality-evolution', {
              body: { message: data.message, userId: data.userId }
            });
          
          if (error) {
            logger.error('Edge function error', error);
          } else {
            socket.emit('agent:response', result);
          }
        }
      });
      
      // Handle raid coordination
      socket.on('raid:action', async (data) => {
        if (this.supabaseClient) {
          const { data: result, error } = await this.supabaseClient
            .functions
            .invoke('raid-coordinator', {
              body: data
            });
          
          if (error) {
            logger.error('Raid coordinator error', error);
          } else {
            this.socketServer.to('raids').emit('raid:update', result);
          }
        }
      });
      
      // Handle analytics
      socket.on('analytics:track', async (data) => {
        if (this.supabaseClient) {
          await this.supabaseClient
            .functions
            .invoke('analytics-engine', {
              body: data
            });
        }
      });
    });
  }
  
  async callEdgeFunction(functionName: string, payload: any) {
    if (!this.supabaseClient) {
      logger.warn('Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.supabaseClient
        .functions
        .invoke(functionName, { body: payload });
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Edge function ${functionName} failed`, error);
      return null;
    }
  }
}
