#!/usr/bin/env node

/**
 * Quick script to get Telegram Channel ID
 * Run after adding your bot to a channel
 */

const https = require('https');

async function getChannelId() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.log("❌ TELEGRAM_BOT_TOKEN not found in environment");
    console.log("Set your token first: export TELEGRAM_BOT_TOKEN=your_token_here");
    return;
  }

  console.log("🔍 Fetching recent updates from Telegram...\n");

  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (!response.ok) {
          console.log("❌ Error from Telegram API:", response.description);
          return;
        }
        
        if (response.result.length === 0) {
          console.log("📝 No recent messages found.");
          console.log("\n🔧 To get your channel ID:");
          console.log("1. Add your bot to the channel as admin");
          console.log("2. Send a test message to the channel");
          console.log("3. Run this script again");
          return;
        }
        
        console.log("📊 Found chat IDs:\n");
        
        const chats = new Map();
        
        response.result.forEach(update => {
          if (update.message && update.message.chat) {
            const chat = update.message.chat;
            const key = `${chat.id}_${chat.type}`;
            
            if (!chats.has(key)) {
              chats.set(key, {
                id: chat.id,
                type: chat.type,
                title: chat.title || chat.first_name || 'Private Chat',
                username: chat.username ? `@${chat.username}` : null
              });
            }
          }
        });
        
        chats.forEach(chat => {
          console.log(`📋 ${chat.type.toUpperCase()}: ${chat.title}`);
          console.log(`   ID: ${chat.id}`);
          if (chat.username) {
            console.log(`   Username: ${chat.username}`);
          }
          console.log();
        });
        
        console.log("💡 Add to your .env file:");
        chats.forEach(chat => {
          if (chat.type === 'channel' || chat.type === 'supergroup') {
            console.log(`TELEGRAM_CHANNEL_ID=${chat.username || chat.id}`);
          }
        });
        
      } catch (error) {
        console.log("❌ Error parsing response:", error.message);
      }
    });
    
  }).on('error', (error) => {
    console.log("❌ Request failed:", error.message);
  });
}

getChannelId();