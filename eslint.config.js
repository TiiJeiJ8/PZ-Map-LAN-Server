import globals from 'globals'
import js from '@eslint/js'
import vueParser from 'vue-eslint-parser'

export default [
  { ignores: ['out/**', 'release/**', 'node_modules/**'] },
  js.configs.recommended,
  { files: ['**/*.js'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.vue'], languageOptions: { parser: vueParser, globals: { ...globals.browser, ...globals.node } } }
]
