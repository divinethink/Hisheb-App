import { defineConfig } from 'vitest/config';

// Firestore rules test — শুধু Emulator-এর ভেতরে চলে (npm run test:rules)
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], testTimeout: 20000, hookTimeout: 30000 },
});
