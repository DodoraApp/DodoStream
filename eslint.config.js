/* eslint-env node */
const expoConfig = require('eslint-config-expo/flat');
const reactCompiler = require('eslint-plugin-react-compiler');
const simpleImportSort = require('eslint-plugin-simple-import-sort');

module.exports = [
  ...expoConfig,
  reactCompiler.configs.recommended,
  {
    ignores: ['dist/*', '.expo/**', 'remote-ui/**'],
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
  // Allow console in build scripts and the debug logger itself
  {
    files: ['plugins/**', 'src/utils/debug.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
