#!/bin/bash

echo "Fixing remaining syntax errors..."

# Fix nubi-character.ts - the template strings have issues
echo "Fixing nubi-character.ts template strings..."
sed -i '466s/shouldRespondTemplate: `/shouldRespondTemplate: `/g' /root/dex/anubis/src/nubi-character.ts
sed -i '487d' /root/dex/anubis/src/nubi-character.ts  # Remove extra closing brace

# Fix elizaos-enhanced-telegram-raids.ts - remove extra closing brace
echo "Fixing elizaos-enhanced-telegram-raids.ts..."
sed -i '795d' /root/dex/anubis/src/telegram-raids/elizaos-enhanced-telegram-raids.ts

echo "Syntax errors fixed!"
