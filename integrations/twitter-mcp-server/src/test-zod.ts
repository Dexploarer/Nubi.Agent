import * as zod from 'zod';

// Define a simple schema
const schema = zod.object({
  name: zod.string(),
  age: zod.number()
});

// Define an enum
const searchModes = ['Top', 'Latest', 'Photos', 'Videos'] as const;
const searchModeSchema = zod.string();

console.log('Schema:', schema);
console.log('Enum Schema:', searchModeSchema); 