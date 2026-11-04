// Read-only observation of the development engine; all play uses real keyboard input.
// node tools/playthrough.mjs --stages 1-15 --out shots/playthrough
import { spawn } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
function option(name, fallback) {
  const at = args.indexOf(name)
  return at < 0 ? fallback : args[at + 1]
}
const range = /^(\d+)(?:-(\d+))?$/.exec(option('--stages', '1-15') ?? '')
if (!range) throw new Error('--stages: 1-15 형식 필요')
const first = Number(range[1]), last = Number(range[2] ?? range[1])
if (first < 1 || last > 15 || first > last) throw new Error('판 범위: 1~15')
const port=option('--port','5306')
const chaseCheck = args.includes('--environment7')
const limit = Number(option('--timeout', '240'))
if (!Number.isFinite(limit) || limit <= 0) throw new Error('--timeout: 양수(초) 필요')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.resolve(root, option('--out', 'shots/playthrough'))
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  'run', 'dev', '--', '--host', '127.0.0.1', '--port', port, '--strictPort', '--no-open'],
{ cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let startup = '', serverError
server.stdout.on('data', b => { startup = (startup + b).slice(-4000) })
server.stderr.on('data', b => { startup = (startup + b).slice(-4000) })
server.on('error', e => { serverError = e })
let browser, browserServer, page
const results = [], keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']
let held = new Set()
async function stopTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      const stop = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      stop.on('error', reject); stop.on('exit', resolve)
    })
  } else {
    try { process.kill(pid, 'SIGTERM') } catch (e) { if (e.code !== 'ESRCH') throw e }
  }
}
async function input(wanted = []) {
  const next = new Set(wanted)
  for (const key of held) if (!next.has(key)) await page.keyboard.up(key)
  for (const key of next) if (!held.has(key)) await page.keyboard.down(key)
  held = next
}
try {
  for (let attempt = 0; ; attempt++) {
    if (serverError || server.exitCode !== null) throw serverError ?? new Error(startup)
    if (new RegExp('Local:.*'+port).test(startup)) break
    if (attempt > 100) throw new Error('Vite 시작 시간 초과: ' + startup)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
  browserServer = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH } : { channel: 'msedge' }), args: ['--mute-audio'] })
  browser = await chromium.connect(browserServer.wsEndpoint())
  page = await browser.newPage({ viewport: { width: 960, height: 640 } })
  for (let stage = first; stage <= last; stage++) {
    const started = Date.now(), events = [], errors = []
    let snapshot = null, reason = '', complete = false, lastProgress = Date.now()
    let anchor = null, previousSignature = '', tick = 0
    const captured = new Set()
    const onError = e => errors.push(e.message)
    page.on('pageerror', onError)
    try {
      await input()
      await page.goto(`http://127.0.0.1:${port}/?stage=${stage}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 60000 })
      await page.keyboard.press('Space')
      await page.waitForFunction(() => window.__game?.players?.length, null, { timeout: 60000 })
      while (Date.now() - started < limit * 1000) {
        // Observation only: do not call engine methods, set fields, or alter clocks.
        snapshot = await page.evaluate(() => {
          const g = window.__game, p = g.players[0], lv = g.level
          const foods = g.items.filter(i => !i.dead && ['fruit', 'meat', 'bigmeat'].includes(i.kind))
            .map(i => ({ x: i.x, y: i.y }))
          const foes = g.enemies.filter(e => !e.dead && !e.dying && !e.invulnerable)
            .map(e => ({ x: e.cx, y: e.y, w: e.w, h: e.h }))
          const dir = p.facing || 1, feet = p.y + p.h
          const x = p.cx + dir * (p.w/2+7), row = Math.floor((feet + 4) / 16), col = Math.floor(x / 16)
          return { stage: g.stage.id, mode: g.mode, food: g.food, time: g.time,
            timeLeft: g.timeLeft, x: p.x, cx: p.cx, y: p.y, h: p.h, hp: p.hp,
            lives: p.lives, alive: p.alive, out: p.out, ground: p.onGround,
            climbing: p.climbing, facing: p.facing, swing: p.swingT, vx: p.vx,
            environment: {phase:g.environmentEvents.phase,elapsed:g.environmentEvents.elapsed,
              rockX:g.environmentEvents.rockX,route:lv.def.chase},
            intro: g.introT > 0, journey: g.journeyT !== null, arena: lv.arenaX,
            wall: lv.solidAt(p.cx+dir*27, feet - 8),
            waterAhead:lv.waterAt(x,feet+8),
            gap: !(lv.solidAt(x, feet + 4) || lv.tile(col, row) === 2 || lv.isLadderTop(col, row)),
            foods, foes, boss: g.boss ? { hp: g.boss.hp, x: g.boss.cx, w: g.boss.w,
              state: g.boss.state, vx: g.boss.vx } : null }
        })
        const s = snapshot
        if(chaseCheck&&stage===7){
          const phase=s.environment.phase
          if(['TELEGRAPH','ACTIVE','RESOLVED'].includes(phase)&&!captured.has(phase)){
            captured.add(phase)
            const name=phase==='TELEGRAPH'?'telegraph':phase==='ACTIVE'?'chase':'rest'
            const shot=path.join(root,`shots/321_${name}.png`)
            if(!await access(shot).then(()=>true,()=>false))await page.screenshot({path:shot})
            events.push({seconds:+((Date.now()-started)/1000).toFixed(2),phase,x:s.cx,rockX:s.environment.rockX,hp:s.hp,food:s.food})
          }
          if(phase==='ACTIVE'&&!s.ground&&!captured.has('JUMP')){
            captured.add('JUMP');events.push({phase:'JUMP',x:s.cx,y:s.y})
          }
          if(phase==='RESOLVED'&&s.environment.elapsed>=2&&s.cx>s.environment.route.end+105){
            complete=['TELEGRAPH','ACTIVE','JUMP','RESOLVED'].every(p=>captured.has(p))&&errors.length===0
            reason=complete?'':'이벤트 단계/점프 증거 부족';break
          }
        }
        const signature = `${s.stage}:${s.mode}:${s.food >= 60}:${s.boss?.hp ?? ''}:${s.lives}`
        if (signature !== previousSignature) {
          events.push({ seconds: +((Date.now() - started) / 1000).toFixed(2),
            stage: s.stage, mode: s.mode, food: s.food, bossHp: s.boss?.hp, x: s.x, y: s.y })
          previousSignature = signature
        }
        if (s.stage > stage || stage === 15 && s.mode === 'clear') {
          complete = events.some(e => e.food >= 60) && events.some(e => e.mode === 'boss' && e.bossHp > 0) && events.some(e => e.bossHp === 0)
            && events.some(e => e.mode === 'clear' || e.mode === 'rescue')
          reason = complete ? '' : '전환 관측했으나 필수 진행 증거 부족'
          break
        }
        if (s.out || s.mode === 'over') { reason = '목숨 소진'; break }
        if (s.intro || s.journey || s.mode === 'clear' || s.mode === 'rescue') {
          await input(); lastProgress = Date.now(); anchor = null
        } else {
          if (!anchor || Math.hypot(s.x - anchor.x, s.y - anchor.y) > 24 || signature !== anchor.signature) {
            anchor = { x: s.x, y: s.y, signature }; lastProgress = Date.now()
          }
          const stuck = (Date.now() - lastProgress) / 1000
          if (stuck > 22) { reason = s.food < 60 ? '먹이 수집/경로 정체' : s.mode === 'boss' ? '보스 전투 정체' : '보스 문 접근 정체'; break }
          const foods = s.food < 60 ? s.foods.filter(f => Math.abs(f.y - s.y) < 85 && f.x > s.x - 100)
            .sort((a, b) => Math.hypot(a.x - s.cx, (a.y - s.y) * 2) - Math.hypot(b.x - s.cx, (b.y - s.y) * 2)) : []
          const foe = s.mode === 'boss' ? s.boss : s.foes.filter(e => Math.abs(e.y + e.h - s.y - s.h) < 40 && Math.abs(e.x - s.cx) < 125)
            .sort((a, b) => Math.abs(a.x - s.cx) - Math.abs(b.x - s.cx))[0]
          let target = foods[0]?.x ?? foe?.x ?? s.arena + 64
          if (foe) target = foe.x - Math.sign(foe.x - s.cx || 1) * (foe.w / 2 + 14)
          const wanted = []
          const projected = s.cx + s.vx * .12
          if (target < projected - 3) wanted.push('ArrowLeft')
          if (target > projected + 3) wanted.push('ArrowRight')
          if (foe && Math.abs(foe.x - s.cx) < foe.w / 2 + 42) {
            if (Math.sign(foe.x - s.cx) !== s.facing) {
              wanted.length = 0; wanted.push(foe.x < s.cx ? 'ArrowLeft' : 'ArrowRight')
            }
            if (s.swing <= 0 && !held.has('Space')) wanted.push('Space')
          }
          if (s.climbing || s.ground && !held.has('ArrowUp') && (s.wall || s.gap || stuck > 2 ||
            foods[0] && foods[0].y < s.y - 5 && Math.abs(foods[0].x - s.cx) < 35)) wanted.push('ArrowUp')
          if(s.waterAhead&&s.ground){
            wanted.length=0;wanted.push('ArrowRight')
            if(!held.has('ArrowUp'))wanted.push('ArrowUp')
          }
          if(chaseCheck&&stage===7&&['TELEGRAPH','ACTIVE'].includes(s.environment.phase)){
            wanted.length=0
            const route=s.environment.route
            if(s.cx<route.end+112)wanted.push('ArrowRight')
            if(s.ground&&!held.has('ArrowUp')&&(s.wall||s.cx>route.obstacle-38&&s.cx<route.obstacle+40))wanted.push('ArrowUp')
          }
          if(chaseCheck&&stage===7&&s.environment.phase==='RESOLVED'&&s.environment.elapsed<2){
            wanted.length=0
            if(s.cx<s.environment.route.end+112)wanted.push('ArrowRight')
          }
          if (!s.alive) wanted.length = 0
          await input(wanted)
        }
        tick++
        await page.waitForTimeout(100)
      }
      if (!complete && !reason) reason = `실시간 ${limit}초 제한`
    } catch (error) { reason = `실행 오류: ${error.message}` }
    await input()
    const screenshot = path.join(output, `stage-${String(stage).padStart(2, '0')}-${Date.now()}.png`)
    if(!chaseCheck)await page.screenshot({ path: screenshot, fullPage: true })
    const result = { stage, target:chaseCheck?'environment7-input-escape':'clear-and-next-stage', complete, blocked: reason, seconds: +((Date.now() - started) / 1000).toFixed(2),
      position: snapshot ? { x: snapshot.x, y: snapshot.y } : null, snapshot, events, errors, screenshot }
    results.push(result)
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
    page.off('pageerror', onError)
    console.log(`| ${stage} | ${complete ? 'O' : 'X'} | ${reason || '—'} | ${result.seconds}초 |`)
  }
  process.exitCode = results.every(r => r.complete) ? 0 : 1
} finally {
  if (page && !page.isClosed()) await input().catch(() => {})
  if (server.exitCode === null) await stopTree(server.pid)
  if (browser) {
    let timer
    await Promise.race([browser.close().catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 2000) })])
    clearTimeout(timer)
  }
  if (browserServer?.process().exitCode === null) await stopTree(browserServer.process().pid)
}
