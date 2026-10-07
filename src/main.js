// Boot: read config, create the shared renderer, mount the UI and one home experience.
import * as THREE from 'three'
import { getExperienceName } from './config.js'
import { FlowerExperience } from './experiences/flower/FlowerExperience.js'
import { initCards } from './ui/cards.js'
import { showVideo, initProjectOverlay } from './ui/projectOverlay.js'
import { initInfoOverlay } from './ui/infoOverlay.js'
import { initNav } from './ui/nav.js'
import { initVolume, initTimeline, initSoundToggle } from './ui/playback.js'
import { initCursor, resizeCursor } from './ui/cursor.js'
import { initLogo } from './ui/logo.js'
import { initMusic } from './ui/music.js'

const EXPERIENCES = {
  flower: FlowerExperience,
}

function createExperience() {
  const name = getExperienceName()
  const Ctor = EXPERIENCES[name]
  if (!Ctor) {
    console.warn(`Unknown experience "${name}", falling back to "flower"`)
    return new FlowerExperience()
  }
  return new Ctor()
}

// Shared renderer (canvas sits behind all the UI)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x050505, 1)
document.body.appendChild(renderer.domElement)

const experience = createExperience()
experience.init({
  renderer,
  openProject: (id) => showVideo(id),
})

const overlayHooks = { onOverlay: (kind, open) => experience.onOverlay(kind, open) }

initCards((project) => experience.selectProject(project))
initProjectOverlay(overlayHooks)
initInfoOverlay(overlayHooks)
initNav()

// Single render loop for the home experience
let last = performance.now()
function animate(now = performance.now()) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now
  experience.update(dt)
}
animate()

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  experience.resize(window.innerWidth, window.innerHeight)
  resizeCursor()
})

initVolume()
initCursor()
initLogo()
initTimeline()
initSoundToggle()
initMusic()
