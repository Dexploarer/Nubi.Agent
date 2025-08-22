#!/usr/bin/env python3
with open('/root/dex/anubis/src/core/nubi-raid-system.ts', 'r') as f:
    content = f.read()

# Fix the missing 'view' in points config
content = content.replace(
    'quote: number;',
    'quote: number;\n        view: number;'
)

# Fix the usage at line 764 - add view to the points object
content = content.replace(
    '''            quote: 3,
        },''',
    '''            quote: 3,
            view: 1,
        },'''
)

# Fix Supabase raw API calls - use rpc instead
content = content.replace('.raw(', '.rpc(')

# Fix the Content type issues - check for proper type usage
import re

# Fix boolean to Content type issues
pattern = r'\.createMemory\((.*?),\s*(true|false)\)'
def replace_bool_content(match):
    return f'.createMemory({match.group(1)}, {{ text: "Raid action performed" }})'

content = re.sub(pattern, replace_bool_content, content)

# Fix userId property access on Memory - use proper field
content = content.replace('.userId', '.user?.id || ""')

# Fix ActionExample 'user' property - should be 'userId'
content = content.replace('"user":', '"userId":')

# Fix text possibly undefined issues
content = content.replace(
    'const text = message.content?.text;',
    'const text = message.content?.text || "";'
)

content = content.replace(
    'if (text.toLowerCase()',
    'if (text && text.toLowerCase()'
)

with open('/root/dex/anubis/src/core/nubi-raid-system.ts', 'w') as f:
    f.write(content)

print("Fixed nubi-raid-system.ts compilation errors")
