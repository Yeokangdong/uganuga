import { CHARACTER_SCALE } from './constants'
import { defineComponent, h } from 'vue'
/**
 * 일러스트 아트 로더.
 * public/assets/art.json 이 있으면 그 그림으로 그리고, 없으면 기존 도트 스프라이트로 대체한다.
 *
 * art.json 형식
 * {
 *   "sprites": {
 *     "p1.run": { "src": "p1.png", "frames": [[x,y,w,h], ...], "h": 36, "fps": 10, "ax": 0.5, "ay": 0.97 }
 *   },
 *   "images": { "bg.far": "bg_far.webp", ... }
 * }
 *  - h : 월드 단위 표시 높이 (가로는 비율 유지)
 *  - ax, ay : 프레임 안의 발 기준점(0~1). 기본 0.5, 0.96
 */
export interface FrameSet {
  durationsMs?: number[]
  pixelArt?: boolean
  facingLeft?: boolean
  img: HTMLImageElement | HTMLCanvasElement
  /** [x, y, w, h] 또는 [x, y, w, h, ax, ay] (프레임별 발 기준점) */
  frames: number[][]
  /** 월드 단위 / 출력 픽셀 (있으면 프레임 크기 그대로 사용) */
  ppu?: number
  h: number
  fps: number
  ax: number
  ay: number
}


export const art = {
  ready: false,
  sprites: {} as Record<string, FrameSet>,
  images: {} as Record<string, HTMLImageElement>,
}

const BASE = `${import.meta.env.BASE_URL}assets/`

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(src))
    img.src = BASE + src
  })
}

