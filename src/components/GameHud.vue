<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { HudState } from '../game/game'
import { art } from '../game/art'
import CartoonText from './CartoonText.vue'
defineProps<{hud:HudState}>()
defineEmits<{resume:[];quit:[]}>()
const help=ref(true)
let helpTimer=0
onMounted(()=>{helpTimer=window.setTimeout(()=>help.value=false,9000)})
onBeforeUnmount(()=>clearTimeout(helpTimer))
const digits=(n:number)=>String(n).padStart(7,'0')
const weaponLabel=(key:string)=>key==='fire'?'FIRE':key==='bone'?'BONE':key==='stone'?'STONE':'CLUB'
const weaponIcon=(key:string)=>{const img=art.sprites['item.weapon.'+key]?.img;return img&&'src' in img?img.src:undefined}
</script>
<template>
  <div class="hud">
    <div v-if="hud.trail&&!hud.paused&&!hud.boss" class="trail-clue" role="status">{{hud.trail}}</div>
    <div class="status" v-for="p in hud.players.slice(0, 1)" :key="p.name" :class="{out:p.out}" :aria-label="p.name+' 캐릭터 정보'" :style="{'--panel-image':`url(${art.images['ui.status_panel']?.src})`}">
      <img :src="art.images['ui.portrait']?.src" class="portrait" alt="우가"/>
      <div class="status-content">
        <div class="stats">
          <span class="score" :aria-label="'점수 '+p.score"><CartoonText text="SCORE"/><CartoonText :text="digits(p.score)"/></span>
          <span class="lives" :aria-label="'목숨 '+p.lives"><CartoonText text="LIFE"/><CartoonText :text="Math.max(0,p.lives)"/></span>
          <span class="stage" :aria-label="'스테이지 '+hud.stage"><CartoonText :text="'ST '+hud.stage"/></span>
        </div>
        <div class="vitals">
          <span class="health"><CartoonText text="HP"/>
          <span class="energy" role="meter" aria-label="체력" :aria-valuenow="p.hp" aria-valuemin="0" :aria-valuemax="p.maxHp"><i v-for="n in p.maxHp" :key="n" :class="{on:n<=p.hp}"/></span></span>
          <span class="food"><CartoonText text="FOOD"/><span class="meter" role="meter" aria-label="먹이" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(hud.food*100)"><i :style="{width:hud.food*100+'%'}"/></span></span>
          <span class="weapon" :aria-label="p.weapon" :title="p.weapon"><img v-if="weaponIcon(p.weaponKey)" :src="weaponIcon(p.weaponKey)" alt="" class="weapon-icon"/><CartoonText :text="weaponLabel(p.weaponKey)"/></span>
        </div>
      </div>
      <div v-if="!p.dead && (hud.aquatic || p.swimming || p.oxygen<p.maxOxygen)" class="breath" :class="{low:p.oxygen<=5,recovering:!p.submerged}">
        <span>숨</span><span class="breath-meter" role="meter" aria-label="남은 숨" :aria-valuenow="Math.ceil(p.oxygen)" aria-valuemin="0" :aria-valuemax="p.maxOxygen"><i :style="{width:(p.oxygen/p.maxOxygen*100)+'%'}"/></span><strong>{{Math.ceil(p.oxygen)}}s</strong>
        <small>{{p.oxygen<=5&&p.submerged?'수면이나 공기 주머니로!':p.submerged?'잠수 중':'숨 회복'}}</small>
      </div>
      <div v-if="hud.aerial&&!p.dead" class="breath flight" role="status">{{p.flight==='wind'?'↑ 상승기류를 타는 중':p.flight==='glide'?'활공 중 · ↑를 놓으면 내려갑니다':'↑ 점프 · 길게 눌러 활공'}}</div>
    </div>
    <div class="timer" :class="{warning:hud.timeLeft<=20}" role="timer" aria-label="남은 시간" :style="{backgroundImage:`url(${art.images['ui.timer_panel']?.src})`}"><CartoonText :text="String(Math.max(0,hud.timeLeft)).padStart(2,'0')"/></div>
    <div v-if="!hud.boss&&!hud.paused" class="pattern-rule" :title="hud.patternHint"><strong>{{hud.patternName}}</strong><span v-if="help">{{hud.patternHint}}</span></div>
    <div v-if="hud.banner && !hud.paused" class="banner" :key="hud.banner">
      <span>{{hud.banner}}</span>
      <small v-if="hud.bannerSub"><span>{{hud.bannerSub}}</span></small>
    </div>
    <div v-if="help && !hud.paused && !hud.boss" class="help">{{hud.aquatic?'방향키 헤엄치기 · 수면 / 공기 주머니에서 숨 회복 · Space 공격 · X 던지기':hud.aerial?'← → 이동 · ↑ 점프 / 길게 눌러 활공 · 빛나는 상승기류로 섬 사이 건너기 · Space 공격':'← → 이동 · ↑ 점프 / 사다리 · ↓ 동굴 / 내려가기 · Space 공격 · X 던지기 · P 일시정지'}}</div>
    <span v-if="hud.muted" class="mute">음소거</span>
    <div v-if="hud.paused" class="pause">
      <div class="pause-card"><h2>잠깐 쉬어가기</h2>
        <p>빛나는 몽둥이에 다가가면 바로 장착합니다.<br>나무 · 돌 · 뼈 · 불 몽둥이는 위력과 공격 속도가 다릅니다.</p>
        <p class="pattern-description"><strong>{{hud.patternName}}</strong><br>{{hud.patternHint}}</p>
        <p>{{hud.aquatic?'방향키로 상하좌우 헤엄치기 · ↑ 수면으로 올라오기':hud.aerial?'← → 공중 이동　↑ 점프 · 길게 누르면 천천히 활공':'← → 이동　↑ 점프·사다리　↓ 동굴·내려가기'}}</p><p v-if="hud.aerial">화살표가 떠오르는 상승기류를 타고 높은 섬으로 이동하세요.<br>섬에 착지하면 재시작 위치가 저장됩니다. 구름 아래로 추락하지 않게 조심하세요.</p><p v-if="hud.aquatic">숨은 20초입니다. 수면이나 공기 주머니에서 회복하세요.<br>숨이 모두 줄면 체력이 조금씩 감소합니다.</p><p>Space 공격 · X 던지기 · 길게 눌렀다 놓으면 강공격</p><p>별이 도는 적을 세 번 더 때리면 고기로 변합니다.</p><p>먹이를 모아 깃발로 이동하세요. 지나온 길로 돌아갈 수 있습니다.</p>
        <button @click="$emit('resume')" aria-label="계속하기">계속하기 <kbd>Esc</kbd></button>
        <button @click="$emit('quit')" aria-label="시작 화면">시작 화면 <kbd>Q</kbd></button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.hud{position:absolute;inset:0;pointer-events:none;color:#fff2cd;font-family:system-ui,sans-serif;text-shadow:0 2px 2px #130c08}
.trail-clue{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);max-width:80%;padding:8px 14px;border:1px solid #b69a67;border-radius:9px;background:#30271ee8;color:#fff1ce;font:600 clamp(11px,1.5cqw,20px)/1.6 "Malgun Gothic",sans-serif;text-align:center;text-shadow:none}
/* Nine-slice the leather: stretch its middle, preserve the bone corners. */
.status{--pixel:.2604167cqw;position:absolute;left:calc(var(--pixel)*4);top:calc(var(--pixel)*4);width:calc(var(--pixel)*210);height:calc(var(--pixel)*38);color:#fff0cb;text-shadow:none}
.status::before{content:'';position:absolute;inset:0 0 0 calc(var(--pixel)*23);border:calc(var(--pixel)*8) solid transparent;border-image-source:var(--panel-image);border-image-slice:88 128 fill;border-image-width:calc(var(--pixel)*8) calc(var(--pixel)*12);border-image-repeat:stretch;pointer-events:none}
.portrait{position:absolute;z-index:1;left:0;top:calc(var(--pixel)*2);display:block;width:calc(var(--pixel)*34);height:calc(var(--pixel)*34);object-fit:contain;image-rendering:auto}
.status-content{position:absolute;left:calc(var(--pixel)*43);right:calc(var(--pixel)*15);top:calc(var(--pixel)*9);display:flex;flex-direction:column;gap:calc(var(--pixel)*3);font-size:calc(var(--pixel)*6);line-height:1}
.stats,.vitals{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;column-gap:calc(var(--pixel)*6);height:calc(var(--pixel)*8);min-width:0}
.stats>span,.food,.health{display:flex;align-items:center;gap:calc(var(--pixel)*2);white-space:nowrap;min-width:0}
.score{font-variant-numeric:tabular-nums}.stage,.weapon{color:#e5cea1}.lives{color:#fff0cb}
.vitals{grid-template-columns:auto minmax(0,1fr) auto}
.energy{display:flex;flex:none;width:calc(var(--pixel)*33);gap:calc(var(--pixel)*.5);padding:calc(var(--pixel)*.6);height:calc(var(--pixel)*6);background:#292016;border:calc(var(--pixel)*.7) solid #ba945d;border-radius:calc(var(--pixel)*.7)}
.energy i{flex:1;min-width:0;border-radius:calc(var(--pixel)*.25);background:#504332}
.energy i.on{background:#ca6543;box-shadow:inset 0 calc(var(--pixel)*.7) #f0ae70}
.meter{display:block;flex:none;width:calc(var(--pixel)*25);height:calc(var(--pixel)*6);padding:calc(var(--pixel)*.6);border:calc(var(--pixel)*.7) solid #b29965;border-radius:calc(var(--pixel)*.4);background:#29291e;overflow:hidden}
.meter i{display:block;height:100%;max-width:100%;background:#d1a64f;box-shadow:inset 0 calc(var(--pixel)*.7) #f0d18b}
.weapon{justify-self:end}
.weapon{display:flex;align-items:center;gap:.3cqw}.weapon-icon{width:2.3cqw;height:2.3cqw;object-fit:contain}
.pattern-rule{position:absolute;left:2cqw;top:14.3cqw;max-width:42cqw;padding:.55cqw .85cqw;border-radius:.55cqw;border:.1cqw solid #f0daab88;background:#172b36d9;display:flex;flex-direction:column;gap:.3cqw;font-size:.95cqw;line-height:1.5;pointer-events:auto}.pattern-rule strong{font-size:1.15cqw;color:#ffdfa4}.pattern-rule span{color:#f1f4e5}.pattern-description{color:#ffdfa4}
.breath{position:absolute;left:calc(var(--pixel)*40);top:calc(var(--pixel)*39);display:flex;align-items:center;gap:.5cqw;padding:.4cqw .7cqw;border:.1cqw solid #86d7d6;border-radius:.6cqw;background:#102c3ce6;color:#dcffff;font-size:1.1cqw;white-space:nowrap}.breath-meter{width:9cqw;height:.7cqw;border-radius:1cqw;background:#203e4d;overflow:hidden}.breath-meter i{display:block;height:100%;background:linear-gradient(90deg,#32a9d6,#9af5db);transition:width .15s linear}.breath small{font-size:.85cqw;color:#aadbe2}.breath.recovering .breath-meter i{background:#8be8a4}.breath.low{border-color:#ffac70;color:#ffcf9b}.breath.low .breath-meter i{background:#ff805b;animation:pulse .7s alternate infinite}
.timer{position:absolute;right:2.6cqw;top:1.4cqw;display:flex;justify-content:center;min-width:2.1em;padding:.4em .4em .45em;color:#fff0bd;background-color:transparent;background-size:100% 100%;border:0;box-shadow:none;font-size:3.65cqw;line-height:1;text-shadow:none;image-rendering:auto}
.timer.warning{color:#ffbd84;border-color:#ba6245}.boss{position:absolute;bottom:1.8cqw;left:30cqw;width:40cqw;display:flex;flex-direction:column;gap:.55cqw;align-items:center;font-size:1.4cqw}.boss-meter{width:100%;height:.8cqw;background:#1c100c;border:.18cqw solid #b89357;border-radius:1cqw;overflow:hidden}.boss-meter i{display:block;height:100%;background:linear-gradient(#ffac70,#ce3930);transition:width .15s}.banner{position:absolute;left:15%;right:15%;top:24%;text-align:center;font-size:3.2cqw;color:#ffe3a0;filter:drop-shadow(2px 3px 1px #27160d);animation:appear .25s ease-out}.banner small{display:block;font-size:1.9cqw;margin-top:1cqw}.help{position:absolute;bottom:1cqw;left:50%;transform:translateX(-50%);padding:.55cqw 1cqw;border-radius:2cqw;background:#17130cba;font-size:.95cqw;white-space:nowrap}.pause{position:absolute;inset:0;display:grid;place-items:center;background:#0d0b08b0;pointer-events:auto}.pause-card{width:44cqw;padding:2.6cqw;background:linear-gradient(135deg,#443325,#201911);border:.2cqw solid #b28e52;border-radius:.7cqw;box-shadow:0 1cqw 4cqw #0008;text-align:center}.pause h2{font-size:3cqw;margin:0 0 1.8cqw}.pause p{font-size:1.15cqw;line-height:1.6}.pause button{display:inline-flex;align-items:center;gap:1cqw;margin:1.5cqw .5cqw 0;padding:.9cqw 1.5cqw;background:#b48a47;border:1px solid #f0d19b;border-radius:.3cqw;color:#20160e;font-weight:700;font-size:1.3cqw;cursor:pointer}.pause button:hover{background:#e0b765}kbd{opacity:.6;font-size:.9cqw}.mute{position:absolute;right:2cqw;top:5cqw;font-size:.8cqw}.out{opacity:.4}@keyframes pulse{to{opacity:.4}}@keyframes appear{from{transform:scale(1.2);opacity:0}to{transform:scale(1);opacity:1}}
</style>
