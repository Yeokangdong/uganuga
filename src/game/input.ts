export interface PlayerInput {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  attack: boolean
  jump: boolean
  attackPressed: boolean
  attackReleased: boolean
  jumpPressed: boolean
  downPressed: boolean
  throwPressed?: boolean
}

type Action = 'left' | 'right' | 'up' | 'down' | 'attack' | 'jump' | 'throw'
type KeyMap = Record<Action, string[]>

// 1P: 방향키 이동, ↑ 점프, 스페이스 공격
const P1_SOLO: KeyMap = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  attack: ['Space'],
  jump: ['ArrowUp'],
  throw: ['KeyX'],
}

const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'KeyX'])

function empty(): PlayerInput {
  return {
    left: false, right: false, up: false, down: false, attack: false, jump: false,
    attackPressed: false, attackReleased: false, jumpPressed: false, downPressed: false,
  }
}

export class Input {
  private keys = new Set<string>()
  private pressedOnce = new Set<string>()
  private maps: KeyMap[]
  private states: PlayerInput[]

  constructor() {
    this.maps = [P1_SOLO]
    this.states = this.maps.map(() => empty())
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
    window.addEventListener('blur', this.onBlur)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown)
    window.removeEventListener('keyup', this.onUp)
    window.removeEventListener('blur', this.onBlur)
  }

  private onDown = (e: KeyboardEvent): void => {
    if (BLOCK.has(e.code)) e.preventDefault()
    if (!this.keys.has(e.code)) this.pressedOnce.add(e.code)
    this.keys.add(e.code)
  }
  private onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }
  private onBlur = (): void => {
    this.keys.clear()
    this.pressedOnce.clear()
    this.states = this.maps.map(() => empty())
  }

  /** 한 프레임에 한 번 호출 */
  update(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
    this.maps.forEach((map, i) => {
      const prev = this.states[i]
      const has = (a: Action) => map[a].some((k) => this.keys.has(k))
      const pad = pads[i] ?? null
      const ax = pad ? pad.axes[0] ?? 0 : 0
      const ay = pad ? pad.axes[1] ?? 0 : 0
      const btn = (n: number) => !!pad && !!pad.buttons[n]?.pressed
      const s: PlayerInput = {
        left: has('left') || ax < -0.4 || btn(14),
        right: has('right') || ax > 0.4 || btn(15),
        up: has('up') || ay < -0.5 || btn(12),
        down: has('down') || ay > 0.5 || btn(13),
        attack: has('attack') || btn(2) || btn(1),
        jump: has('jump') || btn(0),
        attackPressed: false,
        attackReleased: false,
        jumpPressed: false,
        downPressed: false,
      }
      const tapped = (a: Action) => map[a].some(k => this.pressedOnce.has(k))
      s.attackPressed = (s.attack && !prev.attack) || tapped('attack')
      s.attackReleased = !s.attack && prev.attack
      s.jumpPressed = (s.jump && !prev.jump) || tapped('jump')
      s.downPressed = (s.down && !prev.down) || tapped('down')
      s.throwPressed=tapped('throw')
      this.states[i] = s
    })
  }

  get(i: number): PlayerInput {
    return this.states[i] ?? empty()
  }

  /** 특정 키가 이번 프레임에 눌렸는지 (일시정지 등) */
  consume(code: string): boolean {
    if (this.pressedOnce.has(code)) {
      this.pressedOnce.delete(code)
      return true
    }
    return false
  }

  endFrame(): void {
    this.pressedOnce.clear()
  }
}
