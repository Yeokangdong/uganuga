import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    open: false,
    // Pixelorama writes source art atomically; Windows can lock these large files.
    watch: { ignored: ['**/art-src/**', '**/tools/**', '**/codex/**'] },
  },
})
