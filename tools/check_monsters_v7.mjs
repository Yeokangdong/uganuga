import fs from 'node:fs'
import ts from 'typescript'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const write = (path, text) => fs.writeFileSync(new URL(path, root), text)
const code = ts.transpileModule(read('src/game/stages.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { STAGES } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const pack = JSON.parse(read('public/assets/monsters-v7/manifest.json'))
const spec = JSON.parse(read('art-src/monsters-v7/generation.json'))
const names = Object.fromEntries(spec.monsters.map(([key, name]) => [key, name]))
const required = new Set()
const roster = STAGES.map(stage => {
  const marks = stage.map.join('')
  const overworld = [...new Set(Object.entries(stage.roles).filter(([mark]) => marks.includes(mark)).map(([, value]) => value.key))]
  if (stage.theme.n === '' && marks.includes('w')) overworld.push('piranha')
  const boss = stage.final ? null : stage.boss.key
  for (const key of [...overworld, 'spider', ...(boss ? [boss] : [])]) required.add(key)
  return { stage: stage.id, name: stage.sub, overworld, cave: ['spider'], boss }
})
assert.equal(roster.length, 20)
assert.equal(required.size, 15)
let count = 0
for (const key of required) {
  for (const action of ['idle', 'walk', 'fly', 'hit', 'collapse', 'stun', 'recover', 'dead']) {
    assert(pack.sprites[`${key}.${action}`], `Missing ${key}.${action}`)
  }
}
for (const [key, sprite] of Object.entries(pack.sprites)) {
  assert(sprite.h > 0 && sprite.ppu > 0 && sprite.fps > 0, key)
  assert.equal(sprite.frames.length, sprite.durationsMs.length, key)
  for (const frame of sprite.frames) {
    assert(fs.existsSync(new URL('public/assets/monsters-v7/' + frame.src, root)), key)
    const [x, y, w, h, ax, ay] = frame.rect
    assert(x >= 0 && y >= 0 && x + w <= 1024 && y + h <= 1024, key)
    assert(ax >= 0 && ax <= 1 && ay >= 0 && ay <= 1, key)
    count++
  }
}
assert.equal(count, pack.total)
for (const action of ['jump', 'fall', 'stun']) assert(pack.sprites[`piranha.${action}`])
write('art-src/monsters-v7/stage-roster.json', JSON.stringify(roster, null, 2) + '\n')
const listNames = keys => keys.map(key => names[key]).join(', ')
const rows = roster.map(stage => `| ${stage.stage} | ${stage.name} | ${listNames(stage.overworld)} | ${stage.boss ? names[stage.boss] : '공주 구출'} |`)
write('art-src/monsters-v7/README.md', `# 20개 스테이지 몬스터 원화·스프라이트\n\n중복을 제외한 15종, 몬스터별 16개 원화 자세(총 240개)를 제작했습니다. 기존 20개 스테이지의 몬스터 구성을 유지하며 화산·빙하 몬스터에 독립된 그림을 연결했습니다. 모든 스테이지의 동굴에 거미가 나올 수 있습니다. 최종 20스테이지는 보스전 대신 공주 구출입니다.\n\n- \`raw/\`: 내장 image_gen으로 생성한 투명 PNG 원본\n- \`sheets/\`: 1024×1024 PNG 시트와 편집 가능한 Pixelorama PXO\n- \`portraits/\`: 몬스터별 개별 PNG 그림\n- \`previews/\`: 이동·피격·쓰러짐·기절·회복 GIF\n- \`monster-catalog.jpg\`: 전체 15종 도감\n- \`generation.json\`: 도구·캐릭터 설명·전체 생성 프롬프트\n- \`stage-roster.json\`: 실제 스테이지 코드에서 추출한 등장 목록\n- 게임용 파일: \`public/assets/monsters-v7/\` (무손실 WebP 15개, manifest)\n\n시트 행 순서: 1행 이동 4자세, 2행 대기 2자세·피격·공격, 3행 균형 잃음·낙하·쓰러짐·기절, 4행 회복 3자세·경계 대기. 각 프레임은 256×256이며 발 기준은 (128,240)입니다. 같은 원화를 사용하는 이동 동작 등의 키는 재사용하며, 이동 애니메이션은 실제 이동 거리에 맞춰 재생합니다. 공격은 보조 포즈로 제공하며 현재 게임은 기존 접촉 피해 규칙을 유지합니다.\n\n재패킹: \`python tools/pack_monsters_v7.py\`\n검증: \`node tools/check_monsters_v7.mjs\`, \`npm run build\`\n\n| 스테이지 | 지역 | 일반 몬스터 | 보스/완료 |\n|---|---|---|---|\n${rows.join('\n')}\n`)
console.log(`Validated all ${roster.length} stages, ${required.size} monster species, ${count} action frame references.`)
