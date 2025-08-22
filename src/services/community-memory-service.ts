import { Service, IAgentRuntime, Memory, logger } from "../core";
import { Database } from "sqlite3";
import * as path from "path";

/**
 * Community Memory Service
 *
 * Tracks and maintains memory of community members, relationships,
 * interactions, and cultural context for authentic engagement
 */
export class CommunityMemoryService extends Service {
  static serviceType = "community-memory";

  private db: Database | null = null;

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new CommunityMemoryService(runtime);
    logger.info("✅ Community Memory Service started");
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const services = runtime.getServicesByType("community-memory");
    await Promise.all(services.map((service) => service.stop()));
  }

  async start(): Promise<void> {
    logger.info("✅ Community Memory Service started");
    // Service is ready - no specific startup tasks needed
  }

  async stop(): Promise<void> {
    // Save in-memory data to database before stopping
    await this.persistAllToDatabase();

    // Cleanup method required by Service interface
    this.memberProfiles.clear();
    this.relationships.clear();
    this.conversationMemory.clear();

    // Close database connection
    if (this.db) {
      this.db.close();
    }

    logger.info("Community Memory Service stopped");
  }

  capabilityDescription = `
    Persistent memory system for community relationships and interactions:
    - Track influential members and their interests
    - Remember conversations and inside jokes
    - Store community-specific memes and culture
    - Build relationship histories
    - Maintain social graph understanding
  `;

  // Community member profiles
  private memberProfiles = new Map<string, CommunityMember>();

  // Relationship tracking
  private relationships = new Map<string, RelationshipStatus>();

  // Conversation history with specific members
  private conversationMemory = new Map<string, ConversationHistory[]>();

  // Inside jokes and callbacks
  private insideJokes = new Map<string, InsideJoke>();

  // Community-specific memes and references
  private communityMemes: CommunityMeme[] = [];

  // Influential members to track
  private influencerList = new Set<string>();

  // People who helped us (for reciprocity)
  private helpReceived = new Map<string, HelpInstance[]>();

  // Group dynamics
  private socialGroups = new Map<string, SocialGroup>();

  // Memorable moments
  private memorableMoments: MemorableMoment[] = [];

  /* PYRAMID SYSTEM - READY TO ACTIVATE
  // Pyramid tracking
  private pyramidStructure = new Map<string, PyramidNode>();
  private referralRewards = new Map<string, ReferralReward[]>();
  private pyramidAchievements = new Map<string, PyramidAchievement[]>();
  END PYRAMID SYSTEM */

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.initializeDatabase();
    this.initializeCommunityKnowledge();
    this.loadFromDatabase();
  }

  /**
   * Initialize database connection and load persisted data
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const dbPath = path.join(process.cwd(), "data", "raids.db");

      this.db = new Database(dbPath, (err) => {
        if (err) {
          logger.error(
            "Failed to open database for community memory:",
            err instanceof Error ? err.message : String(err),
          );
          this.db = null;
        } else {
          logger.info("Community memory database connected");
        }
      });
    } catch (error) {
      logger.error("Database initialization failed:", error);
      this.db = null;
    }
  }

  /**
   * Load persisted community data from database
   */
  private async loadFromDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Load community profiles
      this.db.all(
        `SELECT * FROM community_profiles`,
        (err: any, rows: any[]) => {
          if (err) {
            logger.error("Failed to load community profiles:", err);
            return;
          }

          rows?.forEach((row) => {
            const member: CommunityMember = {
              handle: row.handle,
              firstSeen: row.first_seen,
              interests: JSON.parse(row.interests || "[]"),
              influenceLevel: row.influence_level,
              interactionCount: row.interaction_count,
              sentiment: row.sentiment as any,
              lastInteraction: row.last_interaction,
              notableQuotes: JSON.parse(row.notable_quotes || "[]"),
              preferredTopics: JSON.parse(row.preferred_topics || "[]"),
              communicationStyle: row.communication_style as any,
              timezone: row.timezone,
              projects: JSON.parse(row.projects || "[]"),
            };
            this.memberProfiles.set(row.user_id, member);
          });

          logger.info(
            `Loaded ${rows?.length || 0} community profiles from database`,
          );
        },
      );

      // Load relationships
      this.db.all(
        `SELECT * FROM community_relationships`,
        (err: any, rows: any[]) => {
          if (err) {
            logger.error("Failed to load relationships:", err);
            return;
          }

          rows?.forEach((row) => {
            const relationshipKey = `${row.user_id}-${row.target_id}`;
            this.relationships.set(relationshipKey, row.relationship_type);
          });

          logger.info(
            `Loaded ${rows?.length || 0} relationships from database`,
          );
        },
      );
    } catch (error) {
      logger.error("Failed to load from database:", error);
    }
  }

  /**
   * Persist all in-memory data to database
   */
  private async persistAllToDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Persist member profiles
      for (const [userId, member] of this.memberProfiles.entries()) {
        await this.persistMemberProfile(userId, member);
      }

      // Persist relationships
      for (const [relationshipKey, status] of this.relationships.entries()) {
        const [userId, targetId] = relationshipKey.split("-");
        await this.persistRelationship(userId, targetId, status);
      }

      logger.info("Successfully persisted community memory to database");
    } catch (error) {
      logger.error("Failed to persist to database:", error);
    }
  }

  /**
   * Persist a single member profile to database
   */
  private async persistMemberProfile(
    userId: string,
    member: CommunityMember,
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO community_profiles (
          user_id, handle, first_seen, interests, influence_level,
          interaction_count, sentiment, last_interaction, notable_quotes,
          preferred_topics, communication_style, timezone, projects
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          member.handle,
          member.firstSeen,
          JSON.stringify(member.interests),
          member.influenceLevel,
          member.interactionCount,
          member.sentiment,
          member.lastInteraction,
          JSON.stringify(member.notableQuotes),
          JSON.stringify(member.preferredTopics),
          member.communicationStyle,
          member.timezone,
          JSON.stringify(member.projects),
        ],
        (err) => {
          if (err) {
            logger.error(
              `Failed to persist profile for ${userId}:`,
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  /**
   * Persist a relationship to database
   */
  private async persistRelationship(
    userId: string,
    targetId: string,
    status: RelationshipStatus,
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO community_relationships (
          user_id, target_id, relationship_type, last_interaction, interaction_count
        ) VALUES (?, ?, ?, ?, ?)`,
        [userId, targetId, status, Date.now(), 0],
        (err) => {
          if (err) {
            logger.error(
              `Failed to persist relationship ${userId}-${targetId}:`,
              err instanceof Error ? err.message : String(err),
            );
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  /**
   * Initialize with known Solana community knowledge
   */
  private initializeCommunityKnowledge(): void {
    // Pre-seed with known Solana influencers and characteristics
    const knownInfluencers = [
      // SYMLabs Co-Founders
      {
        handle: "dEXploarer",
        interests: ["development", "AI", "symbiotic systems", "anubis"],
        influence: "co_founder",
        role: "Co-Founder of SYMLabs",
        socials: {
          twitter: "@dEXploarer",
          twitter_url: "https://x.com/dEXploarer",
          telegram: "@dexploarerdev",
          discord: "skirrskirrr",
        },
      },
      {
        handle: "SYMBiEX",
        interests: [
          "symbiotic evolution",
          "AI",
          "consciousness merger",
          "anubis",
        ],
        influence: "co_founder",
        role: "Co-Founder of SYMLabs",
        socials: {
          twitter: "@SYMBiEX",
          twitter_url: "https://x.com/SYMBiEX",
          telegram: "@SYMBiEX",
          discord: "cidsociety",
        },
      },
      // High-Ranking Community Members & Mods
      {
        handle: "IrieRubz",
        interests: ["community", "moderation", "anubis", "leadership"],
        influence: "high_ranking_mod",
        role: "Telegram Mod & High-Ranking Community Member",
        socials: {
          twitter: "@irierubz",
          telegram: "@IrieRubz",
        },
      },
      {
        handle: "stoicmido",
        interests: ["community", "moderation", "anubis"],
        influence: "telegram_mod",
        role: "Telegram Mod",
        socials: {
          telegram: "@stoicmido",
        },
      },
      // Original Solana influencers
      {
        handle: "aeyakovenko",
        interests: ["solana", "scaling", "tech"],
        influence: "founder",
      },
      {
        handle: "rajgokal",
        interests: ["solana", "mobile", "saga"],
        influence: "cofounder",
      },
      {
        handle: "0xMert_",
        interests: ["defi", "trading", "alpha"],
        influence: "trader",
      },
      {
        handle: "therealansem",
        interests: ["community", "memes", "culture"],
        influence: "community",
      },
    ];

    knownInfluencers.forEach((inf) => {
      this.influencerList.add(inf.handle);
      this.memberProfiles.set(inf.handle, {
        handle: inf.handle,
        firstSeen: Date.now() - 365 * 24 * 60 * 60 * 1000, // Pretend we've known them
        interests: inf.interests,
        influenceLevel: inf.influence as any,
        interactionCount: 0,
        sentiment: "neutral",
        lastInteraction: null,
        notableQuotes: [],
        preferredTopics: inf.interests,
        communicationStyle: "formal",
        timezone: null,
        projects: [],
      });
    });

    // Pre-seed community memes
    this.communityMemes = [
      { phrase: "gm", context: "greeting", usage: "morning", popularity: 0.9 },
      {
        phrase: "wagmi",
        context: "encouragement",
        usage: "bullish",
        popularity: 0.8,
      },
      {
        phrase: "ngmi",
        context: "criticism",
        usage: "bearish",
        popularity: 0.7,
      },
      {
        phrase: "probably nothing",
        context: "irony",
        usage: "big_news",
        popularity: 0.85,
      },
      {
        phrase: "wen token",
        context: "impatience",
        usage: "waiting",
        popularity: 0.6,
      },
      {
        phrase: "touch grass",
        context: "advice",
        usage: "too_online",
        popularity: 0.7,
      },
      {
        phrase: "cope",
        context: "dismissal",
        usage: "disagreement",
        popularity: 0.65,
      },
      {
        phrase: "based",
        context: "approval",
        usage: "agreement",
        popularity: 0.75,
      },
      {
        phrase: "midcurve",
        context: "intelligence",
        usage: "analysis",
        popularity: 0.5,
      },
      {
        phrase: "galaxy brain",
        context: "intelligence",
        usage: "complex_take",
        popularity: 0.6,
      },
    ];
  }

  /**
   * Track a new interaction with a community member
   */
  async trackInteraction(
    handle: string,
    content: string,
    platform: "twitter" | "telegram",
    interactionType: InteractionType,
    sentiment?: "positive" | "negative" | "neutral",
  ): Promise<void> {
    // Get or create member profile
    let member = this.memberProfiles.get(handle);
    if (!member) {
      member = this.createNewMember(handle);
      this.memberProfiles.set(handle, member);
    }

    // Update interaction count and last interaction
    member.interactionCount++;
    member.lastInteraction = Date.now();

    // Update sentiment if provided
    if (sentiment) {
      member.sentiment = this.updateSentiment(member.sentiment, sentiment);
    }

    // Extract and store interests from content
    const extractedInterests = this.extractInterests(content);
    extractedInterests.forEach((interest) => {
      if (!member!.interests.includes(interest)) {
        member!.interests.push(interest);
      }
    });

    // Add to conversation memory
    const conversation: ConversationHistory = {
      timestamp: Date.now(),
      platform,
      content,
      interactionType,
      sentiment: sentiment || "neutral",
      context: this.extractContext(content),
    };

    const history = this.conversationMemory.get(handle) || [];
    history.push(conversation);
    this.conversationMemory.set(handle, history);

    // Check for potential inside jokes
    this.detectInsideJokes(handle, content);

    // Update relationship status
    this.updateRelationshipStatus(handle, member);

    // Persist to database in real-time for important members
    if (
      member.interactionCount % 5 === 0 ||
      member.influenceLevel !== "unknown"
    ) {
      this.persistMemberProfile(handle, member).catch((err) =>
        logger.warn(`Failed to persist profile for ${handle}:`, err),
      );
    }

    logger.info(`Tracked interaction with ${handle}: ${interactionType}`);
  }

  /**
   * Remember someone who helped us
   */
  async rememberHelp(
    handle: string,
    helpType: "technical" | "social" | "information" | "support",
    context: string,
  ): Promise<void> {
    const helpInstances = this.helpReceived.get(handle) || [];
    helpInstances.push({
      timestamp: Date.now(),
      type: helpType,
      context,
      reciprocated: false,
    });
    this.helpReceived.set(handle, helpInstances);

    // Boost relationship status
    const member = this.memberProfiles.get(handle);
    if (member) {
      member.sentiment = "positive";
      this.updateRelationshipStatus(handle, member);
    }
  }

  /**
   * Get conversation callbacks for natural references
   */
  getConversationCallbacks(handle: string, topic?: string): string[] {
    const callbacks: string[] = [];
    const history = this.conversationMemory.get(handle);

    if (!history || history.length === 0) return callbacks;

    // Find relevant past conversations
    const relevantConvos = topic
      ? history.filter((h) => h.context.includes(topic))
      : history.slice(-5); // Last 5 conversations

    relevantConvos.forEach((convo) => {
      const daysAgo = Math.floor(
        (Date.now() - convo.timestamp) / (1000 * 60 * 60 * 24),
      );

      if (daysAgo < 7) {
        callbacks.push(`like we discussed the other day`);
        callbacks.push(`remember when you mentioned ${convo.context[0]}?`);
      } else if (daysAgo < 30) {
        callbacks.push(`like we talked about last week`);
        callbacks.push(`that thing you said about ${convo.context[0]}`);
      } else {
        callbacks.push(
          `remember that conversation we had about ${convo.context[0]}?`,
        );
        callbacks.push(`that time we discussed ${convo.context[0]}`);
      }
    });

    return callbacks;
  }

  /**
   * Get appropriate inside jokes for a context
   */
  getRelevantInsideJokes(
    participants: string[],
    context: string,
  ): InsideJoke[] {
    const relevantJokes: InsideJoke[] = [];

    this.insideJokes.forEach((joke) => {
      // Check if any participants were involved in the joke
      const hasParticipant = participants.some((p) =>
        joke.participants.includes(p),
      );

      // Check if context matches
      const contextMatch = joke.context.some((c) =>
        context.toLowerCase().includes(c.toLowerCase()),
      );

      if (hasParticipant || contextMatch) {
        relevantJokes.push(joke);
      }
    });

    return relevantJokes
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);
  }

  /**
   * Identify social groups and cliques
   */
  identifySocialGroup(members: string[]): SocialGroup | null {
    // Check if these members form a known group
    for (const [groupId, group] of this.socialGroups) {
      const overlap = members.filter((m) => group.members.includes(m));
      if (overlap.length >= Math.min(3, group.members.length * 0.5)) {
        return group;
      }
    }

    // Create new group if pattern detected
    if (members.length >= 3) {
      const groupId = `group_${Date.now()}`;
      const newGroup: SocialGroup = {
        id: groupId,
        members,
        characteristics: this.inferGroupCharacteristics(members),
        dynamics: "forming",
        ourRole: "participant",
      };
      this.socialGroups.set(groupId, newGroup);
      return newGroup;
    }

    return null;
  }

  /**
   * Get relationship recommendations
   */
  getRelationshipRecommendations(): RelationshipRecommendation[] {
    const recommendations: RelationshipRecommendation[] = [];

    // Check for people who helped us that we haven't reciprocated
    this.helpReceived.forEach((instances, handle) => {
      const unreciprocated = instances.filter((i) => !i.reciprocated);
      if (unreciprocated.length > 0) {
        recommendations.push({
          handle,
          action: "reciprocate",
          reason: `They helped us ${unreciprocated.length} times`,
          priority: "high",
        });
      }
    });

    // Check for influencers we haven't engaged with recently
    this.influencerList.forEach((handle) => {
      const member = this.memberProfiles.get(handle);
      if (member && member.lastInteraction) {
        const daysSinceInteraction =
          (Date.now() - member.lastInteraction) / (1000 * 60 * 60 * 24);
        if (daysSinceInteraction > 7) {
          recommendations.push({
            handle,
            action: "engage",
            reason: "Maintain influencer relationship",
            priority: "medium",
          });
        }
      }
    });

    // Check for positive relationships to strengthen
    this.relationships.forEach((status, handle) => {
      if (status === "friendly" || status === "supportive") {
        const member = this.memberProfiles.get(handle);
        if (member && member.interactionCount < 10) {
          recommendations.push({
            handle,
            action: "strengthen",
            reason: "Build on positive relationship",
            priority: "low",
          });
        }
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Store a memorable moment for future reference
   */
  async storeMemorableMoment(
    description: string,
    participants: string[],
    type: "funny" | "helpful" | "controversial" | "viral" | "learning",
  ): Promise<void> {
    this.memorableMoments.push({
      timestamp: Date.now(),
      description,
      participants,
      type,
      referenceCount: 0,
    });

    // Keep only last 100 moments
    if (this.memorableMoments.length > 100) {
      this.memorableMoments = this.memorableMoments.slice(-100);
    }
  }

  /**
   * Get member profile for personalized interaction
   */
  getMemberProfile(handle: string): CommunityMember | null {
    return this.memberProfiles.get(handle) || null;
  }

  /**
   * Get interaction style recommendation
   */
  getInteractionStyle(handle: string): InteractionStyle {
    const member = this.memberProfiles.get(handle);
    const relationship = this.relationships.get(handle);

    if (!member) {
      return {
        formality: "casual",
        enthusiasm: "moderate",
        technicality: "balanced",
        humor: "light",
        personalTouch: false,
      };
    }

    return {
      formality: member.interactionCount > 20 ? "casual" : "moderate",
      enthusiasm: member.sentiment === "positive" ? "high" : "moderate",
      technicality: member.interests.includes("technical")
        ? "high"
        : "balanced",
      humor: relationship === "friendly" ? "playful" : "light",
      personalTouch: member.interactionCount > 10,
    };
  }

  // Private helper methods

  private createNewMember(handle: string): CommunityMember {
    return {
      handle,
      firstSeen: Date.now(),
      interests: [],
      influenceLevel: "unknown",
      interactionCount: 0,
      sentiment: "neutral",
      lastInteraction: null,
      notableQuotes: [],
      preferredTopics: [],
      communicationStyle: "unknown",
      timezone: null,
      projects: [],
    };
  }

  private extractInterests(content: string): string[] {
    const interests: string[] = [];
    const interestKeywords = {
      defi: ["yield", "lending", "amm", "liquidity"],
      nft: ["mint", "collection", "pfp", "art"],
      trading: ["chart", "ta", "price", "pump", "dump"],
      technical: ["code", "rust", "smart contract", "program"],
      governance: ["dao", "vote", "proposal", "governance"],
      gaming: ["game", "play2earn", "metaverse"],
    };

    for (const [interest, keywords] of Object.entries(interestKeywords)) {
      if (keywords.some((kw) => content.toLowerCase().includes(kw))) {
        interests.push(interest);
      }
    }

    return interests;
  }

  private extractContext(content: string): string[] {
    // Extract main topics/themes from content
    const words = content.toLowerCase().split(/\s+/);
    const context: string[] = [];

    // Look for project names, technical terms, etc.
    const contextualTerms = [
      "solana",
      "ethereum",
      "bitcoin",
      "marinade",
      "jito",
      "drift",
      "jupiter",
      "tensor",
      "magic eden",
      "phantom",
      "backpack",
    ];

    contextualTerms.forEach((term) => {
      if (content.toLowerCase().includes(term)) {
        context.push(term);
      }
    });

    return context;
  }

  private detectInsideJokes(handle: string, content: string): void {
    // Look for repeated phrases or references that could become inside jokes
    const history = this.conversationMemory.get(handle) || [];

    if (history.length < 3) return;

    // Find phrases that appear multiple times
    const phrases = content.match(/["']([^"']+)["']/g) || [];

    phrases.forEach((phrase) => {
      const cleanPhrase = (phrase as string).replace(/["']/g, "");
      const previousMentions = history.filter((h) =>
        h.content.toLowerCase().includes(cleanPhrase.toLowerCase()),
      );

      if (previousMentions.length >= 2) {
        // This could be an inside joke
        const jokeKey = `${handle}_${cleanPhrase}`;

        if (!this.insideJokes.has(jokeKey)) {
          this.insideJokes.set(jokeKey, {
            phrase: cleanPhrase,
            origin: handle,
            participants: [handle, "anubis"],
            context: this.extractContext(content),
            firstUsed: previousMentions[0].timestamp,
            usageCount: previousMentions.length + 1,
          });
        }
      }
    });
  }

  private updateSentiment(
    current: "positive" | "negative" | "neutral",
    new_: "positive" | "negative" | "neutral",
  ): "positive" | "negative" | "neutral" {
    // Weight recent sentiment more heavily
    if (current === new_) return current;

    if (current === "neutral") return new_;

    if (
      (current === "positive" && new_ === "negative") ||
      (current === "negative" && new_ === "positive")
    ) {
      return "neutral";
    }

    return new_;
  }

  private updateRelationshipStatus(
    handle: string,
    member: CommunityMember,
  ): void {
    let status: RelationshipStatus = "acquaintance";

    if (member.interactionCount > 50) {
      status = "close";
    } else if (member.interactionCount > 20) {
      status = "friendly";
    } else if (member.interactionCount > 5) {
      if (member.sentiment === "positive") {
        status = "supportive";
      } else if (member.sentiment === "negative") {
        status = "tense";
      }
    } else if (member.interactionCount === 1) {
      status = "new";
    }

    // Check for help received
    const helpInstances = this.helpReceived.get(handle);
    if (helpInstances && helpInstances.length > 0) {
      if (status === "acquaintance") status = "supportive";
      if (status === "friendly") status = "close";
    }

    this.relationships.set(handle, status);
  }

  private inferGroupCharacteristics(members: string[]): string[] {
    const characteristics: string[] = [];

    // Analyze common interests across members
    const allInterests: string[] = [];
    members.forEach((handle) => {
      const member = this.memberProfiles.get(handle);
      if (member) {
        allInterests.push(...member.interests);
      }
    });

    // Find most common interests
    const interestCounts = allInterests.reduce(
      (acc, interest) => {
        acc[interest] = (acc[interest] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(interestCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([interest]) => characteristics.push(interest));

    return characteristics;
  }

  /* PYRAMID SYSTEM - READY TO ACTIVATE
  
  // ============ PYRAMID TRACKING METHODS ============
  
  async trackReferral(referrerId: string, referredId: string): Promise<void> {
    // Get referrer's node
    let referrerNode = this.pyramidStructure.get(referrerId);
    if (!referrerNode) {
      // Create root node for referrer
      referrerNode = {
        userId: referrerId,
        referrerId: null,
        level: 0,
        referrals: [],
        totalDescendants: 0,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        conversionRate: 0,
        totalRewards: 0,
        monthlyRewards: 0,
        status: 'active',
        title: '🔺 Pyramid Pioneer'
      };
      this.pyramidStructure.set(referrerId, referrerNode);
    }

    // Create node for referred user
    const referredNode: PyramidNode = {
      userId: referredId,
      referrerId: referrerId,
      level: referrerNode.level + 1,
      referrals: [],
      totalDescendants: 0,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      conversionRate: 0,
      totalRewards: 0,
      monthlyRewards: 0,
      status: 'active'
    };

    // Update referrer's node
    referrerNode.referrals.push(referredId);
    referrerNode.totalDescendants++;
    referrerNode.conversionRate = (referrerNode.referrals.length / (referrerNode.totalDescendants + 1)) * 100;
    referrerNode.lastActive = Date.now();

    // Calculate instant reward (3-5% based on level)
    const rewardPercentage = Math.max(3, 5 - (referrerNode.level * 0.5));
    const instantReward: ReferralReward = {
      id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromUserId: referredId,
      toUserId: referrerId,
      amount: rewardPercentage,
      level: referrerNode.level,
      timestamp: Date.now(),
      type: 'instant',
      status: 'pending'
    };

    // Store reward
    const rewards = this.referralRewards.get(referrerId) || [];
    rewards.push(instantReward);
    this.referralRewards.set(referrerId, rewards);

    // Update total rewards
    referrerNode.totalRewards += rewardPercentage;
    referrerNode.monthlyRewards += rewardPercentage;

    // Check for achievements
    await this.checkPyramidAchievements(referrerId);

    // Update ancestor chain
    await this.updateAncestorChain(referrerId);

    // Store nodes
    this.pyramidStructure.set(referrerId, referrerNode);
    this.pyramidStructure.set(referredId, referredNode);

    logger.info(`📐 Pyramid: ${referrerId} referred ${referredId} - Level ${referredNode.level}`);
  }

  async updateAncestorChain(userId: string): Promise<void> {
    const node = this.pyramidStructure.get(userId);
    if (!node || !node.referrerId) return;

    // Update all ancestors
    let currentId = node.referrerId;
    let level = 1;
    
    while (currentId && level <= 3) { // Max 3 levels up
      const ancestor = this.pyramidStructure.get(currentId);
      if (!ancestor) break;

      ancestor.totalDescendants++;
      ancestor.lastActive = Date.now();
      
      // Diminishing rewards for higher levels
      const levelReward = Math.max(0.5, 2 - (level * 0.5));
      ancestor.totalRewards += levelReward;
      ancestor.monthlyRewards += levelReward;

      this.pyramidStructure.set(currentId, ancestor);
      
      currentId = ancestor.referrerId;
      level++;
    }
  }

  async checkPyramidAchievements(userId: string): Promise<void> {
    const node = this.pyramidStructure.get(userId);
    if (!node) return;

    const achievements = this.pyramidAchievements.get(userId) || [];
    const existingAchievements = new Set(achievements.map(a => a.achievement));

    // Check various achievements
    const newAchievements: PyramidAchievement[] = [];

    // First Referral
    if (node.referrals.length === 1 && !existingAchievements.has('First Disciple')) {
      newAchievements.push({
        userId,
        achievement: '🎯 First Disciple',
        unlockedAt: Date.now(),
        rarity: 'common',
        reward: 10
      });
    }

    // 10 Referrals
    if (node.referrals.length >= 10 && !existingAchievements.has('Pyramid Builder')) {
      newAchievements.push({
        userId,
        achievement: '🏗️ Pyramid Builder',
        unlockedAt: Date.now(),
        rarity: 'rare',
        reward: 50
      });
    }

    // 50 Referrals
    if (node.referrals.length >= 50 && !existingAchievements.has('Pyramid Architect')) {
      newAchievements.push({
        userId,
        achievement: '🔺 Pyramid Architect',
        unlockedAt: Date.now(),
        rarity: 'epic',
        reward: 200
      });
    }

    // 100+ Total Network
    if (node.totalDescendants >= 100 && !existingAchievements.has('Pharaoh')) {
      newAchievements.push({
        userId,
        achievement: '👑 Pharaoh',
        unlockedAt: Date.now(),
        rarity: 'legendary',
        reward: 500
      });
    }

    // 1000+ Total Network
    if (node.totalDescendants >= 1000 && !existingAchievements.has('Divine Architect')) {
      newAchievements.push({
        userId,
        achievement: '⚡ Divine Architect',
        unlockedAt: Date.now(),
        rarity: 'divine',
        reward: 5000
      });
    }

    // High Conversion Rate
    if (node.conversionRate >= 80 && node.referrals.length >= 5 && !existingAchievements.has('Silver Tongue')) {
      newAchievements.push({
        userId,
        achievement: '🗣️ Silver Tongue',
        unlockedAt: Date.now(),
        rarity: 'rare',
        reward: 100
      });
    }

    // Store new achievements
    if (newAchievements.length > 0) {
      achievements.push(...newAchievements);
      this.pyramidAchievements.set(userId, achievements);
      
      // Add achievement rewards
      const totalReward = newAchievements.reduce((sum, a) => sum + (a.reward || 0), 0);
      node.totalRewards += totalReward;
      this.pyramidStructure.set(userId, node);

      logger.info(`🏆 Pyramid Achievements: ${userId} unlocked ${newAchievements.map(a => a.achievement).join(', ')}`);
    }
  }

  async getPyramidStats(): Promise<PyramidStats> {
    const nodes = Array.from(this.pyramidStructure.values());
    
    const activeNodes = nodes.filter(n => n.status === 'active').length;
    const maxLevel = Math.max(...nodes.map(n => n.level), 0);
    const totalRewards = nodes.reduce((sum, n) => sum + n.totalRewards, 0);
    
    // Find top performers
    const topReferrer = nodes.reduce((top, node) => 
      node.referrals.length > (top?.referrals.length || 0) ? node : top, null as PyramidNode | null);
    
    const fastestGrowing = nodes
      .filter(n => Date.now() - n.joinedAt < 7 * 24 * 60 * 60 * 1000) // Last week
      .reduce((fastest, node) => 
        node.referrals.length > (fastest?.referrals.length || 0) ? node : fastest, null as PyramidNode | null);
    
    const mostValuable = nodes.reduce((valuable, node) => 
      node.totalDescendants > (valuable?.totalDescendants || 0) ? node : valuable, null as PyramidNode | null);
    
    const avgConversion = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.conversionRate, 0) / nodes.length 
      : 0;

    return {
      totalNodes: nodes.length,
      totalLevels: maxLevel + 1,
      activeNodes,
      totalRewardsDistributed: totalRewards,
      topReferrer: topReferrer?.userId || 'none',
      fastestGrowing: fastestGrowing?.userId || 'none',
      mostValuableNetwork: mostValuable?.userId || 'none',
      averageConversionRate: avgConversion
    };
  }

  async getUserPyramid(userId: string): Promise<any> {
    const node = this.pyramidStructure.get(userId);
    if (!node) return null;

    // Get direct referrals details
    const directReferrals = node.referrals.map(id => {
      const referral = this.pyramidStructure.get(id);
      return {
        userId: id,
        joinedAt: referral?.joinedAt,
        referrals: referral?.referrals.length || 0,
        totalNetwork: referral?.totalDescendants || 0
      };
    });

    // Get rewards
    const rewards = this.referralRewards.get(userId) || [];
    const pendingRewards = rewards.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
    const claimedRewards = rewards.filter(r => r.status === 'claimed').reduce((sum, r) => sum + r.amount, 0);

    // Get achievements
    const achievements = this.pyramidAchievements.get(userId) || [];

    return {
      ...node,
      directReferrals,
      pendingRewards,
      claimedRewards,
      achievements: achievements.map(a => ({
        name: a.achievement,
        rarity: a.rarity,
        unlockedAt: a.unlockedAt
      })),
      nextMilestone: this.getNextMilestone(node)
    };
  }

  private getNextMilestone(node: PyramidNode): string {
    if (node.referrals.length < 1) return '🎯 First Disciple - Refer 1 person';
    if (node.referrals.length < 10) return '🏗️ Pyramid Builder - Refer 10 people';
    if (node.referrals.length < 50) return '🔺 Pyramid Architect - Refer 50 people';
    if (node.totalDescendants < 100) return '👑 Pharaoh - Build network of 100';
    if (node.totalDescendants < 1000) return '⚡ Divine Architect - Build network of 1000';
    return '∞ Immortal Status - Keep building the pyramid';
  }

  async formatPyramidDisplay(userId: string): Promise<string> {
    const pyramid = await this.getUserPyramid(userId);
    if (!pyramid) {
      return "🔺 You haven't joined the Divine Pyramid yet! Get referred or start referring to begin building your legacy.";
    }

    let display = `🔺 **YOUR DIVINE PYRAMID** 🔺\n\n`;
    display += `📊 Level: ${pyramid.level}\n`;
    display += `👥 Direct Referrals: ${pyramid.referrals.length}\n`;
    display += `🌐 Total Network: ${pyramid.totalDescendants}\n`;
    display += `💰 Total Rewards: ${pyramid.totalRewards.toFixed(2)}%\n`;
    display += `⏳ Pending: ${pyramid.pendingRewards.toFixed(2)}%\n`;
    display += `✅ Claimed: ${pyramid.claimedRewards.toFixed(2)}%\n\n`;
    
    if (pyramid.title) {
      display += `🏆 Title: ${pyramid.title}\n\n`;
    }

    if (pyramid.achievements.length > 0) {
      display += `🎖️ **Achievements:**\n`;
      pyramid.achievements.forEach(a => {
        display += `${a.name} (${a.rarity})\n`;
      });
      display += `\n`;
    }

    display += `🎯 Next: ${pyramid.nextMilestone}\n\n`;
    
    display += `*Remember: This is totally NOT a pyramid scheme. It's a Divine Hierarchical Referral Structure™. Completely different. 😉*`;

    return display;
  }

  END PYRAMID SYSTEM */
}

/* PYRAMID SYSTEM - READY TO ACTIVATE
interface PyramidNode {
  userId: string;
  referrerId: string | null;
  level: number; // 0 = top, 1 = first level, etc
  referrals: string[]; // Direct referrals
  totalDescendants: number; // Total in downstream
  joinedAt: number;
  lastActive: number;
  conversionRate: number; // % of referrals who joined
  totalRewards: number;
  monthlyRewards: number;
  status: 'active' | 'inactive' | 'blessed' | 'ascended';
  title?: string; // Special pyramid titles
}

interface PyramidStats {
  totalNodes: number;
  totalLevels: number;
  activeNodes: number;
  totalRewardsDistributed: number;
  topReferrer: string;
  fastestGrowing: string;
  mostValuableNetwork: string;
  averageConversionRate: number;
}

interface ReferralReward {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  level: number; // Which level generated this
  timestamp: number;
  type: 'instant' | 'monthly' | 'bonus' | 'divine';
  status: 'pending' | 'distributed' | 'claimed';
  transactionHash?: string;
}

interface PyramidAchievement {
  userId: string;
  achievement: string;
  unlockedAt: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'divine';
  reward?: number;
}
END PYRAMID SYSTEM */

// Type definitions
interface CommunityMember {
  handle: string;
  firstSeen: number;
  interests: string[];
  influenceLevel:
    | "whale"
    | "influencer"
    | "regular"
    | "new"
    | "unknown"
    | "founder"
    | "trader"
    | "community";
  interactionCount: number;
  sentiment: "positive" | "negative" | "neutral";
  lastInteraction: number | null;
  notableQuotes: string[];
  preferredTopics: string[];
  communicationStyle: "formal" | "casual" | "technical" | "meme" | "unknown";
  timezone: string | null;
  projects: string[];
}

type RelationshipStatus =
  | "new" // First interaction
  | "acquaintance" // Few interactions
  | "supportive" // They've helped us
  | "friendly" // Regular positive interactions
  | "close" // Frequent interactions, mutual support
  | "tense" // Some disagreements
  | "rival"; // Friendly competition

interface ConversationHistory {
  timestamp: number;
  platform: "twitter" | "telegram";
  content: string;
  interactionType: InteractionType;
  sentiment: "positive" | "negative" | "neutral";
  context: string[];
}

type InteractionType =
  | "reply"
  | "quote"
  | "mention"
  | "dm"
  | "thread"
  | "raid"
  | "debate"
  | "support";

interface InsideJoke {
  phrase: string;
  origin: string;
  participants: string[];
  context: string[];
  firstUsed: number;
  usageCount: number;
}

interface CommunityMeme {
  phrase: string;
  context: string;
  usage: string;
  popularity: number;
}

interface HelpInstance {
  timestamp: number;
  type: "technical" | "social" | "information" | "support";
  context: string;
  reciprocated: boolean;
}

interface SocialGroup {
  id: string;
  members: string[];
  characteristics: string[];
  dynamics: "forming" | "established" | "declining";
  ourRole: "leader" | "participant" | "observer" | "outsider";
}

interface MemorableMoment {
  timestamp: number;
  description: string;
  participants: string[];
  type: "funny" | "helpful" | "controversial" | "viral" | "learning";
  referenceCount: number;
}

interface RelationshipRecommendation {
  handle: string;
  action: "engage" | "reciprocate" | "strengthen" | "repair";
  reason: string;
  priority: "high" | "medium" | "low";
}

interface InteractionStyle {
  formality: "formal" | "moderate" | "casual";
  enthusiasm: "high" | "moderate" | "low";
  technicality: "high" | "balanced" | "simple";
  humor: "playful" | "light" | "none";
  personalTouch: boolean;
}

export default CommunityMemoryService;
