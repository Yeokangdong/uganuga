import Phaser from 'phaser'

const assets = [
  ['title', 'painted-v6/title-scene-costume-v2.webp'],
  ['logo', 'runtime_logo_crisp.webp'],
  ['hero', 'painted-v6/p1-d040fabca00a.webp'],
  ['start', 'word_click_to_start.webp'],
] as const
const idleFrames = [
  [2, 2, 80, 128, .4444444444444445],
  [86, 2, 82, 127, .43013550135501355],
  [172, 2, 83, 128, .4180990629183401],
  [259, 2, 82, 129, .42666666666666664],
  [345, 2, 81, 129, .42491083676268865],
  [430, 2, 82, 128, .42666666666666664],
]

export class BootScene extends Phaser.Scene {
  private failed = new Set<string>()
  private status!: Phaser.GameObjects.Text
  private bar!: Phaser.GameObjects.Rectangle
  constructor() { super('Boot') }

  create() {
    this.failed.clear()
    this.add.text(480, 175, '우가누가', { fontSize: '42px', color: '#ffe6a2' }).setOrigin(.5)
    this.status = this.add.text(480, 258, '원화 불러오는 중 · 0%', { fontSize: '22px' }).setOrigin(.5)
    this.add.rectangle(480, 310, 560, 18, 0x294b50)
    this.bar = this.add.rectangle(200, 310, 0, 18, 0xe9bf65).setOrigin(0, .5)
    const progress = (value: number) => {
      this.bar.width = 560 * value
      this.status.setText(`원화 불러오는 중 · ${Math.round(value * 100)}%`)
    }
    const error = (file: Phaser.Loader.File) => { this.failed.add(file.key) }
    const complete = () => {
      if (this.failed.size) {
        this.status.setText(`불러오기 실패: ${[...this.failed].join(', ')}\n클릭 또는 Space로 다시 시도`).setAlign('center')
        this.input.once('pointerdown', retry)
        this.input.keyboard?.once('keydown-SPACE', retry)
      } else {
        this.scene.start('Title')
      }
    }
    const retry = () => this.scene.restart()
    this.load.on('progress', progress)
    this.load.on('loaderror', error)
    this.load.once('complete', complete)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.load.off('progress', progress)
      this.load.off('loaderror', error)
      this.load.off('complete', complete)
      this.input.off('pointerdown', retry)
      this.input.keyboard?.off('keydown-SPACE', retry)
      this.failed.clear()
    })
    const missing = assets.filter(([key]) => !this.textures.exists(key))
    if (!missing.length) { this.scene.start('Title'); return }
    for (const [key, path] of missing) this.load.image(key, `${import.meta.env.BASE_URL}assets/${path}`)
    this.load.start()
  }
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title') }
  create() {
    this.add.image(480, 270, 'title').setDisplaySize(960, 540)
    const logo = this.add.image(480, 135, 'logo')
    logo.setScale(Math.min(620 / logo.width, 190 / logo.height))
    const texture = this.textures.get('hero')
    idleFrames.forEach(([x, y, w, h, ax], i) => {
      if (!texture.has(`idle-${i}`)) {
        const frame = texture.add(`idle-${i}`, 0, x!, y!, w!, h!)!
        frame.customPivot = true
        frame.pivotX = ax!
        frame.pivotY = 1
      }
    })
    // Animation belongs to this Scene; texture cache is shared across Scene restarts.
    if (!this.anims.exists('uga-idle')) this.anims.create({
      key: 'uga-idle', repeat: -1,
      frames: idleFrames.map((_, i) => ({ key: 'hero', frame: `idle-${i}`, duration: [222, 221, 222, 222, 221, 222][i] })),
      frameRate: 1000,
    })
    this.add.sprite(480, 445, 'hero', 'idle-0').setScale(1.15).play('uga-idle')
    const start = this.add.image(480, 492, 'start')
    start.setScale(Math.min(285 / start.width, 34 / start.height))
    // Step 1 only: input exercises Scene shutdown/re-entry, without implementing gameplay.
    const restart = () => this.scene.start('Boot')
    this.input.once('pointerdown', restart)
    this.input.keyboard?.once('keydown-SPACE', restart)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', restart)
      this.input.keyboard?.off('keydown-SPACE', restart)
      this.anims.remove('uga-idle')
    })
  }
}
