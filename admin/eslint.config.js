import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const lines = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-lines-per-function': lines(60),
      'max-lines': lines(400),
    },
  },
  {
    // Pages and components are mostly markup, so they get more lines.
    files: ['src/pages/**/*.tsx', 'src/components/**/*.tsx'],
    rules: { 'max-lines-per-function': lines(100) },
  },
  {
    files: ['src/test/**'],
    rules: {
      complexity: 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-lines': 'off',
    },
  },
);
