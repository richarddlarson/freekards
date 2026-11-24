import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Renderer build (spec runtimes/electron.md). Relative base so index.html loads via file://.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'chrome140',
  },
  // Content (spec/content) and assets (assets/) live outside the renderer root (D-031).
  server: { port: 5173, strictPort: true, fs: { allow: [repoRoot] } },
});
