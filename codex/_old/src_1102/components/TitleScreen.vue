<script setup lang="ts">
import CartoonText from './CartoonText.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { art, loadArt } from '../game/art'

const emit = defineEmits<{ start: [players: number] }>()

const ready = ref(false)
const scene=ref<HTMLCanvasElement|null>(null)
let raf=0
const logoSrc = ref<string | null>(null)
const slammed = ref(false)
let timer = 0
let disposed = false

let hi = 0
try {
  hi = Number(localStorage.getItem('ugauga.hi') ?? 0) || 0
} catch {
  hi = 0
}
const hiText = computed(() => String(hi).padStart(7, '0'))

// 로고가 박힐 때 튀는 흙먼지
const dust = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: 50 + (Math.random() - 0.5) * 70,
  dx: (Math.random() - 0.5) * 30,
  dy: -4 - Math.random() * 10,
  s: 1 + Math.random() * 2.2,
  d: Math.random() * 0.15,
}))

function start() {
  clearTimeout(timer)
  slammed.value = true
  emit('start', 1)
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault()
    start()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await loadArt()
  if (disposed) return
  const c=scene.value
  if(c){
    const g=c.getContext('2d')!;g.scale(2,2);g.imageSmoothingEnabled=true
    const bg=art.images['title.bg'];if(bg)g.drawImage(bg,0,0,960,540)
    // A small but readable cameo below Nuga's waterfall, presenting the acorn.
    const scrat=art.images['title.scrat']
    if(scrat){const h=38,w=h*scrat.width/scrat.height;g.drawImage(scrat,902-w/2,448-h,w,h)}
  }
  logoSrc.value = art.images['title.logo']?.src ?? null
  ready.value = true
  timer = window.setTimeout(() => (slammed.value = true), 760)
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', onKey)
  clearTimeout(timer)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="title" :class="{ ready, slammed }" @click="start()">
    <canvas ref="scene" width="1920" height="1080" class="bg painted" />
    <div class="vignette" />

    <div class="logo-wrap">
      <img v-if="logoSrc" class="logo-img" :src="logoSrc" alt="우가누가!" draggable="false" />
      <div class="dust">
        <i
          v-for="d in dust"
          :key="d.id"
          :style="{ left: d.x + '%', '--dx': d.dx + 'cqw', '--dy': d.dy + 'cqw', '--s': d.s + 'cqw', '--d': d.d + 's' }"
        />
      </div>
    </div>

    <div class="bottom">
      <p class="sub story-goal"><CartoonText text="누가 공주를 구하러 떠나는 우가의 모험"/></p>
    </div>
    <p class="hi"><CartoonText text="최고 점수"/><CartoonText :text="hiText"/></p>
  </div>
</template>

<style scoped>
.title {
  position: absolute; inset: 0; overflow: hidden; cursor: pointer;
  background: #1c0f08; font-size: 1.6cqw;
}
.bg {
  width:100%;height:100%;
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
}
.bg.painted { animation: kenburns 24s ease-in-out infinite alternate; }
.slammed .bg { animation: shake .3s; }
.title.slammed { animation: title-impact .3s ease-out; }
.vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(20, 8, 2, 0.55));
}

