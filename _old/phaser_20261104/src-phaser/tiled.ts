import { Level } from '../src/game/level'
import { STAGES } from '../src/game/stages'
import { TILE } from '../src/game/constants'
import { loadStageArt } from '../src/game/art'

type Property = { name: string; type: string; value: string }
type Obj = { id: number; name: string; type: string; x: number; y: number; width: number; height: number; properties: Property[] }
export type MapData = ReturnType<typeof convertLevel>
const properties = (value: unknown): Property[] => [{ name: 'source', type: 'string', value: JSON.stringify(value) }]
export function convertLevel(level: Level) {
  let id = 1
  const objects = (name: string, entries: { x: number; y: number; width?: number; height?: number; source: unknown }[]) => ({
    id: id++, name, type: 'objectgroup' as const, opacity: 1, visible: true, x: 0, y: 0,
    objects: entries.map(e => ({ id: id++, name, type: name, x: e.x, y: e.y, width: e.width ?? 0, height: e.height ?? 0, rotation: 0, visible: true, properties: properties(e.source) })),
  })
  const cells = (data: ArrayLike<number>) => Array.from(data, (v, i) => ({ x: i % level.cols * TILE, y: Math.floor(i / level.cols) * TILE, width: TILE, height: TILE, source: v })).filter(e => e.source !== 0)
  const result = {
    type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: level.cols, height: level.rows, tilewidth: TILE, tileheight: TILE, nextlayerid: 20, nextobjectid: 100000,
    properties: properties(level.def),
    tilesets: [{ firstgid: 1, name: 'collision', tilewidth: TILE, tileheight: TILE, tilecount: 5, columns: 5, image: 'collision.svg', imagewidth: 80, imageheight: 16,
      tiles: [1, 2, 3, 4, 5].map(v => ({ id: v - 1, properties: [{ name: 'kind', type: 'int', value: v }, { name: 'collides', type: 'bool', value: v === 1 || v === 3 }, { name: 'oneWay', type: 'bool', value: v === 2 }] })) }],
    layers: [
      { id: id++, name: 'Terrain', type: 'tilelayer' as const, width: level.cols, height: level.rows, x: 0, y: 0, opacity: 1, visible: true, data: Array.from(level.tiles) },
      objects('Ladders', cells(level.ladders)), objects('Caves', cells(level.cave)),
      objects('Spawns', level.spawns.map(s => ({ x: s.col * TILE, y: s.row * TILE, source: s }))),
      objects('Doors', level.spawns.filter(s => s.kind === 'D').map(s => ({ x: s.col * TILE, y: s.row * TILE, source: s }))),
      objects('Anchors', level.patternAnchors.map(a => ({ ...a, source: a }))),
      objects('Cliffs', level.patternCliffs.map(a => ({ ...a, source: a }))),
      objects('Arena', [{ x: level.arenaX, y: 0, width: level.width - level.arenaX, height: level.height, source: { arenaCol: level.arenaCol } }]),
    ],
  }
  result.nextlayerid = id
  result.nextobjectid = id
  return result
}
export function verifyRoundTrip(level: Level, map: MapData) {
  const fail = (name: string) => { throw new Error(`Stage ${level.def.id}: ${name} round trip mismatch`) }
  if (map.width !== level.cols || map.height !== level.rows || map.tilewidth !== TILE || map.tileheight !== TILE) fail('dimensions')
  if (map.properties[0]!.value !== JSON.stringify(level.def)) fail('stage properties')
  const terrain = map.layers.find(l => l.name === 'Terrain')!
  if (!('data' in terrain) || JSON.stringify(terrain.data) !== JSON.stringify(Array.from(level.tiles))) fail('terrain')
  for (const [name, expected] of [['Spawns', level.spawns], ['Doors', level.spawns.filter(s => s.kind === 'D')], ['Anchors', level.patternAnchors], ['Cliffs', level.patternCliffs]] as const) {
    const layer = map.layers.find(l => l.name === name)!
    const list = 'objects' in layer ? layer.objects : []
    if (list.length !== expected.length) fail(name + ' count')
    list.forEach((o: Obj, i: number) => {
      const source = expected[i]!
      if (o.properties[0]!.value !== JSON.stringify(source)) fail(name + ' properties')
      const x = 'col' in source ? source.col * TILE : source.x
      const y = 'row' in source ? source.row * TILE : source.y
      if (o.x !== x || o.y !== y) fail(name + ' coordinates')
    })
  }
  for (const [name, data] of [['Ladders', level.ladders], ['Caves', level.cave]] as const) {
    const layer = map.layers.find(l => l.name === name)!
    const restored = new Uint8Array(data.length)
    if ('objects' in layer) for (const o of layer.objects) restored[o.y / TILE * level.cols + o.x / TILE] = JSON.parse(o.properties[0]!.value)
    if (JSON.stringify(Array.from(restored)) !== JSON.stringify(Array.from(data))) fail(name)
  }
  return { stage: level.def.id, tiles: level.tiles.length, ladders: level.ladders.reduce((a, b) => a + b, 0), spawns: level.spawns.length, doors: level.spawns.filter(s => s.kind === 'D').length, anchors: level.patternAnchors.length, cliffs: level.patternCliffs.length }
}
export async function sourceLevel(index: number) {
  await loadStageArt(index + 1)
  return new Level(STAGES[index]!)
}
