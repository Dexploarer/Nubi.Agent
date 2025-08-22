import fs from 'fs';

// Read the file
const filePath = 'src/services/elizaos-raid-service.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the config property declaration
content = content.replace(
    'private config: RaidConfig;',
    'private raidConfig: RaidConfig;'
);

// Replace all occurrences of this.config with this.raidConfig
content = content.replace(/this\.config\b/g, 'this.raidConfig');

// Write back
fs.writeFileSync(filePath, content);
console.log('Fixed raid service config property');
