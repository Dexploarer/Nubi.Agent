#!/usr/bin/env python3
with open('/root/dex/anubis/src/utils/error-handler.ts', 'r') as f:
    content = f.read()

# Fix the malformed logger calls
import re

# Fix patterns like logger.warn(`[$JSON.stringify({serviceName}] ...
content = re.sub(
    r'logger\.(error|warn|info)\(`\[\$JSON\.stringify\(\{(.*?)\}\)(.*?)`',
    r'logger.\1(`[${JSON.stringify({\2})}]\3`',
    content
)

# Also fix any remaining object-as-string issues
content = re.sub(
    r'logger\.(error|warn|info)\((.*?),\s*\{([^}]+)\}\)',
    r'logger.\1(\2, JSON.stringify({\3}))',
    content
)

with open('/root/dex/anubis/src/utils/error-handler.ts', 'w') as f:
    f.write(content)

print("Fixed error handler syntax")
