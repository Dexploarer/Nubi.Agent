// Quick test to verify the agent can be loaded
const { projectAgent } = require("./dist/src/index.js");

console.log("Character name:", projectAgent.character.name);
console.log("Character plugins:", projectAgent.character.plugins);
console.log(
  "Project plugins:",
  projectAgent.plugins?.map((p) => p.name),
);
console.log("✅ Agent configuration loaded successfully");
