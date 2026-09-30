import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA: manifest + service worker অটো-জেনারেট। registerType 'prompt' — auto-reload
// হয় না; src/pwa/register.ts-এ dirty-check করে তবেই আপডেট প্রয়োগ হয়।
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Firebase Auth নিজের ডোমেইনে (authDomain = hosting ডোমেইন) /__/auth/handler ও /__/auth/iframe
      // serve করে — এই reserved path SW-এর index.html-fallback-এ পড়লে Google sign-in popup ভেঙে যায়।
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'হিসাব-নিকাশ',
        short_name: 'হিসাব-নিকাশ',
        description: 'Personal finance tracker',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // G5: হোম-স্ক্রিন long-press শর্টকাট; AppShell `?action=add-expense` পড়ে Add sheet খোলে
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Add Expense',
            description: 'Add a new transaction',
            url: '/?action=add-expense',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
});
