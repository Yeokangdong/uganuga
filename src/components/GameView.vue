<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Game, type EndKind, type HudState } from '../game/game'
import GameHud from './GameHud.vue'
import { loadArt } from '../game/art'

const props = defineProps<{ players: number; startStage: number; directStage: boolean }>()
const emit = defineEmits<{ end: [kind: EndKind, scores: number[], stage: number]; quit: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const hud = shallowRef<HudState | null>(null)
let game: Game | null = null
defineExpose({previewJourney:()=>game?.previewJourney()})

function onKey(e: KeyboardEvent) {
  if (hud.value?.paused && e.code === 'KeyQ') emit('quit')
}

function autoPause(){if(game&&!game.paused&&(game.mode==='play'||game.mode==='boss'||game.mode==='rescue'))game.togglePause()}
function onVisibility(){if(document.hidden)autoPause()}
let disposed = false
onMounted(async () => {
  await loadArt()
  if (disposed || !canvas.value) return
  // 개발용: 주소 뒤에 ?stage=2 를 붙이면 해당 스테이지부터
  const startStage = props.startStage
  game = new Game(canvas.value!, props.players, {
    onHud: (h) => (hud.value = h),
    onEnd: (k, s, st) => emit('end', k, s, st),
  }, Number.isFinite(startStage) ? startStage : 0, props.directStage)
  game.start()
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur',autoPause)
  document.addEventListener('visibilitychange',onVisibility)
})

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
    <GameHud v-if="hud && !hud.dreaming && !hud.journey" :hud="hud" @resume="game?.togglePause()" @quit="emit('quit')" />
  </div>
</template>

<style scoped>
.game { position: absolute; inset: 0; }
.screen {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: auto;
}
</style>
