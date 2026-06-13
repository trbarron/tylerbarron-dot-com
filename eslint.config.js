import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
  // Replaces the old `--ignore-path .gitignore`: build artifacts, generated
  // posts, and deploy output are not linted.
  {
    ignores: [
      'build/**',
      'public/**',
      'server/**',
      '.react-router/**',
      'app/posts/compiled/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      '.claude/**',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React + a11y + import rules for all source files.
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: 'detect' },
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', linkAttribute: 'to' },
        { name: 'NavLink', linkAttribute: 'to' },
      ],
      'import/internal-regex': '^~/',
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: { extensions: ['.ts', '.tsx'] },
      },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...importPlugin.flatConfigs.recommended.rules,
      ...importPlugin.flatConfigs.typescript.rules,

      // React Hooks recommended (set explicitly for version stability).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'import/no-named-as-default': 'off',
      'import/no-unresolved': ['error', { ignore: ['^\\./build/'] }],

      // Modernization: forbid inline styles.
      'react/forbid-dom-props': [
        'error',
        { forbid: [{ propName: 'style', message: 'Use Tailwind utility classes instead of inline styles' }] },
      ],

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Allow diagnostic warn/error; forbid leftover debug console.log.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Node scripts and config files: Node globals, console allowed.
  {
    files: ['scripts/**/*.{js,mjs,cjs}', '*.config.{js,ts,cjs,mjs}', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Tests: relax strictness.
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'import/no-unresolved': ['error', { ignore: ['vitest'] }],
    },
  },

  // Type declarations / shared type modules.
  {
    files: ['**/*.d.ts', '**/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
