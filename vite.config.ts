import { defineConfig } from 'vite';

// Renderer build (spec runtimes/electron.md). Relative base so index.html loads via file://.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'chrome140',
  },
  server: { port: 5173, strictPort: true },
});
