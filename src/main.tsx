import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { checkCurrentEnv } from './config/env';
import ConfigError from './config/ConfigError';
import { registerPwa } from './pwa/register';
import { captureInstallPrompt } from './pwa/install';
import { initTheme } from './theme/applyTheme';

initTheme(); // প্রথম paint-এর আগে cache/system অনুযায়ী Light/Dark
const root = createRoot(document.getElementById('root')!);
const env = checkCurrentEnv();

if (!env.ok) {
  // Fail-fast: Firebase লোডই হয় না, স্পষ্ট তালিকা দেখায়
  root.render(<ConfigError missing={env.missing} />);
} else {
  // Firebase SDK আলাদা chunk-এ, config ঠিক থাকলেই লোড (boot হালকা রাখতে)
  void import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}

registerPwa();
captureInstallPrompt();
