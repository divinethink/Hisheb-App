import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'dev-dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  // Firebase compat নিষিদ্ধ (Dev Rule ৯) — সব ফাইলে
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['firebase/compat', 'firebase/compat/*'] }],
    },
  },
  // lib/ purity (Architecture Plan §০/§৪): React/Firebase/data import নিষিদ্ধ।
  // Flat config-এ একই rule পরেরটা পুরোটা override করে, তাই compat-pattern এখানেও আছে
  {
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom'],
          patterns: ['firebase', 'firebase/*', '**/data/*', 'firebase/compat/*'],
        },
      ],
    },
  },
);
