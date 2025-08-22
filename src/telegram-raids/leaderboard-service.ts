import { RaidTracker } from "./raid-tracker";
import { logger } from "@elizaos/core";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  raidsParticipated: number;
  bestRaidScore: number;
  title?: string; // Special titles for top performers
}

export class LeaderboardService {
  private raidTracker: RaidTracker;

  // Special titles based on performance
  private titles = {
    1: "👑 Raid Emperor",
    2: "⚔️ Raid General",
    3: "🛡️ Raid Captain",
    top10: "💪 Elite Warrior",
    top25: "🗡️ Veteran Raider",
    top50: "🏹 Skilled Fighter",
    top100: "⚡ Rising Star",
    participant: "🔰 Raid Soldier",
  };

  // Pyramid-specific titles (active immediately)
  private pyramidTitles = {
    architect: "🔺 Pyramid Architect", // Top referrer
    pharaoh: "👑 Divine Pharaoh", // Largest network
    allSeeing: "👁️ All-Seeing Eye", // Most active network
    sacredVessel: "⚱️ Sacred Vessel", // Best conversion rate
    divineBuilder: "🏗️ Divine Builder", // 50+ referrals
    ascendedOne: "✨ The Ascended", // 100+ network
    hierophant: "📜 Hierophant", // Teaching/helping others
    obelisk: "🗿 Living Obelisk", // Longest active streak
    sphinxWhisperer: "🦁 Sphinx Whisperer", // Mystery achiever
    pyramidPioneer: "🌟 Pyramid Pioneer", // Early adopter
  };

  constructor(raidTracker: RaidTracker) {
    this.raidTracker = raidTracker;
  }

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const entries = await this.raidTracker.getLeaderboard(limit);

