import { createServer } from 'vite'
import { chromium } from 'playwright'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
// Explicit source-to-Tiled conversion command: node src-phaser/export-tiled.mjs
// Normal gameplay reads the authored .tmj files and never overwrites them.
const server = await createServer({ configFile: 'src-phaser/vite.config.ts', server: { host: '127.0.0.1', port: 5175, strictPort: true } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5175/?convert=1')
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('Title'))
  await page.keyboard.press('Space')
  await page.waitForFunction(() => window.__mapsReady || window.__mapError, {}, { timeout: 180000 })
  const result = await page.evaluate(() => ({ maps: window.__tiledMaps, checks: window.__tiledChecks, error: window.__mapError }))
  if (result.error) throw new Error(result.error)
  await mkdir('src-phaser/maps', { recursive: true })
  for (let i = 0; i < result.maps.length; i++) await writeFile(`src-phaser/maps/${String(i + 1).padStart(2, '0')}.tmj`, JSON.stringify(result.maps[i]))
  await copyFile('src-phaser/collision.svg', 'src-phaser/maps/collision.svg')
  console.log(JSON.stringify(result.checks))
} finally {
  await browser?.close()
  await server.close()
}
