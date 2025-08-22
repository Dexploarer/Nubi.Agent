#!/usr/bin/env python3
with open('/root/dex/anubis/src/utils/error-handler.ts', 'r') as f:
    lines = f.readlines()

# Find and fix the logError method
fixed_lines = []
skip_lines = False
in_log_error = False
log_error_fixed = False

for i, line in enumerate(lines):
    if 'private static logError(error: ServiceError): void {' in line:
        in_log_error = True
        fixed_lines.append(line)
        # Add the fixed method body
        fixed_lines.append('    logger.error(\n')
        fixed_lines.append('      `[${error.service}] ${error.method} failed: ${error.error.message}`,\n')
        fixed_lines.append('      JSON.stringify({\n')
        fixed_lines.append('        stack: error.error.stack,\n')
        fixed_lines.append('        context: error.context,\n')
        fixed_lines.append('        correlationId: error.correlationId,\n')
        fixed_lines.append('      })\n')
        fixed_lines.append('    );\n')
        fixed_lines.append('  }\n')
        skip_lines = True
        log_error_fixed = True
    elif skip_lines and in_log_error:
        # Skip the broken lines until we find the closing brace
        if line.strip() == '}' and not log_error_fixed:
            skip_lines = False
            in_log_error = False
        elif line.strip() == '' and log_error_fixed:
            skip_lines = False
            in_log_error = False
            fixed_lines.append(line)
    else:
        fixed_lines.append(line)

with open('/root/dex/anubis/src/utils/error-handler.ts', 'w') as f:
    f.writelines(fixed_lines)

print("Fixed error-handler.ts")
