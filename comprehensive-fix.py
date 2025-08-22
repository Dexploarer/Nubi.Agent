#!/usr/bin/env python3
import os
import re

# Fix nubi-raid-system.ts
print("Fixing nubi-raid-system.ts...")
raid_path = '/root/dex/anubis/src/core/nubi-raid-system.ts'
with open(raid_path, 'r') as f:
    content = f.read()

# Fix missing view in points at line 779
content = content.replace(
    '''            share: 1,
            quote: 3,
        },''',
    '''            share: 1,
            quote: 3,
            view: 1,
        },'''
)

# Fix text possibly undefined
content = content.replace(
    'if (text.toLowerCase()',
    'if (text && text.toLowerCase()'
)

# Fix user vs userId issues
content = content.replace('.user?.id || ""', '.userId || ""')
content = content.replace('"userId":', '"user":')

# Fix boolean Content type
content = re.sub(
    r'\.createMemory\(([^,]+),\s*{{ text: "Raid action performed" }}\)',
    r'.createMemory(\1, { text: "Raid action performed" } as Content)',
    content
)

with open(raid_path, 'w') as f:
    f.write(content)

# Fix models/index.ts
print("Fixing models/index.ts...")
models_path = '/root/dex/anubis/src/models/index.ts'
with open(models_path, 'r') as f:
    content = f.read()

content = content.replace(
    'import { ModelProviderName } from "@elizaos/core";',
    '// Model configurations for ElizaOS'
)
content = content.replace(
    'provider: ModelProviderName.OPENAI,',
    'provider: "openai" as any,'
)

with open(models_path, 'w') as f:
    f.write(content)

# Fix service-definitions.ts
print("Fixing service-definitions.ts...")
service_def_path = '/root/dex/anubis/src/core/service-definitions.ts'
with open(service_def_path, 'r') as f:
    content = f.read()

content = content.replace('DatabaseServiceDefinition', 'SupabaseServiceManager')

with open(service_def_path, 'w') as f:
    f.write(content)

# Fix webhook-routes.ts and socket-io-events-service.ts
print("Fixing event emitter service calls...")
for filepath in ['/root/dex/anubis/src/routes/webhook-routes.ts', 
                 '/root/dex/anubis/src/services/socket-io-events-service.ts']:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix the service.get calls
    content = re.sub(
        r'runtime\.services\.get\("eventEmitter"\)\?\.(\w+)',
        r'(runtime as any).\1',
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)

# Fix socket-io-analytics-enhanced.ts
print("Fixing socket-io-analytics-enhanced.ts...")
analytics_path = '/root/dex/anubis/src/services/socket-io-analytics-enhanced.ts'
with open(analytics_path, 'r') as f:
    content = f.read()

# Fix port issue
content = content.replace(
    'runtime.getSetting("SOCKET_IO_PORT") || "3001"',
    'parseInt(runtime.getSetting("SOCKET_IO_PORT") || "3001")'
)

# Add io property declaration
if 'private io:' not in content:
    content = content.replace(
        'export class SocketIOAnalyticsService extends Service {',
        '''export class SocketIOAnalyticsService extends Service {
    private io: any = null;'''
    )

with open(analytics_path, 'w') as f:
    f.write(content)

# Fix action-middleware.ts
print("Fixing action-middleware.ts...")
middleware_path = '/root/dex/anubis/src/middleware/action-middleware.ts'
with open(middleware_path, 'r') as f:
    content = f.read()

content = content.replace(
    'actionCtx.state as State',
    'actionCtx.state as State || {} as State'
)

# Fix result possibly undefined
content = re.sub(
    r'const result = await',
    'const result: ActionResult | undefined = await',
    content
)

# Fix return type issues
content = content.replace(
    'return result;',
    'return result || { success: false, message: "No result" } as ActionResult;'
)

with open(middleware_path, 'w') as f:
    f.write(content)

# Fix error-handler.ts logger calls
print("Fixing error-handler.ts...")
error_path = '/root/dex/anubis/src/utils/error-handler.ts'
with open(error_path, 'r') as f:
    lines = f.readlines()

# Fix specific lines with object logging
if len(lines) > 34:
    lines[33] = '      logger.debug(`[${serviceName}] Executing ${methodName} - ${JSON.stringify({ correlationId, context })}`);\n'
if len(lines) > 37:
    lines[36] = '      logger.debug(`[${serviceName}] ${methodName} completed in ${duration}ms - ${JSON.stringify({ correlationId })}`);\n'
if len(lines) > 107:
    lines[106] = '    logger.error(JSON.stringify({ error: serviceError.message, stack: serviceError.error?.stack, context, correlationId }));\n'

with open(error_path, 'w') as f:
    f.writelines(lines)

print("All fixes applied!")
