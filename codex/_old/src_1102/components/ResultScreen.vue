<script setup lang="ts">
import CartoonText from './CartoonText.vue'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { art } from '../game/art'
import type { EndKind } from '../game/game'

const props = defineProps<{ kind: EndKind; scores: number[]; stage: number }>()
const emit = defineEmits<{ retry: []; title: [] }>()

const best = Math.max(0, ...props.scores)
let hi = 0

try {
  hi = Number(localStorage.getItem('ugauga.hi') ?? 0) || 0
  if (best > hi) {
    hi = best
    localStorage.setItem('ugauga.hi', String(best))
  }
} catch {
  /* 저장소 사용 불가 */
}
const total = computed(() => props.scores.reduce((a, b) => a + b, 0))

function onKey(e: KeyboardEvent) {
  if (e.code === 'Enter' || e.code === 'Space') emit('retry')
  if (e.code === 'Escape') emit('title')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="result" :class="kind">
    <h1><CartoonText :text="kind === 'clear' ? '누가 공주 구출!' : 'GAME OVER'"/></h1>
    <p v-if="kind === 'clear'" class="rescue-message"><CartoonText text="누가 공주를 구했습니다!"/></p>
    <p class="msg"><CartoonText text="STAGE"/><CartoonText :text="stage"/></p>
    <div class="scores">
      <div v-for="(s, i) in scores.slice(0,1)" :key="i" class="line">
        <span :class="'p' + i"><CartoonText :text="i+1"/><CartoonText text="P"/><CartoonText text="우가"/></span>
        <b><CartoonText :text="String(s).padStart(7,'0')"/></b>
      </div>
      <div v-if="scores.length > 1" class="line total"><span><CartoonText text="합계"/></span><b><CartoonText :text="String(total).padStart(7,'0')"/></b></div>
      <div class="line hi"><span><CartoonText text="최고 점수"/></span><b><CartoonText :text="String(hi).padStart(7,'0')"/></b></div>
    </div>
    <div class="btns">
      <button aria-label="Retry (Enter)" @click="emit('retry')"><CartoonText text="다시 도전"/></button>
      <button aria-label="Title (ESC)" @click="emit('title')"><img :src="art.images['title.logo']?.src" class="result-art" alt="" /></button>
    </div>
  </div>
</template>

<style scoped>
.result {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1.5cqw; font-size: 1.8cqw;
}
.result.clear { background: radial-gradient(circle, #ffcf6b, #e9a23b 45%, #7a4415); }
.result.over { background: radial-gradient(circle, #5a2a2a, #1c0f08 70%); }
h1 {
  font-family: 'Trebuchet MS', 'Malgun Gothic', sans-serif; font-size: 6cqw; color: #ffe14a;
  -webkit-text-stroke: 0.4cqw #1c0f08; text-shadow: 0.6cqw 0.6cqw 0 #1c0f08;
}
.msg { font-size: 2.2cqw; text-shadow: 0.15cqw 0.15cqw 0 #1c0f08; }
.scores { background: rgba(28, 15, 8, 0.8); border-radius: 1cqw; padding: 1.2cqw 2.5cqw; min-width: 40cqw; }
.line { display: flex; justify-content: space-between; gap: 3cqw; padding: 0.3cqw 0; font-size: 2.2cqw; }
.line b { font-family: monospace; }
.line .p0 { color: #ff9a3a; }
.line .p1 { color: #c48cff; }
.line.total { border-top: 0.2cqw dashed #7a4415; margin-top: 0.4cqw; padding-top: 0.6cqw; }
.line.hi { color: #ffe14a; }
.line em { font-style: normal; background: #ff3a2a; color: #fff; padding: 0 0.5cqw; border-radius: 0.4cqw; font-size: 1.4cqw; animation: blink 0.5s infinite; }
.btns { display: flex; gap: 2cqw; }
.btns button {
  font-size: 2cqw; padding: 0.8cqw 2.6cqw; border-radius: 1cqw; border: 0.35cqw solid #1c0f08;
  background: #e9a23b; color: #1c0f08; box-shadow: 0 0.5cqw 0 #7a4415;
}
.btns button:hover { background: #ffc15a; }
@keyframes blink { 50% { opacity: 0.3; } }
.result-art { height: 2em; width: auto; max-width: 40cqw; object-fit: contain; }
</style>
