#!/bin/bash

echo "🤖 NUBI Telegram Raids - Quick Test Script"
echo "=========================================="
echo ""

# Check if TELEGRAM_BOT_TOKEN is set
if ! grep -q "TELEGRAM_BOT_TOKEN=" .env; then
    echo "❌ TELEGRAM_BOT_TOKEN not found in .env"
    echo "   Please add your bot token first!"
    exit 1
fi

echo "✅ Environment configured"
echo ""
echo "📝 Starting NUBI with Telegram Raids..."
echo ""
echo "Commands you can test:"
echo "  /startraid https://x.com/example/status/123"
echo "  /joinraid"
echo "  /raidstats"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Run the bot
bun run dev
