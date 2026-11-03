import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src-phaser',
  base: './',
  publicDir: '../public',
  build: { outDir: '../dist-phaser', emptyOutDir: false },
  server: { open: false, port: 5174, strictPort: true },
  preview: { open: false, port: 4174, strictPort: true },
})