// Resolve pack overrides before fetching textures, and fetch only this region's cast.
import { STAGES } from './stages'
let runtimeCopies:Record<string,string>={}
const imageCache=new Map<string,Promise<HTMLImageElement>>()
const cached=(src:string)=>{let p=imageCache.get(src);if(!p){p=loadImage(runtimeCopies[src]??src);imageCache.set(src,p)}return p}
let catalog:Promise<void>|undefined
const spriteCatalog=new Map<string,{folder:string;value:any}>()
const imageCatalog=new Map<string,string>()
const loadedStages=new Map<number,Promise<void>>()
export let terrainManifest:any
async function readCatalog(){
  runtimeCopies=await (await fetch(BASE+'runtime-v115/manifest.json')).json()
  const legacy=await (await fetch(BASE+'art.json')).json()
  for(const [key,src]of Object.entries(legacy.images))if(key.startsWith('ui.'))imageCatalog.set(key,src as string)
  for(const folder of ['painted-v6','terrain-v10','stage-backgrounds-v1','stage-signs-v1','elevated-objects-v1','monsters-v7','world-v8','monsters-v9','underwater-v1','fierce-monsters-v1','hq-monsters-v1','weapons-v1']){
    const r=await fetch(BASE+folder+'/manifest.json');if(!r.ok||!r.headers.get('content-type')?.includes('json'))continue
    const pack=await r.json()
    for(const [key,value]of Object.entries(pack.sprites??{}))spriteCatalog.set(key,{folder,value})
    for(const [key,src]of Object.entries(pack.images??{}))imageCatalog.set(key,folder+'/'+src)
  }
  const signs=await (await fetch(BASE+'stage-signs-v1/manifest.json')).json()
  for(const [key,src]of Object.entries(signs.images))imageCatalog.set(key,'stage-signs-v1/'+src)
  const words=await (await fetch(BASE+'words-v2/manifest.json')).json()
  for(const [text,src]of Object.entries(words)){if(text==='\ubd80\uac00'||text==='2P')continue;const key='ui.words2.'+src;paintedWords[text]=key;imageCatalog.set(key,'words-v2/'+src)}
  Object.assign(paintedWords,{CLUB:paintedWords['???'],STONE:paintedWords['?'],FIRE:paintedWords['?'],BONE:paintedWords['?']})
  terrainManifest=await (await fetch(BASE+'terrain-v11/manifest.json')).json()
  imageCatalog.set('title.logo','runtime_logo_crisp.webp')
  imageCatalog.set('traversal.vineSupport','traversal-v2/support.webp')
  imageCatalog.set('traversal.vine','traversal-v2/vine.webp')
}
export function loadArt():Promise<void>{return loadStageArt(0)}
export function loadStageArt(index:number):Promise<void>{
  const previous=loadedStages.get(index);if(previous)return previous
  const pending=(async()=>{
    await (catalog??=readCatalog())
    const stage=STAGES[index]!,id=stage.id
    const prefixes=new Set(['p1','princess','kingkong','scrat','squirrel','spider','nuga','cave','spawn','fire','piranha',stage.boss.key,stage.caveEntrance,
      ...Object.values(stage.roles).flatMap(r=>[r.key,r.fallbackKey]),...(stage.encounters??[]).flatMap(e=>[e.cfg.key,e.cfg.fallbackKey])])
    const relevant=(key:string)=>{
      if(/buga|word_2p|^p2[.]/.test(key))return false;
      const match=key.match(/^(?:terrain\.|stage\.bg|ui\.(?:stage_sign_|biome_sign_|sign_supports_))(\d+)/)
      if(match)return Number(match[1])===(key.startsWith('stage.bg')?stage.theme.background:id)
      if(key.startsWith('v2.bg'))return key===`v2.bg${(id-1)%3+1}`
      if(key.startsWith('world.elevated.')||key==='world.rootedTree'||key.startsWith('terrain.'))return false
      if(/^world\.(rock|surface|ladder)\d+$/.test(key))return key.endsWith(String((id-1)%3))
      if(/^stage\d+/.test(key))return key.startsWith(`stage${String(id).padStart(2,'0')}_`)
      if(/^(?:boss|dino)\d*/.test(key))return prefixes.has(key.split('.')[0]!)
      if(key.startsWith('sky.')||key.startsWith('underwater.'))return false
      return true
    }
    await Promise.all([...spriteCatalog].filter(([key])=>prefixes.has(key.split('.')[0]!)||/^(weapon|effect|item|fx|food|proj)/.test(key)).map(async([key,{folder,value:v}])=>{
      if(art.sprites[key])return
      const img=await cached(folder+'/'+v.frames[0].src)
      art.sprites[key]={img,frames:v.frames.map((f:any)=>f.rect),h:v.h,ppu:v.ppu,fps:v.fps,ax:.5,ay:1,facingLeft:v.facingLeft,pixelArt:v.pixelArt,durationsMs:v.durationsMs}
    }))
    await Promise.all([...imageCatalog].filter(([key])=>relevant(key)).map(async([key,src])=>{if(!art.images[key])art.images[key]=await cached(src)}))
    const variant=terrainManifest.stageVariants.find((v:any)=>v.stage===id)
    const theme=variant?.baseTheme??['jungle','volcano','glacier'][(id-1)%3]
    art.images[`terrain11.${id}`]=await cached('terrain-v11/'+terrainManifest.themes[theme].image)
    const alias=(prefix:string,to:string,from:string)=>{art.sprites[prefix+'.'+to]??=art.sprites[prefix+'.'+from]!}
    alias('p1','boneIdle','idle')
    for(const prefix of prefixes)if(prefix)for(const [to,from]of Object.entries({run:'walk',swing:'attack',throw:'attack',charge:'walk',dive:'attack',dead:'collapse',roar:'attack'}))alias(prefix,to,from)
    const fall=art.sprites['spider.dead'];if(fall)art.sprites['spider.recover']={...fall,frames:[...fall.frames].reverse(),durationsMs:fall.durationsMs?[...fall.durationsMs].reverse():undefined}
    art.ready=true
  })()
  loadedStages.set(index,pending);pending.catch(()=>loadedStages.delete(index));return pending
}

const timingCache=new WeakMap<FrameSet,{source:number[];ends:number[];total:number}>()
function timing(s:FrameSet){
  const source=s.durationsMs
  if(!source||source.length!==s.frames.length)return undefined
  const cached=timingCache.get(s)
  if(cached?.source===source)return cached
  let total=0
  const ends=source.map(ms=>total+=ms)
  const result={source,ends,total};timingCache.set(s,result);return result
}

export function progressFrame(key:string,progress:number):number {
  const s=art.sprites[key],count=s?.frames.length??1
  const times=s&&timing(s)
  if(times){const at=Math.max(0,Math.min(.999999,progress))*times.total;let lo=0,hi=count-1;while(lo<hi){const mid=(lo+hi)>>>1;if(at<times.ends[mid]!)hi=mid;else lo=mid+1}return lo}
  return Math.min(count-1,Math.max(0,Math.floor(progress*count)))
}

export function has(key: string): boolean {
  return key in art.sprites
}

