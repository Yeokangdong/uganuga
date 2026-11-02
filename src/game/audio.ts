/** ElevenLabs audio, decoded once and mixed through WebAudio; synthesis is a loading fallback. */
type Song = 'stage' | 'boss'

const N = (semi: number) => 220 * Math.pow(2, semi / 12)

// 펜타토닉 원시 리듬 (16분음표, 0 = 쉼)
const STAGE_MELODY = [
  7, 0, 10, 0, 12, 0, 10, 7, 5, 0, 7, 0, 3, 0, 0, 0,
  7, 0, 10, 0, 12, 0, 15, 12, 10, 0, 12, 10, 7, 0, 0, 0,
  12, 0, 15, 0, 17, 0, 15, 12, 10, 0, 12, 0, 7, 0, 5, 0,
  3, 0, 5, 0, 7, 0, 10, 7, 5, 0, 3, 0, 0, 0, 0, 0,
]
const STAGE_BASS = [-12, 0, 0, -12, 0, 0, -5, 0, -12, 0, 0, -12, 0, 0, -7, 0]
const BOSS_MELODY = [
  0, 0, 3, 0, 0, 0, 6, 0, 5, 0, 3, 0, 1, 0, 0, 0,
  0, 0, 3, 0, 0, 0, 6, 0, 8, 0, 6, 5, 3, 0, 0, 0,
]
const BOSS_BASS = [-24, -24, -12, -24, -24, -12, -21, -12, -24, -24, -12, -24, -23, -11, -22, -10]

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private timer: number | null = null
  private nextTime = 0
  private step = 0
  private song: Song | null = null
  private buffers=new Map<string,AudioBuffer>()
  private loading=new Map<string,Promise<AudioBuffer|null>>()
  private musicBuffer:AudioBuffer|null=null
  private musicSources=new Set<AudioBufferSourceNode>()
  private musicKey=''
  private musicRevision=0
  private nextMusicTime=0
  private voices=0
  private lastEffects=new Map<string,number>()
  muted = false
  musicEnabled = false
  private requestedMusic:{song:Song;theme:string}|null=null

  init(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.45
        this.master.connect(this.ctx.destination)
        this.musicGain = this.ctx.createGain()
        this.musicGain.gain.value = this.musicEnabled ? 0.46 : 0
        this.musicGain.connect(this.master)
        for(const key of ['hit','jump','stun','kill','pickup','hurt','throw','big','roar','fanfare','sad','scrat'])void this.load(key)
        if(this.musicEnabled)void this.load('jungle')
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      this.ctx = null
    }
  }

  private load(key:string):Promise<AudioBuffer|null> {
    if(this.buffers.has(key))return Promise.resolve(this.buffers.get(key)!)
    const pending=this.loading.get(key)
    if(pending)return pending
    const music=['jungle','volcano','glacier','boss'].includes(key)
    const request=fetch(`/assets/audio/${key}.${music?'mp3':'wav'}?v=20261101-dry2`)
      .then(response=>{if(!response.ok)throw Error('audio unavailable');return response.arrayBuffer()})
      .then(bytes=>this.ctx!.decodeAudioData(bytes))
      .then(buffer=>{this.buffers.set(key,buffer);return buffer})
      .catch(()=>{this.loading.delete(key);return null})
    this.loading.set(key,request)
    return request
  }

  private sample(key:string,volume=.85):boolean {
    const c=this.ctx,buffer=this.buffers.get(key)
    if(!c||!this.master||!buffer)return false
    if(c.currentTime-(this.lastEffects.get(key)??-10)<.075||this.voices>=8)return true
    this.lastEffects.set(key,c.currentTime)
    const source=c.createBufferSource(),gain=c.createGain()
    source.buffer=buffer;gain.gain.value=volume
    source.connect(gain);gain.connect(this.master);this.voices++
    source.onended=()=>{this.voices--;source.disconnect();gain.disconnect()}
    source.start()
    return true
  }

  setPaused(paused:boolean):void {
    if(!this.ctx)return
    if(paused)void this.ctx.suspend()
    else void this.ctx.resume()
  }

  stun():void {
    if(this.sample('stun',.65))return
    this.tone(900,.2,'triangle',.12,450)
  }

  /** A nonverbal creature shriek generated as SFX, never human text-to-speech. */
  scrat():void {
    if(this.sample('scrat',.8))return
    const c=this.ctx;if(!c)return
    const t=c.currentTime
    this.tone(1250,.085,'sine',.13,2050,t)
    this.tone(1950,.12,'triangle',.055,1050,t+.075)
    this.tone(1500,.07,'sine',.07,1850,t+.23)
    for(const offset of [.32,.43,.54]){
      this.tone(420,.025,'triangle',.055,220,t+offset)
      this.noise(.018,.025,1500,t+offset)
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45
    return this.muted
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slide?: number, at = 0, dest?: AudioNode): void {
    const c = this.ctx
    if (!c || !this.master) return
    const t = (at || c.currentTime) + 0.001
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest ?? this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol = 0.2, freq = 1200, at = 0, dest?: AudioNode): void {
    const c = this.ctx
    if (!c || !this.master) return
    const t = (at || c.currentTime) + 0.001
    const len = Math.floor(c.sampleRate * dur)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(dest ?? this.master)
    src.start(t)
  }

  jump(): void { if(this.sample('jump'))return; this.tone(260, 0.14, 'square', 0.1, 620) }
  throw(): void { if(this.sample('throw'))return; this.noise(0.07, 0.18, 2500); this.tone(500, 0.06, 'triangle', 0.08, 300) }
  big(): void { if(this.sample('big'))return; this.tone(140, 0.3, 'sawtooth', 0.18, 60); this.noise(0.2, 0.2, 900) }
  hit(): void { if(this.sample('hit'))return; this.tone(200, 0.08, 'square', 0.14, 90) }
  kill(): void { if(this.sample('kill'))return; this.tone(700, 0.18, 'triangle', 0.16, 140); this.noise(0.1, 0.12, 1800) }
  hurt(): void { if(this.sample('hurt'))return; this.tone(330, 0.3, 'sawtooth', 0.16, 70) }
  pickup(): void { if(this.sample('pickup'))return;
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(660, 0.08, 'square', 0.1, undefined, t)
    this.tone(990, 0.12, 'square', 0.1, undefined, t + 0.08)
  }
  tick(): void { this.tone(1200, 0.06, 'square', 0.09) }
  charge(): void { this.tone(500, 0.18, 'square', 0.08, 1400) }
  thud(): void { if(this.sample('big'))return; this.noise(0.35, 0.45, 260); this.tone(70, 0.3, 'sine', 0.3, 40) }
  roar(): void { if(this.sample('roar'))return; this.noise(1.1, 0.35, 500); this.tone(110, 1.0, 'sawtooth', 0.22, 55) }
  explode(): void { if(this.sample('big'))return; this.noise(0.5, 0.35, 700) }
  fanfare(): void { if(this.sample('fanfare'))return;
    if (!this.ctx) return
    const t = this.ctx.currentTime
    ;[0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(N(s + 3), 0.22, 'square', 0.12, undefined, t + i * 0.14))
  }
  sad(): void { if(this.sample('sad'))return;
    if (!this.ctx) return
    const t = this.ctx.currentTime
    ;[7, 6, 5, 4, 3].forEach((s, i) => this.tone(N(s), 0.35, 'triangle', 0.14, undefined, t + i * 0.25))
  }

  // ───────── BGM ─────────
  setMusicEnabled(enabled:boolean):void {
    this.musicEnabled=enabled
    if(this.musicGain)this.musicGain.gain.value=enabled ? .46 : 0
    if(!enabled)this.stopMusic()
    else if(this.requestedMusic)this.playMusic(this.requestedMusic.song,this.requestedMusic.theme)
  }

  playMusic(song: Song,theme=''): void {
    this.requestedMusic={song,theme}
    if(!this.musicEnabled){this.stopMusic();return}
    const key=song==='boss'?'boss':theme==='2'||theme==='volcano'?'volcano':theme==='3'||theme==='glacier'?'glacier':'jungle'
    if(!this.ctx||(this.song===song&&this.musicKey===key))return
    this.stopMusic()
    this.song=song;this.musicKey=key;this.step=0
    this.nextTime=this.ctx.currentTime+.1
    const revision=this.musicRevision
    void this.load(key).then(buffer=>{
      if(revision!==this.musicRevision||!this.ctx)return
      this.musicBuffer=buffer;this.nextMusicTime=this.ctx.currentTime+.03
      this.nextTime=this.ctx.currentTime+.03
      this.timer=window.setInterval(()=>this.schedule(),50)
      this.schedule()
    })
  }

  stopMusic(): void {
    this.musicRevision++
    if(this.timer!==null)window.clearInterval(this.timer)
    this.timer=null;this.song=null;this.musicKey='';this.musicBuffer=null
    for(const source of this.musicSources){source.stop()}
    this.musicSources.clear()
  }

  private schedule(): void {
    const c = this.ctx
    if (!c || !this.song || !this.musicGain) return
    if(this.musicBuffer){
      // Overlap the loop tails so MP3 padding and a generated ending cannot click.
      while(this.nextMusicTime<c.currentTime+.3){
        const source=c.createBufferSource(),gain=c.createGain(),buffer=this.musicBuffer
        const duration=buffer.duration,fade=Math.min(.4,duration/4),at=Math.max(c.currentTime+.005,this.nextMusicTime)
        source.buffer=buffer;source.connect(gain);gain.connect(this.musicGain)
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.78,at+fade)
        gain.gain.setValueAtTime(.78,at+duration-fade);gain.gain.linearRampToValueAtTime(0,at+duration)
        this.musicSources.add(source)
        source.onended=()=>{this.musicSources.delete(source);source.disconnect();gain.disconnect()}
        source.start(at);this.nextMusicTime=at+duration-fade
      }
      return
    }
    const boss = this.song === 'boss' 
    const stepDur = boss ? 0.1 : 0.12
    const mel = boss ? BOSS_MELODY : STAGE_MELODY
    const bass = boss ? BOSS_BASS : STAGE_BASS
    while (this.nextTime < c.currentTime + 0.2) {
      const s = this.step
      const t = this.nextTime
      const m = mel[s % mel.length]
      if (m) this.tone(N(m + (boss ? 12 : 12)), stepDur * 1.6, boss ? 'sawtooth' : 'square', 0.07, undefined, t, this.musicGain)
      const b = bass[s % bass.length]
      if (b) this.tone(N(b), stepDur * 1.4, 'triangle', 0.22, undefined, t, this.musicGain)
      // 북
      if (s % 4 === 0) this.tone(120, 0.15, 'sine', 0.35, 45, t, this.musicGain)
      if (s % 8 === 4) this.noise(0.08, 0.18, 3000, t, this.musicGain)
      if (boss && s % 2 === 1) this.noise(0.03, 0.06, 6000, t, this.musicGain)
      this.nextTime += stepDur
      this.step++
    }
  }
}

export const sfx = new Sfx()
