import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The game simulations play hundreds of games; a busy CI runner can take several times longer than
    // a desktop, and the 5 s default once failed the v0.2.0 tag build (D-084).
    testTimeout: 60_000,
  },
});
