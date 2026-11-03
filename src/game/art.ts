import { STAGES } from './stages'
import { WORLD_CAST } from './world-cast'
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

const imageCache=new Map<string,Promise<HTMLImageElement>>()
const cachedImage=(src:string)=>{if(!imageCache.has(src))imageCache.set(src,loadImage(src).catch(error=>{imageCache.delete(src);throw error}));return imageCache.get(src)!}
const stageLoads=new Map<number,Promise<void>>()
let manifests:Promise<{folder:string;pack:any}[]>|null=null
export function loadArt():Promise<void>{return loadStageArt(1)}
export function loadStageArt(stage:number):Promise<void>{
  if(stageLoads.has(stage))return stageLoads.get(stage)!
  const request=loadAnimationPack(stage).catch(error=>{stageLoads.delete(stage);throw error})
  stageLoads.set(stage,request);return request
}
async function loadAnimationPack(stage:number):Promise<void>{
  art.images['title.logo']=await cachedImage('runtime_logo_crisp.webp')
  if(!manifests)manifests=Promise.all(['painted-v6','terrain-v10','stage-backgrounds-v1','stage-signs-v1','elevated-objects-v1','monsters-v7','world-v8','monsters-v9','underwater-v1','fierce-monsters-v1','hq-monsters-v1','weapons-v1'].map(async folder=>{
    const response=await fetch(BASE+folder+'/manifest.json')
    if(!response.ok)throw new Error(folder+'/manifest.json')
    return {folder,pack:await response.json()}
  })).catch(error=>{manifests=null;throw error})
  const cast=WORLD_CAST[stage-1]!
  const local=new Set<string>([...cast.normal,cast.boss,cast.door])
  const regional=new Set<string>(WORLD_CAST.flatMap(c=>[...c.normal,c.boss,c.door]))
  const encounters=new Set(STAGES[stage-1]!.encounters?.map(e=>e.cfg.key)??[])
  const companions=new Set(['scarab','sandScorpion','marshFrog','coralCrab','sporeling','stoneGuard','bambooMantis','moonOwl','emberTortoise','cloudRay'])
  const needed=(key:string)=>{
    const prefix=key.split('.')[0]!
    if(companions.has(prefix))return encounters.has(prefix)
    if(key.startsWith('underwater.')||/^p[12]\.swim/.test(key))return stage===17
    if(/^proj2\.|^item2\./.test(key))return STAGES[stage-1]!.theme.n==='2'
    if(/^proj3\.|^item3\./.test(key))return STAGES[stage-1]!.theme.n==='3'
    if(regional.has(prefix)&&!local.has(prefix))return false
    const numbered=key.match(/^(?:terrain\.|stage\.bg|ui\.biome_sign_|ui\.stage_sign_)(\d+)(?:\.|$)/)
    if(numbered)return Number(numbered[1])===stage
    if(prefix.startsWith('stage')&&/^stage\d+_/.test(prefix))return local.has(prefix)
    if(/^dino[123]_/.test(prefix))return local.has(prefix)
    if(/^boss[23]?$/.test(prefix))return local.has(prefix)
    if(key.startsWith('sky.'))return stage===18
    return true
  }
  const sprites=new Map<string,{folder:string;v:any}>(),images=new Map<string,string>()
  for(const {folder,pack}of await manifests){
    for(const [key,v]of Object.entries(pack.sprites??{}))if(needed(key))sprites.set(key,{folder,v})
    for(const [key,src]of Object.entries(pack.images??{}))if(needed(key))images.set(key,folder+'/'+src)
  }
  await Promise.all([...sprites].map(async([key,{folder,v}])=>{
    const img=await cachedImage(folder+'/'+v.frames[0].src)
    art.sprites[key]={img,frames:v.frames.map((f:any)=>f.rect),h:v.h,ppu:v.ppu,fps:v.fps,ax:.5,ay:folder==='painted-v6'?1:240/256,facingLeft:v.facingLeft,pixelArt:v.pixelArt,durationsMs:v.durationsMs}
  }))
  await Promise.all([...images].map(async([key,src])=>{art.images[key]=await cachedImage(src)}))
  if(stage===18)await Promise.all(['cloud-floor','cloud-background'].map(async(name,i)=>{art.images[i?'sky.background':'sky.cloudFloor']=await cachedImage('sky-v1/'+name+'.webp')}))
  await Promise.all(['support','vine'].map(async name=>{art.images[name==='support'?'traversal.vineSupport':'traversal.vine']=await cachedImage('traversal-v2/'+name+'.webp')}))
  const alias=(prefix:string,to:string,from:string)=>{if(!art.sprites[prefix+'.'+to]&&art.sprites[prefix+'.'+from])art.sprites[prefix+'.'+to]=art.sprites[prefix+'.'+from]!}
  alias('p1','boneIdle','idle')
  for(const prefix of ['dino1_0','dino1_1','bear','boar']){
    for(const [to,from]of Object.entries({run:'walk',swing:'attack',throw:'attack',jump:'walk',charge:'walk',dive:'attack',dead:'collapse'}))alias(prefix,to,from)
  }
  for(const [to,from]of Object.entries({idle:'fly',walk:'fly',run:'fly',jump:'fly',attack:'dive',windup:'dive',swing:'dive',throw:'dive',dead:'collapse'}))alias('dino1_2',to,from)
  for(let n=2;n<=3;n++)for(let row=0;row<3;row++)for(const[key,value]of Object.entries(art.sprites))if(key.startsWith(`dino1_${row}.`)){const target=key.replace('dino1_',`dino${n}_`);if(!art.sprites[target])art.sprites[target]=value}
  for(const key of ['boss','boss2','boss3']){alias(key,'roar','attack');alias(key,'collapse','dead');alias(key,'run','charge')}
  for(const [to,from]of Object.entries({collapse:'dead',windup:'attack',swing:'attack',charge:'attack'}))alias('spider',to,from)
  const spiderFall=art.sprites['spider.dead']
  if(spiderFall)art.sprites['spider.recover']={...spiderFall,frames:[...spiderFall.frames].reverse(),durationsMs:spiderFall.durationsMs?[...spiderFall.durationsMs].reverse():undefined}
  art.ready=true
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

// The unpadded fire atlas has touching frame edges. Give each pose its own
// transparent sampling border so scaling cannot pull in the next flame.
const flameFrames = new WeakMap<FrameSet, Map<number, HTMLCanvasElement>>()

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
  const k = o.scale ?? 1
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
  if (key === 'fire.pillar') {
    const index = Math.max(0, frame) % s.frames.length
    let frames = flameFrames.get(s)
    if (!frames) { frames = new Map(); flameFrames.set(s, frames) }
    let pose = frames.get(index)
    const px = Math.ceil(fw * 3 / 14), py = Math.ceil(fh * 3 / 14)
    if (!pose) {
      pose = document.createElement('canvas')
      pose.width = fw + px * 2; pose.height = fh + py * 2
      const g = pose.getContext('2d')!
      g.imageSmoothingEnabled = false
      g.drawImage(s.img, fx, fy, fw, fh, px, py, fw, fh)
      frames.set(index, pose)
    }
    ctx.drawImage(pose, -w * ax - px * w / fw, -h * ay - py * h / fh,
      pose.width * w / fw, pose.height * h / fh)
  } else {
    ctx.drawImage(s.img, fx, fy, fw, fh, -w * ax, -h * ay, w, h)
  }
  ctx.restore()
  return true
}

