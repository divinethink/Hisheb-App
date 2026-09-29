import { defineConfig } from 'vitest/config';

export default defineConfig({
  // UI টেস্ট ফাইলে `// @vitest-environment jsdom` কমেন্ট দিয়ে jsdom চালু হয়
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
