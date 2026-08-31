import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config.
 *
 * Kept deliberately small. Formatting is Prettier's job, so nothing here
 * duplicates it — the rules below only cover things that are actually bugs or
 * that TypeScript cannot catch on its own.
 *
 * Note the split between rule blocks: type-aware rules (`no-floating-promises`,
 * `no-misused-promises`) can only run on files the TypeScript project service
 * actually covers. Declaring them globally makes ESLint crash the moment it
 * reaches a file outside any tsconfig, so they live in the same block that
 * turns the project service on.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/*.config.js',
      '**/babel.config.js',
      '**/metro.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- Rules that need no type information ---------------------------------
  {
    rules: {
      // Unused variables are usually a leftover or a typo. The underscore
      // escape hatch keeps intentionally-ignored destructured fields legal.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // `any` defeats the point of the strict compiler settings everywhere else.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ---- Type-aware rules, only where the project service reaches -------------
  {
    files: [
      'packages/*/src/**/*.ts',
      'packages/*/test/**/*.ts',
      'apps/mobile/src/**/*.{ts,tsx}',
      'apps/api/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // A floating promise is how an unhandled rejection reaches production.
      // `void expr` is the explicit way to say "fire and forget".
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // JSX handlers legitimately take async functions.
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // ---- React components -----------------------------------------------------
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Conditional or nested hooks corrupt React's hook ordering and produce
      // bugs that only appear on a re-render — worth failing the build over.
      'react-hooks/rules-of-hooks': 'error',
      // A stale closure over props is subtle and common enough that it earns a
      // warning, but there are legitimate reasons to omit a dep, so not an error.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ---- Node scripts ---------------------------------------------------------
  {
    files: ['**/scripts/**', '**/*.mjs', '**/prisma/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ---- Tests ----------------------------------------------------------------
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