export interface DrawOpts {
  /** 하얗게 번쩍 (피격) */
  white?: boolean
  /** 회전 (라디안) — 회전 중심은 그림 중앙 */
  rot?: number
  alpha?: number
  /** 기울이기 (라디안) — 발 기준 */
  tilt?: number
  /** 표시 높이 배율 */
  scale?: number
  glow?: string
}

/** 애니메이션 시간 t(초)로 프레임 선택 */
export function frameAt(key: string, t: number, loop = true): number {
  const s = art.sprites[key]
  if (!s) return 0
  const n = s.frames.length
  const times=timing(s)
  if(times){const total=times.total,elapsed=Math.max(0,t*1000);return progressFrame(key,loop?(elapsed%total)/total:Math.min(1,elapsed/total))}
  const i = Math.floor(t * s.fps)
  return loop ? i % n : Math.min(i, n - 1)
}

/** 발 기준점(cx, bottom)에 그리기. 성공하면 true */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  key: string,
  frame: number,
  cx: number,
  bottom: number,
  faceLeft: boolean,
  o: DrawOpts = {},
): boolean {
  const s = art.sprites[key]
  if (!s) return false
  const f = s.frames[Math.max(0, frame) % s.frames.length]
  const [fx, fy, fw, fh] = f
  const k = (o.scale ?? 1) * (/^p[12]\./.test(key) ? 1.95 : 1)
  const h = s.ppu ? fh * s.ppu * k : s.h * k
  const w = s.ppu ? fw * s.ppu * k : (fw / fh) * h
  const ax = f.length >= 6 ? f[4] : s.ax
  const ay = f.length >= 6 ? f[5] : s.ay
  ctx.save()
  ctx.imageSmoothingEnabled = !s.pixelArt
  ctx.translate(cx, bottom)
  if (o.tilt) ctx.rotate(o.tilt)
  if (o.rot) {
    ctx.translate(0, -h / 2)
    ctx.rotate(o.rot)
    ctx.translate(0, h / 2)
  }
  // Intact authored poses keep their proportions; only horizontal facing flips.
  ctx.scale(faceLeft !== !!s.facingLeft ? -1 : 1, 1)
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
  const filters: string[] = []
  if (o.white) filters.push('brightness(2.6) saturate(0.2)')
  if (o.glow) filters.push(`drop-shadow(0 0 2px ${o.glow})`)
  if (filters.length) ctx.filter = filters.join(' ')
  ctx.drawImage(s.img, fx, fy, fw, fh, -w * ax, -h * ay, w, h)
  ctx.restore()
  return true
}

/** 단일 이미지 (배경 등) */
export function image(key: string): HTMLImageElement | null {
  return art.images[key] ?? null
}

const paintedWords: Record<string, string> = {"점수": "ui.word_score", "시간": "ui.word_time", "목숨": "ui.word_lives", "1P": "ui.word_1p", "우가": "ui.word_uga", "클릭 시 시작": "ui.word_click_to_start", "보스 등장!": "ui.word_boss_appears", "스테이지 클리어!": "ui.word_stage_clear", "게임 오버": "ui.word_game_over", "일시 정지": "ui.word_paused", "모두 클리어!": "ui.word_all_clear", "최고 점수": "ui.word_high_score", "팅!": "ui.word_ting", "폭군룡 쿵쾅이": "ui.word_tyrant_king", "용암룡 들이박": "ui.word_lava_dragon", "빙하룡 만년설": "ui.word_woolly_mammoth"}

