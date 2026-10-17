import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'vendor/**',
      'prototypes/**',
      'dist/**',
      '.local/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  {
    files: [
      'scripts/**/*.mjs',
      'tests/**/*.mjs',
      'tests/**/*.js',
      '*.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
  { files: ['scripts/**/*.mjs'], rules: { 'no-console': 'off' } },
];
