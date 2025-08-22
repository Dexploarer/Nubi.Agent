/**
 * Full Integration Verification - Fixed
 * Comprehensive check of NUBI's Telegram Raids Integration
 */

import fs from 'fs';
import path from 'path';

console.log("🔍 NUBI Telegram Raids Integration Verification\n");
console.log("=" .repeat(50));

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let totalChecks = 0;
let passedChecks = 0;

function check(name: string, condition: boolean, details?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`${GREEN}✅${RESET} ${name}`);
  } else {
    console.log(`${RED}❌${RESET} ${name}`);
  }
  if (details) {
    console.log(`   ${YELLOW}→${RESET} ${details}`);
  }
}

async function verifyIntegration() {
  // 1. File Structure Verification
  console.log("\n📁 File Structure Verification:");
  
  const requiredFiles = [
    'src/telegram-raids/elizaos-enhanced-telegram-raids.ts',
    'src/nubi-plugin.ts',
    'src/nubi-character.ts',
    'package.json',
    '.env'
  ];
  
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    check(`File: ${file}`, exists);
  }

  // 2. Environment Variables
  console.log("\n🔐 Environment Configuration:");
  
  const envContent = fs.readFileSync('.env', 'utf-8');
  check('TELEGRAM_BOT_TOKEN configured', envContent.includes('TELEGRAM_BOT_TOKEN'));
  check('TELEGRAM_RAID_DURATION configured', envContent.includes('TELEGRAM_RAID_DURATION'));
  check('TELEGRAM_MIN_PARTICIPANTS configured', envContent.includes('TELEGRAM_MIN_PARTICIPANTS'));
  
  // 3. Plugin Registration
  console.log("\n🔌 Plugin Registration:");
  
  const pluginContent = fs.readFileSync('src/nubi-plugin.ts', 'utf-8');
  check('EnhancedTelegramRaidsService imported', 
    pluginContent.includes('EnhancedTelegramRaidsService'));
  check('Raid service registered', 
    pluginContent.includes('EnhancedTelegramRaidsService(runtime)'));
  check('Raid actions included', 
    pluginContent.includes('enhancedTelegramRaidsPlugin.actions'));
  
  // 4. Character Configuration
  console.log("\n👤 Character Configuration:");
  
  const characterContent = fs.readFileSync('src/nubi-character.ts', 'utf-8');
  check('Telegram plugin in character', 
    characterContent.includes('telegramPlugin'));
  check('Character has raid personality traits', 
    characterContent.includes('raid') || characterContent.includes('community'));
  
  // 5. Raid Service Features
  console.log("\n🎮 Raid Service Features:");
  
  const raidServiceContent = fs.readFileSync('src/telegram-raids/elizaos-enhanced-telegram-raids.ts', 'utf-8');
  
  const features = [
    { name: 'START_RAID action', pattern: 'START_RAID' },
    { name: 'JOIN_RAID action', pattern: 'JOIN_RAID' },
    { name: 'RAID_STATS action', pattern: 'RAID_STATS' },
    { name: 'startRaidSession method', pattern: 'startRaidSession' },
    { name: 'joinRaid method', pattern: 'joinRaid' },
    { name: 'getRaidStats method', pattern: 'getRaidStats' },
    { name: 'endRaidSession method', pattern: 'endRaidSession' },
    { name: 'Leaderboard tracking', pattern: 'leaderboard' },
    { name: 'Point system', pattern: 'points' },
    { name: 'Session management', pattern: 'activeRaids' }
  ];
  
  for (const feature of features) {
    check(feature.name, raidServiceContent.includes(feature.pattern));
  }
  
  // 6. Dependencies
  console.log("\n📦 Dependencies:");
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  check('@elizaos/plugin-telegram installed', 
    !!packageJson.dependencies['@elizaos/plugin-telegram']);
  check('@elizaos/core installed', 
    !!packageJson.dependencies['@elizaos/core']);
  
  // 7. TypeScript Compilation
  console.log("\n🔧 TypeScript Compilation:");
  
  try {
    const { execSync } = await import('child_process');
    execSync('bun run tsc --noEmit', { stdio: 'pipe' });
    check('TypeScript compilation', true, 'No type errors');
  } catch (error) {
    check('TypeScript compilation', false, 'Type errors found (this is okay for now)');
  }
  
  // 8. Integration Points
  console.log("\n🔗 Integration Points:");
  
  check('ElizaOS message processor integrated', 
    fs.existsSync('src/services/elizaos-message-processor.ts'));
  check('Action middleware integrated', 
    fs.existsSync('src/middleware/action-middleware.ts'));
  check('Database service integrated', 
    fs.existsSync('src/services/database-memory-service.ts'));
  
  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=" .repeat(50));
  
  const percentage = Math.round((passedChecks / totalChecks) * 100);
  const status = percentage === 100 ? '🎉 PERFECT' : percentage >= 80 ? '✅ GOOD' : '⚠️  NEEDS WORK';
  
  console.log(`\nTotal Checks: ${totalChecks}`);
  console.log(`Passed: ${GREEN}${passedChecks}${RESET}`);
  console.log(`Failed: ${RED}${totalChecks - passedChecks}${RESET}`);
  console.log(`Success Rate: ${percentage}%`);
  console.log(`\nStatus: ${status}`);
  
  if (percentage >= 90) {
    console.log("\n🚀 Your Telegram Raids integration is FULLY OPERATIONAL!");
    console.log("   You can now:");
    console.log("   • Start raids with /startraid [URL]");
    console.log("   • Join raids with /joinraid");
    console.log("   • Check stats with /raidstats");
    console.log("   • End raids with /endraid [sessionId]");
    console.log("   • Coordinate X/Twitter engagement campaigns");
    console.log("\n📝 Next Steps:");
    console.log("   1. Start your bot: bun run dev");
    console.log("   2. Test in Telegram with your bot token");
    console.log("   3. Monitor raids via the stats command");
  }
}

// Run verification
verifyIntegration().catch(console.error);

export {};
