import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src-phaser',
  base: './',
  publicDir: '../public',
  build: { outDir: '../dist-phaser', emptyOutDir: false,
    // Phaser 3 ships as one module; keep its stable vendor cache separate (1.6 MB budget).
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { open: false, port: 5174, strictPort: true },
  preview: { open: false, port: 4174, strictPort: true },
})
