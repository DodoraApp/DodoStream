import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    ignores: ['dist/**'],
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. React / React DOM
            ['^react', '^react-dom'],
            // 2. External packages
            ['^@?\\w'],
            // 3. Internal aliases (@app/*)
            ['^@app/'],
            // 4. Relative imports
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'prefer-optional-chaining': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['error', { allow: ['error'] }],
    },
  },
];
