// Boot: read config, create the shared renderer, mount the UI and one home experience.
import * as THREE from 'three'
import { getExperienceName } from './config.js'
import { FlowerExperience } from './experiences/flower/FlowerExperience.js'
import { TornadoExperience } from './experiences/tornado/TornadoExperience.js'
import { initCards } from './ui/cards.js'
import { showVideo, initProjectOverlay } from './ui/projectOverlay.js'
import { initInfoOverlay } from './ui/infoOverlay.js'
import { initNav } from './ui/nav.js'
import { initVolume, initTimeline, initSoundToggle } from './ui/playback.js'
import { initCursor, resizeCursor } from './ui/cursor.js'
import { initLogo } from './ui/logo.js'
import { initMusic, updateMusic } from './ui/music.js'
import { state } from './state.js'
import { audioBlocked } from './ui/mediaGuard.js'

const rcTestMode = import.meta.env.DEV && getExperienceName() === 'rc-test'
const RCTestExperience = rcTestMode
  ? (await import('./experiences/tornado/rc/RCTestExperience.js')).RCTestExperience
  : null
// `?debug=ink`: the ink style test page (dev only)
const inkTestMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'ink'
const InkTestExperience = inkTestMode
  ? (await import('./experiences/ink/InkTestExperience.js')).InkTestExperience
  : null
// Dev test pages run without the site UI
const devPageMode = rcTestMode || inkTestMode

const EXPERIENCES = {
  flower: FlowerExperience,
  tornado: TornadoExperience,
  ...(rcTestMode ? { 'rc-test': RCTestExperience } : {}),
}

function createExperience() {
  if (inkTestMode) return new InkTestExperience()
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
// Loader: an experience with `ownLoader` registers its own assets (in load order) and seals
// the loader itself (the tornado: core first, then thumbnails + audio). Otherwise its
// static loaderKeys + the background music are registered here and sealed after init.
const loader = window.__loader
if (devPageMode) {
  document.getElementById('loader')?.remove()
  document.body.classList.remove('is-loading')
} else if (!experience.constructor.ownLoader) {
  window.__loaderUseKeys?.(experience.constructor.loaderKeys)
  loader?.add('music')
}
experience.init({
  renderer,
  openProject: (id) => showVideo(id),
})

const overlayHooks = { onOverlay: (kind, open) => experience.onOverlay(kind, open) }
if (!devPageMode && !experience.constructor.ownLoader) loader?.seal()

// At 100% the user is in (no gate): try to start the sound right away. If the browser
// blocks it, it starts on the first gesture anywhere (tornadoAudio.js / music.js). The music
// toggle is the only off switch. Media guard: never starts.
loader?.onEnter(() => {
  if (audioBlocked) state.musicEnabled = false
  document.getElementById('music-toggle')?.classList.toggle('is-on', state.musicEnabled)
  if (window.__musicOverride) window.__musicOverride.start()
  else updateMusic()
})

if (!devPageMode) {
initCards((project) => experience.selectProject(project))
initProjectOverlay(overlayHooks)
initInfoOverlay(overlayHooks)
initNav()
}

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
  if (!devPageMode) resizeCursor()
})

if (!devPageMode) {
initVolume()
initCursor()
initLogo()
initTimeline()
initSoundToggle()
initMusic()
} else {
  document.querySelectorAll('audio, video').forEach(media => { media.pause(); media.muted = true })
  window.__loaderDone?.('music')
}


