// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const lines = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-lines-per-function': lines(60),
      'max-lines': lines(400),
    },
  },
  {
    // Screens and components are mostly markup, so they get more lines.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'max-lines-per-function': lines(100),
    },
  },
  {
    files: ['src/test/**', '**/__mocks__/**'],
    rules: {
      complexity: 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-lines': 'off',
    },
  },
]);
