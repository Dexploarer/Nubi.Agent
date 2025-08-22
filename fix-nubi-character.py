#!/usr/bin/env python3
import re

with open('/root/dex/anubis/src/nubi-character.ts', 'r') as f:
    content = f.read()

# Find the problematic section around line 466-487
# The issue is that these are inside an object literal, so they need commas not semicolons
lines = content.split('\n')

# Find and fix the section
for i in range(len(lines)):
    if i >= 465 and i <= 490:
        print(f"Line {i+1}: {lines[i][:60]}...")

# The templates are properties in an object, so they need commas
# Let's fix the nubi-character.ts properly
fixed_content = content.replace(
    '''    shouldRespondTemplate: `Determine if {{agentName}} should respond.
{{providers}}

Respond if:
- Direct message or @mention
- Question directed at agent
- Community needs help
- Topic is relevant to expertise

Don't respond if:
- Security blocked the message
- Already responded recently to same user
- Message is spam or low quality`,

    // Continue conversation template
    continueTemplate: `Continue the conversation as {{agentName}}.
{{providers}}

Previous context considered. 
Keep momentum, add value, stay engaged.
Ancient wisdom meets modern community building.`,
};''',
    '''    shouldRespondTemplate: `Determine if {{agentName}} should respond.
{{providers}}

Respond if:
- Direct message or @mention
- Question directed at agent
- Community needs help
- Topic is relevant to expertise

Don't respond if:
- Security blocked the message
- Already responded recently to same user
- Message is spam or low quality`,

    // Continue conversation template
    continueTemplate: `Continue the conversation as {{agentName}}.
{{providers}}

Previous context considered. 
Keep momentum, add value, stay engaged.
Ancient wisdom meets modern community building.`
};'''
)

with open('/root/dex/anubis/src/nubi-character.ts', 'w') as f:
    f.write(fixed_content)

print("Fixed nubi-character.ts")
