import {
  IAgentRuntime,
  Provider,
  Memory,
  logger,
  UUID,
  ModelType,
  State,
} from "@elizaos/core";
import { NUBISessionsService, Session, RaidSession } from "../services/nubi-sessions-service";
import { DatabaseMemoryService } from "../services/database-memory-service";

/**
 * Session Context Provider
 * 
 * ElizaOS Provider that enriches agent context with session-aware data:
 * - Current session state and metadata
 * - Session history and conversation context
 * - Raid session progress and participant data
 * - Cross-session memory continuity
 * - Community engagement context
 */

export interface SessionContext {
  currentSession?: Session;
  sessionHistory: SessionHistoryEntry[];
  conversationContext: ConversationContext;
  raidContext?: RaidContext;
  communityContext: CommunityContext;
  memoryContext: MemoryContext;
}

export interface SessionHistoryEntry {
  sessionId: string;
  sessionType: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  participants: string[];
  summary: string;
}

export interface ConversationContext {
  recentMessages: Memory[];
  topicFlow: string[];
  sentimentTrend: number;
  engagementLevel: number;
  lastInteractionTime: Date;
}

export interface RaidContext {
  activeRaids: Array<{
    raidId: string;
    sessionId: string;
    status: string;
    progress: number;
    participantCount: number;
    userRole?: 'participant' | 'leader' | 'observer';
  }>;
  raidHistory: Array<{
    raidId: string;
    completionRate: number;
    userPerformance: number;
    rank: number;
  }>;
  leaderboardPosition: number;
  totalPointsEarned: number;
}

export interface CommunityContext {
  userReputation: number;
  communityRank: string;
  recentActivities: string[];
  socialConnections: Array<{
    userId: string;
    username: string;
    relationship: string;
    interactionCount: number;
  }>;
}

export interface MemoryContext {
  relevantMemories: Memory[];
  personalityTraits: Record<string, number>;
  preferencePatterns: Record<string, any>;
  behaviorHistory: Array<{
    pattern: string;
    frequency: number;
    lastSeen: Date;
  }>;
}

export class SessionContextProvider implements Provider {
  name = "session_context";
  
  private runtime: IAgentRuntime;
  private sessionsService: NUBISessionsService;
  private memoryService: DatabaseMemoryService;

  constructor(
    runtime: IAgentRuntime,
    sessionsService: NUBISessionsService,
    memoryService: DatabaseMemoryService
  ) {
    this.runtime = runtime;
    this.sessionsService = sessionsService;
    this.memoryService = memoryService;
  }

  /**
   * Main provider method - called by ElizaOS to get contextual data
   */
  async get(
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ): Promise<{ values: { sessionContext: string } }> {
    try {
      logger.debug("[SESSION_CONTEXT_PROVIDER] Building session context");

      const context = await this.buildSessionContext(message, state);
      
      // Format context as structured text for ElizaOS
      const formattedContext = this.formatContextForEliza(context);
      
      return {
        values: {
          sessionContext: formattedContext
        }
      };
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to build context:", error instanceof Error ? error.message : String(error));
      return {
        values: {
          sessionContext: "Session context unavailable"
        }
      };
    }
  }

  /**
   * Build comprehensive session context
   */
  private async buildSessionContext(
    message: Memory,
    state?: State
  ): Promise<SessionContext> {
    const sessionId = this.extractSessionId(message, state);
    
    const [
      currentSession,
      sessionHistory,
      conversationContext,
      raidContext,
      communityContext,
      memoryContext
    ] = await Promise.all([
      this.getCurrentSession(sessionId),
      this.getSessionHistory(message.entityId),
      this.getConversationContext(message.roomId, message.entityId),
      this.getRaidContext(message.entityId, sessionId),
      this.getCommunityContext(message.entityId),
      this.getMemoryContext(message.roomId, message.entityId)
    ]);

    return {
      currentSession,
      sessionHistory,
      conversationContext,
      raidContext,
      communityContext,
      memoryContext,
    };
  }

