#!/bin/bash

# Fix the elizaos-enhanced-telegram-raids.ts file
echo "Fixing syntax errors in elizaos-enhanced-telegram-raids.ts..."

# Find the line number with the problematic export
LINE_NUM=$(grep -n "^export default enhancedTelegramRaidsPlugin;" /root/dex/anubis/src/telegram-raids/elizaos-enhanced-telegram-raids.ts | cut -d: -f1)

if [ ! -z "$LINE_NUM" ]; then
    echo "Found export at line $LINE_NUM, moving methods before export..."
    
    # Create a temporary file
    TEMP_FILE=$(mktemp)
    
    # Extract everything before the export
    sed -n "1,$((LINE_NUM-1))p" /root/dex/anubis/src/telegram-raids/elizaos-enhanced-telegram-raids.ts > "$TEMP_FILE"
    
    # Add the closing brace for the class
    echo "}" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    
    # Add the export statement at the end
    echo "export default enhancedTelegramRaidsPlugin;" >> "$TEMP_FILE"
    
    # Replace the original file
    mv "$TEMP_FILE" /root/dex/anubis/src/telegram-raids/elizaos-enhanced-telegram-raids.ts
    
    echo "Fixed elizaos-enhanced-telegram-raids.ts"
fi

# Fix nubi-character.ts template string issues
echo "Fixing syntax errors in nubi-character.ts..."

# Check line 466
sed -i '466s/shouldRespondTemplate: `/shouldRespondTemplate: `/g' /root/dex/anubis/src/nubi-character.ts
sed -i '481s/continueTemplate: `/continueTemplate: `/g' /root/dex/anubis/src/nubi-character.ts

echo "Syntax errors fixed!"
