import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import importPlugin from 'eslint-plugin-import';
import importHelpers from 'eslint-plugin-import-helpers';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'import': importPlugin,
      'import-helpers': importHelpers,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'yoda': ['error', 'always'],
      'prefer-const': 'warn',
      'arrow-parens': ['error', 'always'],
      'no-irregular-whitespace': 'error',
      'no-var': 'error',
      'no-empty': 'warn',
      'no-duplicate-imports': 'warn',
      'no-extra-semi': 'warn',
      'no-extra-parens': ['warn', 'functions'],
      'no-unused-expressions': ['warn', { allowShortCircuit: true }],
      'no-useless-rename': 'warn',
      'no-mixed-operators': 'warn',
      'no-lonely-if': 'warn',
      'no-lone-blocks': 'warn',
      'no-trailing-spaces': 'warn',// Impede espaços no final das linhas
      'no-multi-spaces': 'error', // Impede múltiplos espaços desnecessários
      'no-whitespace-before-property': 'error', // Impede espaços antes de propriedades de objetos
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0 }],// Impede múltiplas linhas vazias
      'indent': ['error', 4, { SwitchCase: 1 }],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'object-property-newline': ['warn', { allowAllPropertiesOnSameLine: true }],
      'comma-dangle': ['warn', 'always-multiline'],
      'eol-last': ['error', 'always'],
      'linebreak-style': ['error', 'unix'],
      'eqeqeq': ['error', 'smart'],
      'prefer-template': 'warn',
      'template-curly-spacing': ['warn', 'never'],
      'template-tag-spacing': 'warn',
      'block-spacing': 'warn',
      'dot-notation': 'warn',
      'curly': ['warn', 'all'],
      'function-call-argument-newline': ['warn', 'consistent'],
      'func-call-spacing': 'warn',
      'prefer-arrow-callback': ['warn', { allowNamedFunctions: true }],
      'max-statements-per-line': 'warn',
      'newline-per-chained-call': 'warn',
      'prefer-exponentiation-operator': 'warn',
      'prefer-rest-params': 'warn',
      'prefer-spread': 'warn',
      'quote-props': ['warn', 'consistent-as-needed'],
      'import-helpers/order-imports': [
        'warn',
        {
          newlinesBetween: 'always',
          groups: [
            '/^react/',
            '/^antd/',
            'module',
            '/^@shared/',
            ['parent', 'sibling', 'index'],
          ],
          alphabetize: { order: 'asc', ignoreCase: true },
        },
],}
  },
]);
