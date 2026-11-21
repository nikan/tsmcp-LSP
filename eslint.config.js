// Flat ESLint config: TypeScript + naming conventions (handbook/02). No Vue: this project has no UI.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/*.d.ts',
      '.scratch/**',
      'tests/fixtures/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Plain JS config files and scripts run on Node.
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        // Types PascalCase; ports keep their I prefix (IUserRepository), which PascalCase allows.
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
        // Object keys often mirror external formats (headers, DB rows, i18n keys).
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],
    },
  },

  // Tests: allow console and looser typing helpers.
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'e2e/**'],
    rules: { 'no-console': 'off' },
  },

  prettier,
);
