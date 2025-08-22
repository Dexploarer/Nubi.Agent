import plugin from './src/plugins/nubi-plugin.js';

if (plugin.actions) {
  plugin.actions.forEach((action, index) => {
    if (!action.examples) {
      console.log(`Action without examples: ${action.name} (index ${index})`);
    }
  });
  console.log(`Total actions: ${plugin.actions.length}`);
} else {
  console.log('No actions found');
}