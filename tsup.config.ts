import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  tsconfig: './tsconfig.build.json', // Use build-specific tsconfig
  sourcemap: true,
  clean: false,
  format: ['esm'], // Ensure you're targeting CommonJS
  dts: true, // require DTS so we get d.ts in the dist folder on npm
  external: [
    '@elizaos/core',
    '@elizaos/plugin-*',
  ],
});
