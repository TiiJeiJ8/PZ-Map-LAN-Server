import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: { build: { lib: { entry: resolve(__dirname, 'electron/main/index.js') } } },
  preload: { build: { lib: { entry: resolve(__dirname, 'electron/preload/index.js') }, rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: { root: '.', plugins: [vue()], build: { rollupOptions: { input: resolve(__dirname, 'index.html') } } }
})
