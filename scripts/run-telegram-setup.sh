#!/bin/bash

# NUBI Telegram Bot Setup Script
# Developed by dEXploarer & SYMBiEX - Co-Founders of SYMLabs

echo "🔺 Starting NUBI Telegram Bot Setup..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with TELEGRAM_BOT_TOKEN"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install it first:"
    echo "curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Run the setup script
bun run setup:telegram

echo ""
echo "🔺 Setup process complete!"