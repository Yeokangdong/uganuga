import Phaser from 'phaser'
import { BootScene, TitleScene } from './scenes'
import './style.css'
import { MapScene } from './mapScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#102d32',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, MapScene],
  loader: { maxRetries: 0 },
})

// Keep a read-only handle for headless lifecycle verification.
Object.defineProperty(window, '__phaserGame', { value: game, configurable: true })
const dispose = () => {
  window.removeEventListener('pagehide', dispose)
  game.destroy(true)
}
window.addEventListener('pagehide', dispose)
if (import.meta.hot) import.meta.hot.dispose(dispose)
