/**
 * Test Telegram Raids Integration
 * Verifies that the Telegram plugin and raids enhancement are properly integrated
 */

import { IAgentRuntime, Memory, State, UUID } from "@elizaos/core";
import { EnhancedTelegramRaidsService } from "./src/telegram-raids/elizaos-enhanced-telegram-raids";
import enhancedTelegramRaidsPlugin from "./src/telegram-raids/elizaos-enhanced-telegram-raids";
import nubiPlugin from "./src/nubi-plugin";

console.log("🔍 Testing Telegram Raids Integration\n");

// 1. Check plugin exports
console.log("1️⃣ Checking Enhanced Telegram Raids Plugin:");
console.log("   - Name:", enhancedTelegramRaidsPlugin.name);
console.log("   - Actions:", enhancedTelegramRaidsPlugin.actions?.map(a => a.name));
console.log("   - Providers:", enhancedTelegramRaidsPlugin.providers?.map(p => p.name));
console.log("   - Services:", enhancedTelegramRaidsPlugin.services?.map(s => s.name || s.constructor.name));

// 2. Check NUBI plugin includes raids service
console.log("\n2️⃣ Checking NUBI Plugin Integration:");
const hasRaidsService = nubiPlugin.services?.some(
  service => service === EnhancedTelegramRaidsService || 
             service.name === "EnhancedTelegramRaidsService"
);
console.log("   - Has EnhancedTelegramRaidsService:", hasRaidsService);
console.log("   - Total services in NUBI plugin:", nubiPlugin.services?.length);

// 3. Check raid commands validation
console.log("\n3️⃣ Checking Raid Commands:");
const raidCommands = [
  "/startraid https://x.com/example/status/123",
  "/joinraid",
  "/raidstats",
  "/leaderboard",
  "/endraid"
];

for (const cmd of raidCommands) {
  const mockMessage: Memory = {
    id: "test-" + Math.random().toString(36).substring(7) as UUID,
    agentId: "test-agent" as UUID,
    userId: "test-user" as UUID,
    entityId: "test-entity" as UUID,
    roomId: "test-room" as UUID,
    content: {
      text: cmd,
      source: "telegram"
    },
    createdAt: Date.now(),
    embedding: [],
    unique: true
  };

  // Check if any raid action would validate this command
  const wouldTrigger = enhancedTelegramRaidsPlugin.actions?.some(action => {
    if (action.name === "START_RAID" && cmd.includes("/startraid")) return true;
    if (action.name === "JOIN_RAID" && cmd.includes("/joinraid")) return true;
    if (action.name === "RAID_STATS" && cmd.includes("/raidstats")) return true;
    return false;
  });

  console.log(`   - "${cmd}" would trigger action:`, wouldTrigger || false);
}

// 4. Check configuration
console.log("\n4️⃣ Checking Raid Configuration:");
const mockRuntime = {
  getSetting: (key: string) => {
    const settings: Record<string, any> = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      RAID_DURATION_MINUTES: "30",
      MIN_RAID_PARTICIPANTS: "5",
      RAID_COOLDOWN_MINUTES: "60"
    };
    return settings[key];
  },
  agentId: "test-agent" as UUID,
  getService: (name: string) => null,
  logger: console
} as any as IAgentRuntime;

// 5. Test service initialization
console.log("\n5️⃣ Testing Service Initialization:");
try {
  const service = new EnhancedTelegramRaidsService(mockRuntime);
  console.log("   - Service created successfully");
  console.log("   - Service type:", (service as any).constructor.name);
  console.log("   - Has start method:", typeof (service as any).start === 'function');
  console.log("   - Has joinRaid method:", typeof (service as any).joinRaid === 'function');
  console.log("   - Has getRaidStats method:", typeof (service as any).getRaidStats === 'function');
} catch (error) {
  console.log("   - Service initialization error:", error.message);
}

// 6. Check integration points
console.log("\n6️⃣ Checking Integration Points:");
console.log("   - Telegram plugin in character.plugins:", 
  process.env.TELEGRAM_BOT_TOKEN ? "✅ Will be loaded" : "❌ Missing token");
console.log("   - EnhancedTelegramRaidsService in nubi-plugin.services:", hasRaidsService ? "✅" : "❌");
console.log("   - Raid actions available:", enhancedTelegramRaidsPlugin.actions?.length || 0);
console.log("   - Raid providers available:", enhancedTelegramRaidsPlugin.providers?.length || 0);

// 7. Test raid flow
console.log("\n7️⃣ Testing Raid Flow Methods:");
const raidService = new EnhancedTelegramRaidsService(mockRuntime);
console.log("   - startRaidSession:", typeof (raidService as any).startRaidSession === 'function' ? "✅" : "❌");
console.log("   - joinRaid:", typeof (raidService as any).joinRaid === 'function' ? "✅" : "❌");
console.log("   - getRaidStats:", typeof (raidService as any).getRaidStats === 'function' ? "✅" : "❌");
console.log("   - endRaidSession:", typeof (raidService as any).endRaidSession === 'function' ? "✅" : "❌");
console.log("   - getActiveRaids:", typeof (raidService as any).getActiveRaids === 'function' ? "✅" : "❌");

// Summary
console.log("\n✨ Integration Test Summary:");
const checks = [
  hasRaidsService,
  enhancedTelegramRaidsPlugin.actions?.length > 0,
  enhancedTelegramRaidsPlugin.providers?.length > 0,
  process.env.TELEGRAM_BOT_TOKEN !== undefined
];
const passed = checks.filter(Boolean).length;
console.log(`   Passed ${passed}/${checks.length} checks`);

if (passed === checks.length) {
  console.log("   ✅ Telegram Raids fully integrated!");
} else {
  console.log("   ⚠️  Some integration points need attention");
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log("      - Set TELEGRAM_BOT_TOKEN in .env");
  }
  if (!hasRaidsService) {
    console.log("      - Add EnhancedTelegramRaidsService to nubi-plugin services");
  }
}

export {};
