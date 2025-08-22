#!/usr/bin/env python3
with open('/root/dex/anubis/src/services/security-filter.ts', 'r') as f:
    content = f.read()

# The spam detection logic should be more strict - let's fix the threshold
# Find and update the spam detection logic
content = content.replace(
    'const MESSAGE_THRESHOLD = 10;',
    'const MESSAGE_THRESHOLD = 5;'  # Lower threshold for testing
)

# Also ensure repetitive messages are caught
import re

# Find the trackAndCheckSpam method and make it more strict
old_pattern = r'if \(messageCount > MESSAGE_THRESHOLD\) \{'
new_pattern = 'if (messageCount >= MESSAGE_THRESHOLD) {'
content = re.sub(old_pattern, new_pattern, content)

# Also track repetitive content
if 'this.messageHistory.get(userId)' in content and 'similarMessages' not in content:
    # Add logic to check for similar messages
    insertion_point = content.find('// Check for rate limiting')
    if insertion_point > 0:
        new_code = '''    // Check for repetitive content
    const recentMessages = this.messageHistory.get(userId) || [];
    const similarCount = recentMessages.filter(msg => 
      msg.message === message || 
      (msg.message.length > 10 && msg.message === message)
    ).length;
    
    if (similarCount >= 3) {
      return true; // Spam detected - repetitive content
    }

'''
        content = content[:insertion_point] + new_code + content[insertion_point:]

with open('/root/dex/anubis/src/services/security-filter.ts', 'w') as f:
    f.write(content)

print("Fixed spam detection")
