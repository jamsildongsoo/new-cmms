import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Modules expose only their index.ts; shared stays free of modules.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/modules/auth/*',
                '@/modules/approvals/*',
                '@/modules/attachments/*',
                '@/modules/codes/*',
                '@/modules/organization/*/*',
                '@/modules/maintenance/*/*',
              ],
              message: 'Import other modules only through their index.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/app/*', '@/layout/*'],
              message: 'shared must not depend on modules, app or layout.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/layout/*'],
              message: 'modules must not depend on app or layout.',
            },
            {
              group: [
                '@/modules/auth/*',
                '@/modules/approvals/*',
                '@/modules/attachments/*',
                '@/modules/codes/*',
                '@/modules/organization/*/*',
                '@/modules/maintenance/*/*',
              ],
              message: 'Import other modules only through their index.ts.',
            },
          ],
        },
      ],
    },
  },
])
