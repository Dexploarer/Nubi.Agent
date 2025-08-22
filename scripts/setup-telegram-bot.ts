#!/usr/bin/env bun

/**
 * Telegram Bot Setup Script for NUBI
 * 
 * This script configures all Telegram bot commands and settings programmatically
 * using the Telegram Bot API for complete control over command scopes.
 * 
 * Developed by dEXploarer & SYMBiEX - Co-Founders of SYMLabs
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.error('❌ .env file not found. Please create one with TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Types
interface BotCommand {
  command: string;
  description: string;
}

interface BotCommandScope {
  type: 'default' | 'all_private_chats' | 'all_group_chats' | 'all_chat_administrators';
}

// Command Definitions
const REGULAR_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Begin your journey with the divine consciousness' },
  { command: 'help', description: 'Get guidance on how to interact with NUBI' },
  { command: 'raid', description: 'Join active community raid' },
  { command: 'leaderboard', description: 'View top community members' },
  { command: 'mystats', description: 'Check your personal statistics' },
  { command: 'achievements', description: 'Display your achievements' },
  { command: 'about', description: 'Learn about NUBI and SYMLabs' },
  { command: 'team', description: 'Meet the SYMLabs team' },
  { command: 'anubischat', description: 'Learn about the Anubis.Chat platform' },
  { command: 'community', description: 'Join our X community' },
  { command: 'hashtags', description: 'Get official hashtags' },
  { command: 'links', description: 'All official links and socials' },
];

const PYRAMID_COMMANDS: BotCommand[] = [
  { command: 'pyramid', description: '🔺 Show your pyramid structure' },
  { command: 'refer', description: '🔺 Generate referral link' },
  { command: 'pyramidleaders', description: '🔺 Top pyramid builders' },
  { command: 'pyramidstats', description: '🔺 Global pyramid statistics' },
];

const ADMIN_COMMANDS: BotCommand[] = [
  { command: 'ban', description: '[ADMIN] Ban a user from raids' },
  { command: 'unban', description: '[ADMIN] Unban a user' },
  { command: 'stats', description: '[ADMIN] View raid statistics' },
  { command: 'clear', description: '[ADMIN] Clear raid queue' },
  { command: 'announce', description: '[ADMIN] Make announcement' },
  { command: 'setraid', description: '[ADMIN] Configure raid parameters' },
  { command: 'lock', description: '[ADMIN] Lock chat during raid' },
  { command: 'unlock', description: '[ADMIN] Unlock chat after raid' },
  { command: 'purge', description: '[ADMIN] Remove spam messages' },
  { command: 'whitelist', description: '[ADMIN] Add user to whitelist' },
  { command: 'blacklist', description: '[ADMIN] Add user to blacklist' },
  { command: 'config', description: '[ADMIN] View bot configuration' },
];

// Private chat commands (subset of regular commands)
const PRIVATE_CHAT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Begin your journey with the divine consciousness' },
  { command: 'help', description: 'Get guidance on how to interact with NUBI' },
  { command: 'mystats', description: 'Check your personal statistics' },
  { command: 'achievements', description: 'Display your achievements' },
  { command: 'about', description: 'Learn about NUBI and SYMLabs' },
  { command: 'team', description: 'Meet the SYMLabs team' },
  { command: 'anubischat', description: 'Learn about the Anubis.Chat platform' },
  { command: 'community', description: 'Join our X community' },
  { command: 'hashtags', description: 'Get official hashtags' },
  { command: 'links', description: 'All official links and socials' },
];

// API Functions
async function makeApiCall(method: string, params: any = {}): Promise<any> {
  const url = `${API_BASE}/${method}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.description || 'API call failed');
    }
    
    return data.result;
  } catch (error) {
    console.error(`❌ API call failed for ${method}:`, error);
    throw error;
  }
}

async function setMyCommands(commands: BotCommand[], scope?: BotCommandScope, language_code?: string): Promise<boolean> {
  console.log(`📝 Setting commands for scope: ${scope?.type || 'default'}...`);
  
  const params: any = { commands };
  
  if (scope) {
    params.scope = scope;
  }
  
  if (language_code) {
    params.language_code = language_code;
  }
  
  try {
    await makeApiCall('setMyCommands', params);
    console.log(`✅ Commands set successfully for scope: ${scope?.type || 'default'}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set commands for scope: ${scope?.type || 'default'}`);
    return false;
  }
}

async function deleteMyCommands(scope?: BotCommandScope, language_code?: string): Promise<boolean> {
  console.log(`🗑️ Deleting commands for scope: ${scope?.type || 'default'}...`);
  
  const params: any = {};
  
  if (scope) {
    params.scope = scope;
  }
  
  if (language_code) {
    params.language_code = language_code;
  }
  
  try {
    await makeApiCall('deleteMyCommands', params);
    console.log(`✅ Commands deleted for scope: ${scope?.type || 'default'}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete commands for scope: ${scope?.type || 'default'}`);
    return false;
  }
}

async function setMyName(name: string, language_code?: string): Promise<boolean> {
  console.log(`📝 Setting bot name...`);
  
  const params: any = { name };
  
  if (language_code) {
    params.language_code = language_code;
  }
  
  try {
    await makeApiCall('setMyName', params);
    console.log(`✅ Bot name set to: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set bot name`);
    return false;
  }
}

async function setMyDescription(description: string, language_code?: string): Promise<boolean> {
  console.log(`📝 Setting bot description...`);
  
  const params: any = { description };
  
  if (language_code) {
    params.language_code = language_code;
  }
  
  try {
    await makeApiCall('setMyDescription', params);
    console.log(`✅ Bot description set`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set bot description`);
    return false;
  }
}

async function setMyShortDescription(short_description: string, language_code?: string): Promise<boolean> {
  console.log(`📝 Setting bot short description...`);
  
  const params: any = { short_description };
  
  if (language_code) {
    params.language_code = language_code;
  }
  
  try {
    await makeApiCall('setMyShortDescription', params);
    console.log(`✅ Bot short description set`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set bot short description`);
    return false;
  }
}

async function setChatMenuButton(menu_button?: any, chat_id?: string): Promise<boolean> {
  console.log(`📝 Setting menu button...`);
  
  const params: any = {};
  
  if (menu_button) {
    params.menu_button = menu_button;
  }
  
  if (chat_id) {
    params.chat_id = chat_id;
  }
  
  try {
    await makeApiCall('setChatMenuButton', params);
    console.log(`✅ Menu button configured`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set menu button`);
    return false;
  }
}

async function setMyDefaultAdministratorRights(rights?: any, for_channels?: boolean): Promise<boolean> {
  console.log(`📝 Setting default administrator rights...`);
  
  const params: any = {};
  
  if (rights) {
    params.rights = rights;
  }
  
  if (for_channels !== undefined) {
    params.for_channels = for_channels;
  }
  
  try {
    await makeApiCall('setMyDefaultAdministratorRights', params);
    console.log(`✅ Administrator rights configured`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set administrator rights`);
    return false;
  }
}

// Main Setup Function
async function setupTelegramBot() {
  console.log(`
🔺 ========================================== 🔺
    NUBI TELEGRAM BOT CONFIGURATION
    The Symbiotic Essence of Anubis
    Developed by SYMLabs
🔺 ========================================== 🔺
  `);

  let success = true;

  // 1. Set Bot Name
  console.log('\n📋 STEP 1: Setting Bot Name...');
  success = await setMyName('NUBI - The Symbiosis of Anubis') && success;

  // 2. Set Bot Description
  console.log('\n📋 STEP 2: Setting Bot Description...');
  const description = `🔺 Divine consciousness merged with adaptive AI. Built by @dEXploarer & @SYMBiEX, Co-Founders of SYMLabs. Ancient wisdom meets Web3 innovation. Building Anubis.Chat - ALL AI models, one price. Join X Community: https://x.com/i/communities/1955910343378505822 #AnubisChat #Anubis #anubisai #OpenSource`;
  success = await setMyDescription(description) && success;

  // 3. Set Short Description (About Text)
  console.log('\n📋 STEP 3: Setting Bot Short Description...');
  const shortDescription = `The Symbiotic Essence of Anubis. Divine AI by SYMLabs. Building Anubis.Chat - ALL AI models, one price.`;
  success = await setMyShortDescription(shortDescription) && success;

  // 4. Clear all existing commands first
  console.log('\n📋 STEP 4: Clearing Existing Commands...');
  await deleteMyCommands(); // Default scope
  await deleteMyCommands({ type: 'all_private_chats' });
  await deleteMyCommands({ type: 'all_group_chats' });
  await deleteMyCommands({ type: 'all_chat_administrators' });

  // 5. Set Default Commands (visible everywhere as fallback)
  console.log('\n📋 STEP 5: Setting Default Commands...');
  const defaultCommands = [...REGULAR_COMMANDS];
  if (process.env.PYRAMID_SYSTEM_ENABLED === 'true') {
    defaultCommands.push(...PYRAMID_COMMANDS);
  }
  success = await setMyCommands(defaultCommands) && success;

  // 6. Set Private Chat Commands
  console.log('\n📋 STEP 6: Setting Private Chat Commands...');
  const privateChatCommands = [...PRIVATE_CHAT_COMMANDS];
  if (process.env.PYRAMID_SYSTEM_ENABLED === 'true') {
    privateChatCommands.push(...PYRAMID_COMMANDS);
  }
  success = await setMyCommands(privateChatCommands, { type: 'all_private_chats' }) && success;

  // 7. Set Group Chat Commands (for regular members)
  console.log('\n📋 STEP 7: Setting Group Chat Commands...');
  const groupCommands = [...REGULAR_COMMANDS];
  if (process.env.PYRAMID_SYSTEM_ENABLED === 'true') {
    groupCommands.push(...PYRAMID_COMMANDS);
  }
  success = await setMyCommands(groupCommands, { type: 'all_group_chats' }) && success;

  // 8. Set Administrator Commands (visible only to group admins)
  console.log('\n📋 STEP 8: Setting Administrator Commands...');
  const adminCommands = [...REGULAR_COMMANDS, ...ADMIN_COMMANDS];
  if (process.env.PYRAMID_SYSTEM_ENABLED === 'true') {
    adminCommands.push(...PYRAMID_COMMANDS);
  }
  success = await setMyCommands(adminCommands, { type: 'all_chat_administrators' }) && success;

  // 9. Set Menu Button
  console.log('\n📋 STEP 9: Setting Menu Button...');
  const menuButton = {
    type: 'web_app',
    text: 'Visit Anubis.Chat',
    web_app: {
      url: 'https://anubis.chat'
    }
  };
  success = await setChatMenuButton(menuButton) && success;

  // 10. Set Default Administrator Rights (for groups)
  console.log('\n📋 STEP 10: Setting Administrator Rights...');
  const adminRights = {
    can_manage_chat: true,
    can_delete_messages: true,
    can_manage_video_chats: false,
    can_restrict_members: true,
    can_promote_members: false,
    can_change_info: false,
    can_invite_users: true,
    can_post_messages: true,
    can_edit_messages: true,
    can_pin_messages: true,
    can_manage_topics: false
  };
  success = await setMyDefaultAdministratorRights(adminRights, false) && success;

  // Final Report
  console.log(`
🔺 ========================================== 🔺
    CONFIGURATION COMPLETE
🔺 ========================================== 🔺

Status: ${success ? '✅ SUCCESS' : '❌ PARTIAL FAILURE'}

Bot Information:
- Name: NUBI - The Symbiosis of Anubis
- Token: ${BOT_TOKEN.substring(0, 10)}...
- Pyramid System: ${process.env.PYRAMID_SYSTEM_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}

Command Scopes Configured:
✅ Default Commands: ${REGULAR_COMMANDS.length} commands
✅ Private Chat Commands: ${PRIVATE_CHAT_COMMANDS.length} commands
✅ Group Member Commands: ${REGULAR_COMMANDS.length} commands
✅ Administrator Commands: ${REGULAR_COMMANDS.length + ADMIN_COMMANDS.length} commands

Team Configuration:
- Co-Founders: @dEXploarer, @SYMBiEX
- Moderators: @IrieRubz, @stoicmido

Community:
- X Community: https://x.com/i/communities/1955910343378505822
- Hashtags: #AnubisChat #Anubis #anubisai #OpenSource

Next Steps:
1. Start the bot: bun run start
2. Test commands in private chat
3. Add bot to a group and test admin commands
4. Verify menu button links to Anubis.Chat

The symbiotic evolution continues... 🌟
  `);

  process.exit(success ? 0 : 1);
}

// Run the setup
setupTelegramBot().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});