Object.assign(paintedWords, {
  'SCORE':'ui.word_score','LIFE':'ui.word_lives','HP':'ui.word_lives','FOOD':'ui.word_food',
  'BONE':'ui.word_bone','CLUB':'ui.word_bone','STONE':'ui.word_axe','FIRE':'ui.word_firestick',
  '나무몽둥이':'ui.word_bone',
  '배고프다!': 'ui.word_hungry', '동굴': 'ui.word_cave',
  '꽝': 'ui.word_miss', '꽝!': 'ui.word_miss', '!': 'ui.word_miss',
  '돌도끼': 'ui.word_axe', '뼈다귀': 'ui.word_bone', '불방망이': 'ui.word_firestick',
  '뼈몽둥이': 'ui.word_bone', '불도끼': 'ui.word_firestick',
  '빙하룡 만년설': 'ui.word_ice_dragon',
  '초': 'ui.word_sec', 's': 'ui.word_sec', '먹이': 'ui.word_food',
  '함정!': 'ui.word_miss', 'TIME UP!': 'ui.word_time',
})
function paintedKeys(text: string): string[] {
  const key = textArtKey(text)
  if (key) return [key]
  if (text.startsWith('TIME BONUS ')) return ['ui.word_time', ...paintedKeys(text.slice(11))]
  const digits=[...text].flatMap(c => c === 's' || c === '초' ? ['ui.word_sec'] : /[0-9+x:]/.test(c) ? [`ui.digit_${c}`] : [])
  if(digits.length)return digits
  if(/공주|누가/.test(text))return ['ui.word_uga','ui.word_all_clear']
  if(/공격|Space|이동|점프|A.D/.test(text))return ['ui.word_1p','ui.word_uga','ui.word_bone']
  if(/동굴|보물/.test(text))return ['ui.word_cave','ui.word_bone']
  return ['ui.word_uga','ui.ready']
}

export function textArtKey(text: string): string | undefined {
  if (text.startsWith('ui.')) return text
  if (paintedWords[text]) return paintedWords[text]
  if (/^STAGE [1-7]$/.test(text)) return `ui.stage_sign_${text.match(/[1-7]/)![0]}`
  if (/BOSS|\uBCF4\uC2A4/.test(text)) return 'ui.word_boss_appears'
  if (text === 'ALL CLEAR!') return 'ui.word_all_clear'
  if (/CLEAR|\uD074\uB9AC\uC5B4/.test(text)) return 'ui.word_stage_clear'
  if (/OVER/.test(text)) return 'ui.word_game_over'
  if (/READY|\uC900\uBE44/.test(text)) return 'ui.ready'
  return undefined
}

export const PaintedText = defineComponent({
  props: { text: { type: [String, Number], default: '' } },
  setup(props) {
    return () => {
      const text = String(props.text)
      const keys = paintedKeys(text)
      return h('span', { class: 'painted-text', style: { display: 'inline-flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '0.08em', lineHeight: '1', whiteSpace: 'nowrap' }, role: 'img', 'aria-label': text }, keys.map(k => {
        const im = art.images[k]
        return im ? h('img', { src: im.src, alt: '', style: { display: 'block', position: 'static', flex: 'none', height: '1em', width: 'auto', maxWidth: 'none', objectFit: 'contain', verticalAlign: 'middle' } }) : null
      }))
    }
  },
})

export function drawPaintedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, height: number): void {
  const images=paintedKeys(text).map(key=>art.images[key]).filter((im):im is HTMLImageElement=>!!im)
  const natural=images.reduce((sum,im)=>sum+height*im.width/im.height,0)
  const scale=Math.min(1,360/Math.max(1,natural)),h=height*scale
  let left=x-natural*scale/2
  for(const im of images){const w=h*im.width/im.height;ctx.drawImage(im,left,y-h,w,h);left+=w}

}

// One cycle spans a body-relative stride; distance comes from resolved movement.
export function walkFrame(key: string, distance: number): number {
  // One cycle contains TWO alternating human/dinosaur steps, or all four
  // quadruped footfalls. A short cycle made the feet churn several times/sec.
  const stride = /^p[12]\./.test(key)
    ? key.endsWith('.climb') ? 48 : key.endsWith('.rescueRun') ? 50 : 32
    : key.startsWith('squirrel.') ? 42
    : key.startsWith('kingkong.') ? 56
    : key.startsWith('boss2.') ? 54 : /(^boss|_boss\.)/.test(key) ? 60
    : key.startsWith('spider.') ? 20 : 28
  const cycle=(key.endsWith('.climb')?distance:Math.max(0,distance))/(key.endsWith('.climb')?28:stride*CHARACTER_SCALE)
  // Source indices: near-leg contact, passing, far-leg contact, passing.
  if(/^p[12]\.walk$/.test(key))return [0,2,4,6][Math.floor((cycle-Math.floor(cycle))*4)]!
  return progressFrame(key,cycle-Math.floor(cycle))
}

// The strike pose owns the active interval and receives the longest hold.
export function ugaSwingFrame(elapsed: number, duration: number): number {
  const start = duration * .4, end = duration * .62
  return elapsed < start / 2 ? 0 : elapsed < start ? 1 : elapsed <= end ? 2 : 3
}

