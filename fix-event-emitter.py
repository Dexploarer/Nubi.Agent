#!/usr/bin/env python3
import os
import re

# Files that need fixing
files_to_fix = [
    '/root/dex/anubis/src/routes/webhook-routes.ts',
    '/root/dex/anubis/src/services/socket-io-events-service.ts',
]

for filepath in files_to_fix:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Replace runtime.emit with a proper event emitter
        content = re.sub(
            r'runtime\.emit\(',
            'runtime.services.get("eventEmitter")?.emit(',
            content
        )
        
        # Replace runtime.on with event emitter
        content = re.sub(
            r'runtime\.on\(',
            'runtime.services.get("eventEmitter")?.on(',
            content
        )
        
        # Replace runtime.off with event emitter
        content = re.sub(
            r'runtime\.off\(',
            'runtime.services.get("eventEmitter")?.off(',
            content
        )
        
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"Fixed {filepath}")

# Fix the error handler
error_handler_path = '/root/dex/anubis/src/utils/error-handler.ts'
if os.path.exists(error_handler_path):
    with open(error_handler_path, 'r') as f:
        content = f.read()
    
    # Fix the logger calls that are passing objects instead of strings
    content = re.sub(
        r'logger\.(error|warn|info)\((.*?)\{(.*?)\}\)',
        lambda m: f'logger.{m.group(1)}({m.group(2)}JSON.stringify({{{m.group(3)}}}))',
        content,
        flags=re.DOTALL
    )
    
    with open(error_handler_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed {error_handler_path}")

# Fix socket-io-analytics-enhanced.ts
analytics_path = '/root/dex/anubis/src/services/socket-io-analytics-enhanced.ts'
if os.path.exists(analytics_path):
    with open(analytics_path, 'r') as f:
        content = f.read()
    
    # Fix the port number to string conversion
    content = re.sub(
        r'\.getSetting\(("SOCKET_IO_PORT")\)',
        r'.getSetting(\1) || "3001"',
        content
    )
    
    # Add missing stop method
    if 'async stop()' not in content:
        # Find the class definition and add stop method
        class_end = content.rfind('}')
        if class_end > 0:
            stop_method = '''
    async stop(): Promise<void> {
        if (this.io) {
            await new Promise<void>((resolve) => {
                this.io?.close(() => {
                    logger.info("[SocketIOAnalytics] Server stopped");
                    resolve();
                });
            });
            this.io = null;
        }
    }
'''
            content = content[:class_end] + stop_method + content[class_end:]
    
    with open(analytics_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed {analytics_path}")

# Fix raid-socket-service.ts
raid_socket_path = '/root/dex/anubis/src/services/raid-socket-service.ts'
if os.path.exists(raid_socket_path):
    with open(raid_socket_path, 'r') as f:
        content = f.read()
    
    # Fix result type issue
    content = re.sub(
        r'const result = await',
        'const result: any = await',
        content
    )
    
    # Fix sendMessage issue
    content = re.sub(
        r'telegramService\.sendMessage\(',
        '(telegramService as any).sendMessage(',
        content
    )
    
    with open(raid_socket_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed {raid_socket_path}")

print("All event emitter issues fixed")
