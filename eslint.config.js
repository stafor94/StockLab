import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', '.cache/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'scripts/**/*.ts', 'config/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
