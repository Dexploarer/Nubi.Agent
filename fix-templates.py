#!/usr/bin/env python3
with open('/root/dex/anubis/src/nubi-character.ts', 'r') as f:
    lines = f.readlines()

# Find where templates starts
templates_start = None
for i, line in enumerate(lines):
    if '  templates: {' in line:
        templates_start = i
        break

if templates_start:
    # The templates object is not properly nested - it's after the export
    # We need to move it inside the character definition
    
    # Find the export line
    export_line = None
    for i, line in enumerate(lines):
        if 'export default nubiCharacter;' in line:
            export_line = i
            break
    
    if export_line and templates_start > export_line:
        # This is the problem - templates is defined after the export
        # We need to remove these floating template definitions
        # and properly integrate them into the character object
        
        # Remove the floating templates section (lines after export)
        lines_to_keep = lines[:export_line+1]
        
        # Add proper exports
        lines_to_keep.append('\n')
        lines_to_keep.append('// Export templates for use in other modules\n')
        lines_to_keep.append('export const nubiTemplates = {\n')
        
        # Extract the template content
        in_templates = False
        brace_count = 0
        for i in range(templates_start, len(lines)):
            line = lines[i]
            if 'templates: {' in line:
                in_templates = True
                brace_count = 1
                continue
            elif in_templates:
                if '{' in line:
                    brace_count += line.count('{')
                if '}' in line:
                    brace_count -= line.count('}')
                if brace_count == 0:
                    lines_to_keep.append(line)
                    break
                lines_to_keep.append(line)
        
        # Close the file properly
        if not lines_to_keep[-1].endswith(';\n'):
            lines_to_keep[-1] = lines_to_keep[-1].rstrip() + ';\n'
        
        # Add any remaining important lines (like delete statements)
        for line in lines[export_line+1:]:
            if 'delete' in line or '//' in line:
                lines_to_keep.append(line)
        
        with open('/root/dex/anubis/src/nubi-character.ts', 'w') as f:
            f.writelines(lines_to_keep)
        
        print("Fixed templates structure")
    else:
        print("Export/templates order seems OK")
else:
    print("Could not find templates definition")
