/* eslint-env node */
const expoConfig = require('eslint-config-expo/flat');
const reactCompiler = require('eslint-plugin-react-compiler');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const i18next = require('eslint-plugin-i18next');

module.exports = [
  ...expoConfig,
  reactCompiler.configs.recommended,
  {
    ignores: ['dist/*', '.expo/**', 'packages/remote-ui/**', 'packages/e2e-addon/**'],
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // --- Existing ---
      'react/display-name': 'off',

      // --- Import ordering (AGENTS.md §4) ---
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. React / React Native
            ['^react', '^react-native', '^react-dom'],
            // 2. External packages
            ['^@?\\w'],
            // 3. Internal aliases (@/*)
            ['^@/'],
            // 4. Relative imports
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // --- No legacy Animated API (AGENTS.md §12) ---
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Animated'],
              message: 'Use react-native-reanimated or Moti instead of the legacy Animated API.',
            },
          ],
        },
      ],

      // --- Console usage — use debug helpers instead (AGENTS.md §7) ---
      'no-console': ['error', { allow: ['error'] }],

      // --- JS best practices ---
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Component length warning (AGENTS.md §8: ~200 lines)
  {
    files: ['src/components/**/*.tsx'],
    rules: {
      'max-lines-per-function': ['warn', { max: 220, skipComments: true, skipBlankLines: true }],
    },
  },
  // i18n and theme tokens (AGENTS.md invariants: no hardcoded UI copy, Restyle tokens only).
  // Brand names are not translatable copy.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    plugins: {
      i18next,
    },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          words: {
            exclude: [
              // Plugin defaults (numbers/symbols, ALL_CAPS, emoji)…
              '[0-9!-/:-@[-`{-~]+',
              '[A-Z_-]+',
              /^\p{Emoji}+$/u,
              // Decorative separators and dashes rendered as JSX text.
              '•',
              '—',
              // …plus brand names, which are not translatable copy.
              'DodoStream',
              'IMDb',
            ],
          },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\()/]',
          message: 'Use Restyle theme tokens from src/theme/theme.ts instead of hardcoded colors.',
        },
      ],
    },
  },
  // Allow console in build scripts, debug logger, and E2E tests
  {
    files: ['plugins/**', 'src/utils/debug.ts', 'scripts/sync-e2e/**'],
    rules: {
      'no-console': 'off',
    },
  },
];