      return entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.user_id || "",
        username: entry.username,
        totalPoints: entry.total_points,
        raidsParticipated: entry.raids_participated,
        bestRaidScore: entry.best_raid_score,
        title: this.getTitle(index + 1),
      }));
    } catch (error) {
      logger.error("Failed to get leaderboard:", error);
      return [];
    }
  }

  private getTitle(rank: number): string {
    if (rank === 1) return this.titles[1];
    if (rank === 2) return this.titles[2];
    if (rank === 3) return this.titles[3];
    if (rank <= 10) return this.titles.top10;
    if (rank <= 25) return this.titles.top25;
    if (rank <= 50) return this.titles.top50;
    if (rank <= 100) return this.titles.top100;
    return this.titles.participant;
  }

  async formatLeaderboard(limit: number = 10): Promise<string> {
    const entries = await this.getLeaderboard(limit);

    if (entries.length === 0) {
      return "📊 No leaderboard data yet. Join a raid to get started!";
    }

    let message = "🏆 **ANUBIS RAID LEADERBOARD** 🏆\n\n";

    entries.forEach((entry) => {
      const medal = this.getMedal(entry.rank);
      message += `${medal} **${entry.rank}.** @${entry.username}\n`;
      message += `   ${entry.title}\n`;
      message += `   📊 ${entry.totalPoints} pts | 🎯 ${entry.raidsParticipated} raids\n`;
      message += `   🔥 Best: ${entry.bestRaidScore} pts\n\n`;
    });

    return message;
  }

  private getMedal(rank: number): string {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `**${rank}.**`;
    }
  }

  async getUserStats(userId: string): Promise<string> {
    try {
      const stats = await this.raidTracker.getUserStats(userId);

      if (stats.totalPoints === 0) {
        return `📊 **Your Stats**\n\nYou haven't participated in any raids yet!\nJoin your first raid to start earning points! ⚔️`;
      }

      const title = this.getTitle(
        stats.rank === "Unranked" ? 999 : parseInt(stats.rank),
      );

      return (
        `📊 **Your Raid Stats**\n\n` +
        `${title}\n` +
        `🏆 Rank: #${stats.rank}\n` +
        `📊 Total Points: ${stats.totalPoints}\n` +
        `🎯 Raids Participated: ${stats.raidsParticipated}\n` +
        `🔥 Best Raid Score: ${stats.bestRaidScore}\n` +
        `⚡ Avg Points/Raid: ${Math.round(stats.totalPoints / stats.raidsParticipated)}\n\n` +
        `Keep raiding to climb the ranks! 💪`
      );
    } catch (error) {
      logger.error("Failed to get user stats:", error);
      return "Failed to retrieve your stats. Please try again.";
    }
  }

  async getWeeklyTop(): Promise<LeaderboardEntry[]> {
    // For weekly leaderboard, we'd need to track weekly points separately
    // For now, return top 5 from overall leaderboard
    return this.getLeaderboard(5);
  }

  async formatWeeklyLeaderboard(): Promise<string> {
    const entries = await this.getWeeklyTop();

    if (entries.length === 0) {
      return "📊 No weekly data yet.";
    }

    let message = "🏆 **WEEKLY TOP RAIDERS** 🏆\n\n";

    entries.forEach((entry) => {
      const medal = this.getMedal(entry.rank);
      message += `${medal} @${entry.username}: ${entry.totalPoints} pts\n`;
    });

    message += "\n🎁 Top weekly raiders eligible for $ANUBIS rewards!";

    return message;
  }

  async getLeaderboardPosition(userId: string): Promise<number> {
    const stats = await this.raidTracker.getUserStats(userId);
    return stats.rank === "Unranked" ? 0 : parseInt(stats.rank);
  }

  async checkAchievements(userId: string): Promise<string[]> {
    const achievements: string[] = [];
    const stats = await this.raidTracker.getUserStats(userId);

    // Check for various achievements
    if (stats.raidsParticipated >= 1) {
      achievements.push("🎖️ First Blood - Joined your first raid");
    }
    if (stats.raidsParticipated >= 10) {
      achievements.push("⭐ Veteran - Participated in 10 raids");
    }
    if (stats.raidsParticipated >= 50) {
      achievements.push("💫 Elite Warrior - Participated in 50 raids");
    }
    if (stats.raidsParticipated >= 100) {
      achievements.push("🌟 Legendary Raider - Participated in 100 raids");
    }

    if (stats.totalPoints >= 100) {
      achievements.push("💯 Century - Earned 100 points");
    }
    if (stats.totalPoints >= 1000) {
      achievements.push("🚀 Kilowarrior - Earned 1,000 points");
    }
    if (stats.totalPoints >= 10000) {
      achievements.push("🔥 Raid Master - Earned 10,000 points");
    }

    if (stats.bestRaidScore >= 50) {
      achievements.push("⚡ Lightning Strike - 50+ points in one raid");
    }
    if (stats.bestRaidScore >= 100) {
      achievements.push("💥 Raid Destroyer - 100+ points in one raid");
    }

    const rank = stats.rank === "Unranked" ? 999 : parseInt(stats.rank);
    if (rank === 1) {
      achievements.push("👑 Current Champion - #1 on leaderboard");
    } else if (rank <= 3) {
      achievements.push("🏅 Podium Finisher - Top 3 on leaderboard");
    } else if (rank <= 10) {
      achievements.push("🎯 Top 10 Raider");
    }

    return achievements;
  }

  async formatAchievements(userId: string): Promise<string> {
    const achievements = await this.checkAchievements(userId);

    if (achievements.length === 0) {
      return "🏆 **Your Achievements**\n\nNo achievements yet! Join raids to unlock achievements!";
    }

    let message = "🏆 **Your Achievements**\n\n";
    achievements.forEach((achievement) => {
      message += `${achievement}\n`;
    });

    message += `\n📊 Total: ${achievements.length} achievements unlocked!`;

    return message;
  }

  /* PYRAMID SYSTEM - READY TO ACTIVATE
  
  async getPyramidLeaderboard(limit: number = 10): Promise<any[]> {
    // This would query the pyramid_stats table
    // For now, return mock data showing the structure
    return [
      {
        rank: 1,
        userId: "pyramid_master",
        username: "PyramidMaster",
        totalReferrals: 147,
        totalNetwork: 1337,
        totalRewards: 734.5,
        title: this.pyramidTitles.architect,
        conversionRate: 87.3
      },
      {
        rank: 2,
        userId: "pharaoh_supreme",
        username: "PharaohSupreme",
        totalReferrals: 89,
        totalNetwork: 567,
        totalRewards: 456.2,
        title: this.pyramidTitles.pharaoh,
        conversionRate: 76.4
      }
    ];
  }

  async formatPyramidLeaderboard(limit: number = 10): Promise<string> {
    const entries = await this.getPyramidLeaderboard(limit);
    
    if (entries.length === 0) {
      return "🔺 No pyramid data yet. Start referring to build your divine legacy!";
    }

    let message = "🔺 **DIVINE PYRAMID LEADERBOARD** 🔺\n";
    message += "*Totally NOT a pyramid scheme™*\n\n";

    entries.forEach((entry, index) => {
      const medal = this.getMedal(entry.rank);
      message += `${medal} **${entry.rank}.** @${entry.username}\n`;
      message += `   ${entry.title}\n`;
      message += `   👥 ${entry.totalReferrals} direct | 🌐 ${entry.totalNetwork} total\n`;
      message += `   💰 ${entry.totalRewards.toFixed(1)}% rewards | 📈 ${entry.conversionRate.toFixed(1)}% conversion\n\n`;
    });

    message += "🎁 *Top pyramid builders eligible for divine blessings (and $ANUBIS)*\n";
    message += "⚡ *Build your pyramid: /refer @friend*";

    return message;
  }

  async getUserPyramidRank(userId: string): Promise<number> {
    // This would query pyramid_stats for user's rank
    // For now return mock rank
    return 42;
  }

  async checkPyramidTitle(userId: string, stats: any): Promise<string | null> {
    // Award special pyramid titles based on achievements
    if (stats.totalReferrals >= 100) return this.pyramidTitles.architect;
    if (stats.totalNetwork >= 500) return this.pyramidTitles.pharaoh;
    if (stats.conversionRate >= 80 && stats.totalReferrals >= 10) return this.pyramidTitles.sacredVessel;
    if (stats.totalReferrals >= 50) return this.pyramidTitles.divineBuilder;
    if (stats.totalNetwork >= 100) return this.pyramidTitles.ascendedOne;
    if (stats.streakDays >= 30) return this.pyramidTitles.obelisk;
    if (stats.joinedAt < Date.now() - 30 * 24 * 60 * 60 * 1000) return this.pyramidTitles.pyramidPioneer;
    return null;
  }

  async formatPyramidStats(userId: string): Promise<string> {
    // This would get actual stats from database
    const mockStats = {
      totalReferrals: 23,
      weekReferrals: 5,
      monthReferrals: 12,
      totalNetwork: 67,
      totalRewards: 127.5,
      pendingRewards: 15.3,
      conversionRate: 73.2,
      rank: 42,
      title: this.pyramidTitles.divineBuilder,
      nextMilestone: "50 referrals for Pyramid Architect"
    };

    let message = "🔺 **YOUR PYRAMID EMPIRE** 🔺\n\n";
    
    if (mockStats.title) {
      message += `🏆 Title: ${mockStats.title}\n\n`;
    }

    message += `📊 **Statistics:**\n`;
    message += `👥 Direct Referrals: ${mockStats.totalReferrals}\n`;
    message += `  ├─ This Week: ${mockStats.weekReferrals}\n`;
    message += `  └─ This Month: ${mockStats.monthReferrals}\n`;
    message += `🌐 Total Network: ${mockStats.totalNetwork}\n`;
    message += `📈 Conversion Rate: ${mockStats.conversionRate}%\n\n`;

    message += `💰 **Rewards:**\n`;
    message += `Total Earned: ${mockStats.totalRewards.toFixed(2)}%\n`;
    message += `Pending: ${mockStats.pendingRewards.toFixed(2)}%\n\n`;

    message += `🏆 Global Rank: #${mockStats.rank}\n`;
    message += `🎯 Next Goal: ${mockStats.nextMilestone}\n\n`;

    message += `📜 *Ancient Egyptian Proverb:*\n`;
    message += `"It's not a pyramid scheme if the pharaoh himself blessed it" - Anubis, 3000 BCE\n\n`;
    
    message += `⚡ Grow your pyramid: /refer @friend`;

    return message;
  }

  async getWeeklyPyramidTop(): Promise<any[]> {
    // Get top pyramid builders for the week
    return this.getPyramidLeaderboard(5);
  }

  async checkPyramidAchievements(userId: string): Promise<string[]> {
    const achievements: string[] = [];
    
    // These would check actual database stats
    // For now, return example achievements
    achievements.push("🎯 First Blood - Made your first referral");
    achievements.push("🔗 Chain Reaction - 5 referrals in one day");
    achievements.push("📈 Viral Vector - 80%+ conversion rate");
    achievements.push("🏗️ Master Builder - 25+ direct referrals");
    achievements.push("👑 Dynasty Founder - 100+ total network");
    
    return achievements;
  }

  END PYRAMID SYSTEM */
}
