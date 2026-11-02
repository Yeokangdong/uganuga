<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadArt } from './game/art'
import TitleScreen from './components/TitleScreen.vue'
import GameView from './components/GameView.vue'
import ResultScreen from './components/ResultScreen.vue'
import { sfx } from './game/audio'
import type { EndKind } from './game/game'
import { STAGES } from './game/stages'

type Screen = 'title' | 'game' | 'result'

const loading = ref(true)
const loadError=ref(false)
onMounted(async()=>{try{await loadArt()}catch(error){console.error('Game art loading failed:',error);loadError.value=true}finally{loading.value=false}})
const reload=()=>location.reload()

const screen = ref<Screen>('title')
const numPlayers = ref(1)
const runId = ref(0)
const development = import.meta.env.DEV
const gameView=ref<InstanceType<typeof GameView>|null>(null)
const selectedStage = ref(Number(new URLSearchParams(location.search).get('stage') ?? 1)-1)
const directStage = ref(false)
const result = ref<{ kind: EndKind; scores: number[]; stage: number }>({ kind: 'over', scores: [], stage: 1 })

function start(_n?: number) {
  sfx.init()
  numPlayers.value = 1
  runId.value++
  screen.value = 'game'
}

function jumpStage(index:number) {
  selectedStage.value=index
  directStage.value=true
  start()
}

function onEnd(kind: EndKind, scores: number[], stage: number) {
  result.value = { kind, scores, stage }
  screen.value = 'result'
}
</script>

<template>
  <div class="viewport">
    <div class="frame">
      <div v-if="loading" class="loading" role="status">모험을 준비하고 있어요<div class="loading-bar"><i /></div></div>
      <div v-if="loadError" class="loading" role="alert">그림을 불러오지 못했습니다.<button @click="reload">다시 불러오기</button></div>
      <TitleScreen v-if="!loading && !loadError && screen === 'title'" @start="start" />
      <GameView
        ref="gameView"
        v-else-if="!loading && !loadError && screen === 'game'"
        :key="runId"
        :players="numPlayers"
        :start-stage="selectedStage"
        :direct-stage="directStage"
        @end="onEnd"
        @quit="screen = 'title'"
      />
      <ResultScreen
        v-else-if="!loading && !loadError"
        :kind="result.kind"
        :scores="result.scores"
        :stage="result.stage"
        @retry="start(numPlayers)"
        @title="screen = 'title'"
      />
    </div>
    <nav v-if="development" class="dev-stages" aria-label="개발용 스테이지 이동">
      <span>개발 · 바로 이동</span>
      <button v-if="screen==='game'" @click="gameView?.previewJourney()" title="현재 지역에서 다음 지역으로 가는 추격 장면">지역 이동 보기</button>
      <button v-for="(stage,index) in STAGES" :key="stage.id" :aria-pressed="screen==='game' && selectedStage===index" @click="jumpStage(index)":title="stage.sub">{{stage.id}} · {{stage.sub}}</button>
    </nav>
  </div>
</template>

<style scoped>
.dev-stages{position:fixed;z-index:20;right:8px;bottom:6px;display:flex;flex-wrap:wrap;max-width:min(900px,calc(100vw - 16px));max-height:22vh;overflow:auto;gap:5px;align-items:center;padding:5px 8px;border-radius:6px;background:#24170fe6;color:#f8e5bd;font:11px sans-serif}
.dev-stages button{cursor:pointer;padding:5px 8px;border:1px solid #99764c;border-radius:4px;background:#4b3423;color:#fff0cb;font:inherit}
.dev-stages button[aria-pressed=true]{background:#947044}
.loading { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; color:#ffe3a6; background:#24170f; font:20px sans-serif; }
.loading-bar { width:40%; height:10px; overflow:hidden; border-radius:8px; background:#5d432d; }
.loading-bar i { display:block; height:100%; width:40%; border-radius:8px; background:#f2bb62; animation:loading 1s ease-in-out infinite alternate; }
@keyframes loading { to { transform:translateX(150%); } }
.viewport {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 40%, #2b170c, #0b0604 70%);
}
.frame {
  position: relative;
  width: min(100vw, calc(100vh * 16 / 9));
  aspect-ratio: 16 / 9;
  overflow: hidden;
  container-type: inline-size;
  box-shadow: 0 0 0 4px #3b2414, 0 20px 60px rgba(0, 0, 0, 0.6);
  background: #000;
}
</style>