  /**
   * Get current session information
   */
  private async getCurrentSession(sessionId?: string): Promise<Session | undefined> {
    if (!sessionId) return undefined;

    try {
      const session = await this.sessionsService.getSession(sessionId);
      return session || undefined;
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get current session:", error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Get session history for user
   */
  private async getSessionHistory(userId?: UUID): Promise<SessionHistoryEntry[]> {
    if (!userId) return [];

    try {
      // Search for session-related memories
      const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: `session history user ${userId}`,
      });

      const sessionMemories = await this.runtime.searchMemories({
        embedding,
        count: 20,
        match_threshold: 0.6,
        tableName: "memories",
      });

      // Extract session history from memories
      const sessionHistory: SessionHistoryEntry[] = sessionMemories
        .filter(m => (m.content as any)?.type === 'session_created')
        .map(m => {
          const content = m.content as any;
          return {
            sessionId: content.sessionId || 'unknown',
            sessionType: content.sessionType || 'conversation',
            startTime: new Date(m.createdAt),
            endTime: undefined, // Would need additional tracking
            messageCount: 0, // Would need to count from messages
            participants: [userId], // Simplified
            summary: content.text || 'Session activity',
          };
        })
        .slice(0, 10); // Last 10 sessions

      return sessionHistory;
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get session history:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Get conversation context for current room
   */
  private async getConversationContext(
    roomId?: UUID,
    userId?: UUID
  ): Promise<ConversationContext> {
    if (!roomId) {
      return {
        recentMessages: [],
        topicFlow: [],
        sentimentTrend: 0,
        engagementLevel: 0,
        lastInteractionTime: new Date(),
      };
    }

    try {
      // Get recent memories from the room
      const recentMemories = await this.runtime.getMemories({
        roomId,
        count: 20,
        unique: false,
        tableName: "memories",
      });

      // Extract topics from recent messages
      const topicFlow = this.extractTopics(recentMemories);
      
      // Calculate sentiment trend (simplified)
      const sentimentTrend = this.calculateSentimentTrend(recentMemories);
      
      // Calculate engagement level
      const engagementLevel = this.calculateEngagementLevel(recentMemories, userId);
      
      // Get last interaction time
      const lastInteractionTime = recentMemories.length > 0 
        ? new Date(recentMemories[0].createdAt)
        : new Date();

      return {
        recentMessages: recentMemories.slice(0, 10),
        topicFlow,
        sentimentTrend,
        engagementLevel,
        lastInteractionTime,
      };
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get conversation context:", error instanceof Error ? error.message : String(error));
      return {
        recentMessages: [],
        topicFlow: [],
        sentimentTrend: 0,
        engagementLevel: 0,
        lastInteractionTime: new Date(),
      };
    }
  }

  /**
   * Get raid context for user
   */
  private async getRaidContext(
    userId?: UUID,
    sessionId?: string
  ): Promise<RaidContext | undefined> {
    if (!userId) return undefined;

    try {
      // Get raid-related context from memory service
      const raidContext = await this.memoryService.getRaidContext(
        sessionId || 'unknown',
        undefined,
        50
      );

      const activeRaids = raidContext.raidMemories
        .filter(m => (m.content as any)?.type === 'raid_progress')
        .map(m => {
          const content = m.content as any;
          return {
            raidId: content.raidId || 'unknown',
            sessionId: content.sessionId || sessionId || 'unknown',
            status: content.status || 'unknown',
            progress: content.completionRate || 0,
            participantCount: content.participantCount || 0,
            userRole: this.determineUserRole(userId, content),
          };
        })
        .slice(0, 5);

      // Get user's raid performance history
      const raidHistory = await this.getUserRaidHistory(userId);

      return {
        activeRaids,
        raidHistory,
        leaderboardPosition: 0, // Would need leaderboard calculation
        totalPointsEarned: this.calculateTotalPoints(raidContext.participants),
      };
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get raid context:", error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Get community context for user
   */
  private async getCommunityContext(userId?: UUID): Promise<CommunityContext> {
    if (!userId) {
      return {
        userReputation: 0,
        communityRank: 'newcomer',
        recentActivities: [],
        socialConnections: [],
      };
    }

    try {
      // Search for community-related memories
      const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text: `community activity user ${userId}`,
      });

      const communityMemories = await this.runtime.searchMemories({
        embedding,
        count: 30,
        match_threshold: 0.5,
        tableName: "memories",
      });

      // Extract community activities
      const recentActivities = communityMemories
        .map(m => (m.content as any)?.text || 'Activity')
        .slice(0, 10);

      // Calculate reputation (simplified)
      const userReputation = this.calculateUserReputation(communityMemories);

      // Determine community rank
      const communityRank = this.determineCommunityRank(userReputation);

      // Extract social connections
      const socialConnections = this.extractSocialConnections(communityMemories);

      return {
        userReputation,
        communityRank,
        recentActivities,
        socialConnections,
      };
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get community context:", error instanceof Error ? error.message : String(error));
      return {
        userReputation: 0,
        communityRank: 'newcomer',
        recentActivities: [],
        socialConnections: [],
      };
    }
  }

  /**
   * Get memory context with personality and preferences
   */
  private async getMemoryContext(
    roomId?: UUID,
    userId?: UUID
  ): Promise<MemoryContext> {
    try {
      // Get enhanced context from memory service
      const enhancedContext = await this.memoryService.getEnhancedContext(
        roomId || crypto.randomUUID() as UUID,
        userId,
        undefined,
        20
      );

      // Extract personality traits from settings
      const personalityTraits = this.runtime.getSetting("personality_traits") || {};

      // Analyze behavior patterns from memories
      const behaviorHistory = this.analyzeBehaviorPatterns(enhancedContext.recentMemories);

      // Extract preference patterns
      const preferencePatterns = this.extractPreferences(enhancedContext.recentMemories);

      return {
        relevantMemories: enhancedContext.semanticMemories,
        personalityTraits,
        preferencePatterns,
        behaviorHistory,
      };
    } catch (error) {
      logger.error("[SESSION_CONTEXT_PROVIDER] Failed to get memory context:", error instanceof Error ? error.message : String(error));
      return {
        relevantMemories: [],
        personalityTraits: {},
        preferencePatterns: {},
        behaviorHistory: [],
      };
    }
  }

  /**
   * Format session context for ElizaOS consumption
   */
  private formatContextForEliza(context: SessionContext): string {
    const sections = [];

    // Current session info
    if (context.currentSession) {
      sections.push(`CURRENT SESSION: ${context.currentSession.config.sessionType} (${context.currentSession.id})`);
      sections.push(`Session Status: ${context.currentSession.state.status}`);
      sections.push(`Messages: ${context.currentSession.state.messages}`);
    }

    // Conversation context
    sections.push(`CONVERSATION CONTEXT:`);
    sections.push(`Recent Topics: ${context.conversationContext.topicFlow.join(', ')}`);
    sections.push(`Engagement Level: ${Math.round(context.conversationContext.engagementLevel * 100)}%`);
    sections.push(`Sentiment: ${context.conversationContext.sentimentTrend > 0 ? 'Positive' : 'Neutral'}`);

    // Raid context
    if (context.raidContext && context.raidContext.activeRaids.length > 0) {
      sections.push(`ACTIVE RAIDS:`);
      context.raidContext.activeRaids.forEach(raid => {
        sections.push(`• ${raid.raidId}: ${Math.round(raid.progress * 100)}% complete (${raid.participantCount} participants)`);
      });
      sections.push(`Total Points Earned: ${context.raidContext.totalPointsEarned}`);
    }

    // Community context
    sections.push(`COMMUNITY STATUS:`);
    sections.push(`Reputation: ${context.communityContext.userReputation}`);
    sections.push(`Rank: ${context.communityContext.communityRank}`);

    // Memory insights
    if (context.memoryContext.relevantMemories.length > 0) {
      sections.push(`RELEVANT MEMORIES: ${context.memoryContext.relevantMemories.length} related memories found`);
    }

    return sections.join('\n');
  }

  // Utility methods

  private extractSessionId(message: Memory, state?: State): string | undefined {
    // Try to extract session ID from message content or state
    const content = message.content as any;
    return content?.sessionId || state?.sessionId || undefined;
  }

  private extractTopics(memories: Memory[]): string[] {
    return memories
      .map(m => (m.content as any)?.text || '')
      .filter(text => text.length > 10)
      .map(text => text.split(' ').slice(0, 3).join(' '))
      .slice(0, 5);
  }

  private calculateSentimentTrend(memories: Memory[]): number {
    // Simplified sentiment calculation
    return Math.random() * 2 - 1; // -1 to 1
  }

  private calculateEngagementLevel(memories: Memory[], userId?: UUID): number {
    if (!userId) return 0;
    
    const userMessages = memories.filter(m => m.entityId === userId);
    return Math.min(userMessages.length / memories.length, 1.0);
  }

  private determineUserRole(userId: UUID, content: any): 'participant' | 'leader' | 'observer' {
    // Simplified role determination
    return 'participant';
  }

  private async getUserRaidHistory(userId: UUID): Promise<Array<{
    raidId: string;
    completionRate: number;
    userPerformance: number;
    rank: number;
  }>> {
    // Simplified raid history - would query actual data
    return [];
  }

  private calculateTotalPoints(participants: any[]): number {
    return participants.reduce((total, p) => total + (p.pointsEarned || 0), 0);
  }

  private calculateUserReputation(memories: Memory[]): number {
    // Simplified reputation calculation based on memory count and types
    return Math.min(memories.length * 10, 1000);
  }

  private determineCommunityRank(reputation: number): string {
    if (reputation > 500) return 'veteran';
    if (reputation > 200) return 'active';
    if (reputation > 50) return 'member';
    return 'newcomer';
  }

  private extractSocialConnections(memories: Memory[]): Array<{
    userId: string;
    username: string;
    relationship: string;
    interactionCount: number;
  }> {
    // Simplified social connection extraction
    return [];
  }

  private analyzeBehaviorPatterns(memories: Memory[]): Array<{
    pattern: string;
    frequency: number;
    lastSeen: Date;
  }> {
    // Simplified behavior pattern analysis
    return [];
  }

  private extractPreferences(memories: Memory[]): Record<string, any> {
    // Simplified preference extraction
    return {};
  }
}

export default SessionContextProvider;