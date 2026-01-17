import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'katex'],
  treeshake: true,
  minify: false,
  onSuccess: async () => {
    // Copy CSS file to dist
    mkdirSync('dist', { recursive: true });
    copyFileSync('src/styles/math-field.css', 'dist/styles.css');
    console.log('CSS copied to dist/styles.css');
  },
});
