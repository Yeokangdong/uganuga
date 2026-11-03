import Phaser from 'phaser'
import { convertLevel, sourceLevel, verifyRoundTrip, type MapData } from './tiled'
import collisionUrl from './collision.svg?url'
const stored = import.meta.glob('./maps/*.tmj', { query: '?url', import: 'default', eager: true }) as Record<string, string>
export class MapScene extends Phaser.Scene {
  constructor() { super('Maps') }
  create() { void this.prepare().catch(error => { this.add.text(20, 470, String(error), { color: '#ff7777', fontSize: '14px', wordWrap: { width: 920 } }); Object.assign(window, { __mapError: String(error) }) }) }
  private async prepare() {
    const status = this.add.text(20, 12, 'TILED / 15 STAGES — loading corrected runtime geometry', { fontSize: '17px', color: '#ffe7a4' })
    const convert = new URLSearchParams(location.search).has('convert')
    const maps: MapData[] = [], checks: unknown[] = []
    for (let i = 0; i < 15; i++) {
      status.setText(`TILED / 15 STAGES — ${i + 1}/15`)
      const level = await sourceLevel(i)
      const url = stored[`./maps/${String(i + 1).padStart(2, '0')}.tmj`]
      if (!convert && !url) throw new Error(`Missing Tiled map ${i + 1}`)
      const map: MapData = convert ? convertLevel(level) : await fetch(url!).then(r => { if (!r.ok) throw new Error(url); return r.json() })
      checks.push(verifyRoundTrip(level, map)); maps.push(map)
      const x = 20 + i % 3 * 314, y = 48 + Math.floor(i / 3) * 74
      const cv = document.createElement('canvas'); cv.width = 600; cv.height = 90
      cv.getContext('2d')!.drawImage(level.canvas, 0, 0, 600, 90)
      this.textures.addCanvas(`map-art-${i}`, cv)
      this.add.text(x, y, `${String(i + 1).padStart(2, '0')}  ${level.def.sub}`, { fontSize: '11px', color: '#e4e9d5' })
      this.add.image(x, y + 17, `map-art-${i}`).setOrigin(0).setDisplaySize(300, 45).setInteractive().on('pointerdown', () => this.showMap(maps[i]!, i))
      if (i === 0) {
        const detail = document.createElement('canvas'); detail.width = 960; detail.height = 384
        detail.getContext('2d')!.drawImage(level.canvas, 0, 0, 960 * level.scale, 384 * level.scale, 0, 0, 960, 384)
        this.textures.addCanvas('detail-art', detail)
      }
      level.canvas.width = 1; level.canvas.height = 1
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    status.setText('TILED / 15 STAGES — coordinate + count round trips PASS')
    this.load.image('collision-tiles', collisionUrl)
    this.load.once('complete', () => {
      this.showMap(maps[0]!, 0)
      Object.assign(window, { __tiledMaps: maps, __tiledChecks: checks, __mapsReady: true })
    })
    this.load.start()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.activeMap?.destroy()
      for (let i = 0; i < 15; i++) this.textures.remove(`map-art-${i}`)
      this.textures.remove('detail-art')
    })
  }
  private detail: Phaser.GameObjects.Container | undefined
  private activeMap: Phaser.Tilemaps.Tilemap | undefined
  private showMap(data: MapData, index: number) {
    this.detail?.destroy(true); this.activeMap?.destroy()
    const group = this.add.container(20, 438); this.detail = group
    group.add(this.add.text(0, -14, `${String(index + 1).padStart(2, '0')} / first 60 columns: terrain + one-way + water / ladders / spawns / doors / anchors`, { fontSize: '10px', color: '#ffe7a4' }))
    const key = `tiled-stage-${index}`
    if (!this.cache.tilemap.exists(key)) this.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data })
    const map = this.make.tilemap({ key }); this.activeMap = map
    const set = map.addTilesetImage('collision', 'collision-tiles')!
    const layer = map.createLayer('Terrain', set, 0, 0)!
    layer.setCollision([1, 3])
    // One-way platforms retain a separate tile kind; movement is stage 3.
    layer.setScale(.23).setAlpha(.7)
    if (index === 0) group.add(this.add.image(0, 0, 'detail-art').setOrigin(0).setScale(.23))
    group.add(layer)
    const maskGraphics = this.make.graphics({ x: 20, y: 438 }).fillRect(0, 0, 221, 89)
    const mask = maskGraphics.createGeometryMask(); layer.setMask(mask)
    group.once('destroy', () => { mask.destroy(); maskGraphics.destroy() })
    const g = this.add.graphics(); group.add(g)
    for (const [name, color] of [['Ladders', 0xffb94a], ['Spawns', 0xffffff], ['Doors', 0xff5fa1], ['Anchors', 0x40ffcc], ['Cliffs', 0xff6040]] as const) {
      for (const o of map.getObjectLayer(name)?.objects ?? []) {
        if ((o.x ?? 0) >= 960) continue
        g.lineStyle(1, color, 1)
        if (name === 'Ladders') g.strokeRect(o.x! * .23, o.y! * .23, 16 * .23, 16 * .23)
        else g.strokeCircle(o.x! * .23, o.y! * .23, 2)
      }
    }
    group.add(this.add.text(245, 10, `Map: ${data.width} × ${data.height}\nTiled layers: ${data.layers.length}\nClick a stage above to inspect collision and objects.\nGreen: solid · Yellow: one-way · Blue: water\nOrange: ladder · White: spawn · Pink: door · Mint: anchor`, { fontSize: '12px', color: '#d9e6da', lineSpacing: 4 }))
  }
}
