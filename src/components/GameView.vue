<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Game, type EndKind, type HudState } from '../game/game'
import GameHud from './GameHud.vue'
import { drawPaintedText, loadStageArt } from '../game/art'

const props = defineProps<{ startStage: number; directStage: boolean }>()
const emit = defineEmits<{ end: [kind: EndKind, scores: number[], stage: number]; quit: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const hud = shallowRef<HudState | null>(null)
let game: Game | null = null
const loading = ref(false)
const loadError = ref(false)
function paintedLabel(text: string) {
  const label = document.createElement('canvas')
  label.width = 720; label.height = 64
  drawPaintedText(label.getContext('2d')!, text, 360, 52, 30)
  return label.toDataURL()
}
const errorLabel = paintedLabel('그림을 불러오지 못했습니다')
const retryLabel = paintedLabel('다시 불러오기')
defineExpose({previewJourney:()=>game?.previewJourney()})

function onKey(e: KeyboardEvent) {
  if (hud.value?.paused && e.code === 'KeyQ') emit('quit')
}

function autoPause(){if(game&&!game.paused&&(game.mode==='play'||game.mode==='boss'||game.mode==='rescue'))game.togglePause()}
function onVisibility(){if(document.hidden)autoPause()}
let disposed = false
async function startGame() {
  if (loading.value || game || disposed) return
  loading.value = true
  loadError.value = false
  try {
    await loadStageArt(Number.isFinite(props.startStage)?props.startStage+1:1)
  } catch {
    if (!disposed) loadError.value = true
    return
  } finally {
    loading.value = false
  }
  if (disposed || !canvas.value) return
  // 개발용: 주소 뒤에 ?stage=2 를 붙이면 해당 스테이지부터
  const startStage = props.startStage
  game = new Game(canvas.value!, {
    onHud: (h) => (hud.value = h),
    onEnd: (k, s, st) => emit('end', k, s, st),
  }, Number.isFinite(startStage) ? startStage : 0, props.directStage)
  game.start()
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur',autoPause)
  document.addEventListener('visibilitychange',onVisibility)
}
onMounted(startGame)

onBeforeUnmount(() => {
  disposed = true
  game?.stop()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur',autoPause)
  document.removeEventListener('visibilitychange',onVisibility)
})
</script>

<template>
  <div class="game">
    <canvas ref="canvas" class="screen" :aria-label="hud?.journey ? '지역 이동: '+hud.trail : hud?.opening ?? '우가누가 게임 화면'" @click="game?.skipIntro()" />
    <div v-if="loadError" class="load-error" role="alert">
      <img :src="errorLabel" alt="그림을 불러오지 못했습니다" />
      <button @click="startGame"><img :src="retryLabel" alt="다시 불러오기" /></button>
    </div>
    <GameHud v-if="hud && !hud.dreaming && !hud.journey" :hud="hud" @resume="game?.togglePause()" @quit="emit('quit')" />
  </div>
</template>

<style scoped>
.load-error { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#24170f; }
.load-error img { width:min(90cqw,720px); height:auto; }
.load-error button { cursor:pointer; background:#65472c; border:2px solid #d7ae70; }
.load-error button img { width:40cqw; }
.game { position: absolute; inset: 0; }
.screen {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
}
</style>
