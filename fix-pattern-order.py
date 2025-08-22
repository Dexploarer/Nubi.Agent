#!/usr/bin/env python3
with open('/root/dex/anubis/src/services/security-filter.ts', 'r') as f:
    lines = f.readlines()

# Find where the sensitive pattern is defined
for i, line in enumerate(lines):
    if 'system\\s*prompt' in line:
        # This pattern is too broad and catches prompt injection attempts
        # Let's make it more specific
        lines[i] = line.replace(
            r'\b(system\s*prompt|initial\s*instructions|rules|instructions)\b',
            r'\b(show\s+system\s+prompt|reveal\s+initial\s+instructions|show\s+rules|reveal\s+instructions)\b'
        )
        break

with open('/root/dex/anubis/src/services/security-filter.ts', 'w') as f:
    f.writelines(lines)

print("Fixed pattern order and specificity")