/* ───── 거대한 타이틀이 "팍" 박힘 ───── */
.logo-wrap {
  position: absolute; left: 50%; top: .35cqw; width: min(74cqw, 1200px); transform: translateX(-50%);
  display: grid; place-items: center;
}
.logo-img, .logo-text {
  opacity: 0; transform: scale(2.4) translateY(-8%);
}
.ready .logo-img, .ready .logo-text { animation: slam .62s cubic-bezier(.12,.68,.2,1) .14s forwards; }
.slammed .logo-img, .slammed .logo-text { opacity: 1; transform: none; filter: none; }
.slammed.ready .logo-img, .slammed.ready .logo-text { animation: slam .62s cubic-bezier(.12,.68,.2,1) .14s forwards; }
.logo-img {
  width: 100%; max-height: 23cqw; object-fit: contain; image-rendering: auto;
  filter: drop-shadow(0 0.8cqw 0 rgba(28, 15, 8, 0.55));
}
.logo-text {
  display: flex; gap: 0.4cqw;
  font-family: 'Black Han Sans', sans-serif; font-size: 15cqw; line-height: 1.1; color: #d8d2c4;
  -webkit-text-stroke: 0.6cqw #1c0f08;
  text-shadow: 0 1cqw 0 #7a4415, 0 1.4cqw 0 #1c0f08;
}
.logo-text span { display: inline-block; transform: rotate(calc((var(--i) - 2) * 4deg)) translateY(calc(var(--i) * -0.3cqw)); }
.logo-text span:nth-child(even) { color: #e05a3a; }

.dust { position: absolute; left: 0; right: 0; bottom: 2cqw; height: 0; }
.dust i {
  position: absolute; width: var(--s); height: var(--s); border-radius: 50%;
  background: #c9a77a; opacity: 0;
}
.slammed .dust i { animation: dust 0.9s ease-out var(--d) forwards; }

/* ───── 하단 문구 ───── */
.bottom {
  position: absolute; left: 0; right: 0; bottom: 1.5cqw; text-align: center;
  opacity: 1;
}
.slammed .bottom { opacity: 1; }
.press {
  font-family: 'Black Han Sans', sans-serif; font-size: 4.2cqw; color: #fff4dc;
  -webkit-text-stroke: 0.25cqw #1c0f08;
  paint-order: stroke fill;
  text-shadow: 0.4cqw 0.4cqw 0 #1c0f08;
  animation: blink 1.1s steps(1) 1.5s infinite;
}
.sub { margin-top: 0.8cqw; font-size: 1.4cqw; color: #fff4dc; text-shadow: 0.15cqw 0.15cqw 0 #1c0f08; }
.sub b { color: #ffc15a; }
.hi {
  position: absolute; top: 1.2cqw; right: 1.6cqw; font-family: monospace; font-weight: bold;
  font-size: 1.5cqw; color: #fff4dc; text-shadow: 0.15cqw 0.15cqw 0 #1c0f08;
}

@keyframes slam {
  0% { opacity: 0; transform: scale(2.4) translateY(-8%); }
  72% { opacity: 1; transform: scale(.96) rotate(.6deg); }
  86% { transform: scale(1.035) rotate(-.4deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); filter: none; }
}
@keyframes wobble { 50% { transform: translateY(-0.6cqw) rotate(-0.6deg); } }
@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-1.2cqw, 0.8cqw); }
  40% { transform: translate(1cqw, -0.6cqw); }
  60% { transform: translate(-0.6cqw, 0.4cqw); }
  80% { transform: translate(0.3cqw, -0.2cqw); }
}
@keyframes kenburns { from { transform: scale(1.02); } to { transform: scale(1.08) translateY(-1%); } }
@keyframes dust {
  0% { opacity: 0.9; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
}
@keyframes blink { 50% { opacity: 0.85; } }
.sub button { background: transparent; border: 0; margin: 0 1cqw; cursor: pointer; font-size: 2.5cqw; }
.start-button { border: 0; background: rgba(30,21,10,.72); border-radius: 14px; padding: .4cqw 1.4cqw; cursor: pointer; }
.start-button:focus-visible { outline: 3px solid #ffdf7a; outline-offset: 4px; }
.story-goal { margin: .55cqw 0 0; color: #fff4dc; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .title *, .title *::before { animation: none !important; } .logo-img { opacity: 1; transform: none; } }
@keyframes title-impact { 0%,100% { transform: translate(0); } 15% { transform: translateY(7px); } 35% { transform: translate(-5px,-3px); } 55% { transform: translate(3px,2px); } 75% { transform: translate(-1px,-1px); } }
</style>