/** 단일 이미지 (배경 등) */
export function image(key: string): HTMLImageElement | null {
  return art.images[key] ?? null
}

const paintedWords: Record<string, string> = {"점수": "ui.word_score", "시간": "ui.word_time", "목숨": "ui.word_lives", "1P": "ui.word_1p", "우가": "ui.word_uga", "클릭 시 시작": "ui.word_click_to_start", "보스 등장!": "ui.word_boss_appears", "스테이지 클리어!": "ui.word_stage_clear", "게임 오버": "ui.word_game_over", "일시 정지": "ui.word_paused", "모두 클리어!": "ui.word_all_clear", "최고 점수": "ui.word_high_score", "팅!": "ui.word_ting", "폭군룡 쿵쾅이": "ui.word_tyrant_king", "용암룡 들이박": "ui.word_lava_dragon", "빙하룡 만년설": "ui.word_woolly_mammoth"}

Object.assign(paintedWords, {
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
  return [...text].flatMap(c => c === 's' || c === '초' ? ['ui.word_sec'] : /[0-9+x:]/.test(c) ? [`ui.digit_${c}`] : [])
}

export function textArtKey(text: string): string | undefined {
  if (text.startsWith('ui.')) return text
  if (paintedWords[text]) return paintedWords[text]
  if (/^STAGE [123]$/.test(text)) return `ui.stage_sign_${text.match(/[123]/)![0]}`
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
  ctx.save();ctx.font=`bold ${height}px "Trebuchet MS", "Malgun Gothic", sans-serif`
  ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineJoin='round'
  ctx.strokeStyle='#39291f';ctx.lineWidth=Math.max(1,height*.15);ctx.strokeText(text,x,y)
  ctx.fillStyle='#fff0c5';ctx.fillText(text,x,y);ctx.restore()
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
  return progressFrame(key,cycle-Math.floor(cycle))
}

// The strike pose owns the active interval and receives the longest hold.
export function ugaSwingFrame(elapsed: number, duration: number): number {
  const start = duration * .4, end = duration * .62
  return elapsed < start / 2 ? 0 : elapsed < start ? 1 : elapsed <= end ? 2 : 3
}

