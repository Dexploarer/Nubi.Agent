#!/usr/bin/env python3
with open('/root/dex/anubis/src/nubi-character.ts', 'r') as f:
    lines = f.readlines()

# Find the export default line
export_line = None
for i, line in enumerate(lines):
    if 'export default nubiCharacter;' in line:
        export_line = i
        break

if export_line:
    # Keep everything up to and including the export
    clean_lines = lines[:export_line+1]
    
    # Add a newline
    clean_lines.append('\n')
    
    # Import the templates
    import_line = 'import { nubiTemplates } from "./nubi-templates";\n'
    # Insert at the top with other imports
    clean_lines.insert(1, import_line)
    
    # Add the template exports
    clean_lines.append('// Export templates for use in other modules\n')
    clean_lines.append('export { nubiTemplates } from "./nubi-templates";\n')
    clean_lines.append('\n')
    
    # Find and keep any delete statements from the original
    for line in lines[export_line+1:]:
        if 'delete' in line and 'nubiCharacter' in line:
            clean_lines.append(line)
    
    with open('/root/dex/anubis/src/nubi-character.ts', 'w') as f:
        f.writelines(clean_lines)
    
    print("Cleaned up nubi-character.ts")

