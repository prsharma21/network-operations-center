import js from '@eslint/js'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // TypeScript already enforces unused locals/parameters and types.
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
]
