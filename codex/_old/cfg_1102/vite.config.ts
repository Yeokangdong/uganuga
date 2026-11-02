import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { emptyOutDir: true },
  server: {
    port: 5173,
    open: true,
    // Pixelorama writes source art atomically; Windows can lock these large files.
    watch: { ignored: ['**/art-src/**', '**/tools/**', '**/codex/**'] },
  },
})
