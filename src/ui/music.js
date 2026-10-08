// ── BACKGROUND MUSIC + WAVEFORM VISUALIZER ─────────────
import { state } from '../state.js'
import { audioBlocked } from './mediaGuard.js'

// On the tornado home a Web Audio stems engine (experiences/tornado/tornadoAudio.js) sets
// window.__musicOverride: the toggle then just flips state.musicEnabled (the engine follows
// it) and the waveform reads the engine's analyser; <audio id="bg-music"> stays silent.
const override = () => window.__musicOverride

function shouldPlayMusic() {
  if (audioBlocked) return false
  if (!state.musicEnabled) return false
  if (state.isVideoMode) return false
  return true   // Home + every info section (About / Vision / Contact)
}
// Smooth volume fade so play/pause transitions don't click or stutter
let musicFadeRaf = null
let musicTargetVol = 0.4
function fadeMusic(targetVol, duration, done) {
  cancelAnimationFrame(musicFadeRaf)
  const bgMusic = document.getElementById('bg-music')
  if (!bgMusic) return
  const startVol = bgMusic.volume
  const startTime = performance.now()
  const tick = () => {
    const t = Math.min(1, (performance.now() - startTime) / duration)
    bgMusic.volume = startVol + (targetVol - startVol) * t
    if (t < 1) {
      musicFadeRaf = requestAnimationFrame(tick)
    } else if (done) {
      done()
    }
  }
  tick()
}

export function updateMusic() {
  if (override()) return
  const bgMusic = document.getElementById('bg-music')
  if (!bgMusic) return
  if (shouldPlayMusic()) {
    if (bgMusic.paused) {
      bgMusic.volume = 0
      bgMusic.play().catch(() => {})
    }
    fadeMusic(musicTargetVol, 350)
  } else {
    fadeMusic(0, 250, () => { try { bgMusic.pause() } catch (e) {} })
  }
}

export function initMusic() {
  const bgMusic = document.getElementById('bg-music')
  const musicBtn = document.getElementById('music-toggle')
  const canvas   = document.getElementById('music-viz')
  if (!bgMusic || !musicBtn || !canvas) return

  bgMusic.volume = 0.4
  musicTargetVol = 0.4

  // Belt-and-suspenders looping. Some browsers ignore the native `loop`
  // attribute when MediaElementSource is connected to a Web Audio graph.
  bgMusic.loop = true
  bgMusic.addEventListener('ended', () => {
    try {
      bgMusic.currentTime = 0
      bgMusic.play().catch(() => {})
    } catch (e) {}
  })
  // Some browsers fire `pause` near the end instead of `ended`. Re-poke it.
  bgMusic.addEventListener('timeupdate', () => {
    if (bgMusic.duration && bgMusic.currentTime > bgMusic.duration - 0.25) {
      // Safe wrap a hair before the end avoids the silent gap
      bgMusic.currentTime = 0
    }
  })

  // Mark loader progress when music has enough data (the stems engine reports its own)
  if (override() || audioBlocked) {
    bgMusic.preload = 'none'
    if (audioBlocked && !override()) window.__loaderDone?.('music')
  } else if (bgMusic.readyState >= 3) {
    window.__loaderDone?.('music')
  } else {
    bgMusic.addEventListener('canplaythrough', () => window.__loaderDone?.('music'), { once: true })
    bgMusic.addEventListener('loadeddata',     () => window.__loaderDone?.('music'), { once: true })
  }

  // Crisp canvas on retina
  const CSS_W = 84, CSS_H = 22
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  canvas.width  = CSS_W * dpr
  canvas.height = CSS_H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const BARS = 18
  const GAP  = 2
  const BAR_W = (CSS_W - GAP * (BARS - 1)) / BARS

  // Smoothed bar heights for graceful falloff when paused
  const heights = new Array(BARS).fill(0)

  let audioCtx = null
  let analyser = null
  let dataArray = null

  function ensureAudioGraph() {
    if (audioCtx) return
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaElementSource(bgMusic)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64                  // 32 frequency bins
      analyser.smoothingTimeConstant = 0.75
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      src.connect(analyser)
      analyser.connect(audioCtx.destination)
    } catch (e) {
      console.warn('Audio analyser unavailable', e)
    }
  }

  function drawViz() {
    requestAnimationFrame(drawViz)
    ctx.clearRect(0, 0, CSS_W, CSS_H)

    const o = override()
    const an = o ? o.analyser : analyser
    if (o && an && (!dataArray || dataArray.length !== an.frequencyBinCount)) dataArray = new Uint8Array(an.frequencyBinCount)
    const playing = state.musicEnabled && (o ? o.playing : !bgMusic.paused)
    const targets = new Array(BARS).fill(0)

    if (playing && an) {
      an.getByteFrequencyData(dataArray)
      // Pull lower-mid bins (audible musical range), skipping the very bottom
      const start = 1
      for (let i = 0; i < BARS; i++) {
        const idx = Math.min(start + i, dataArray.length - 1)
        targets[i] = (dataArray[idx] / 255)
      }
    } else if (state.musicEnabled) {
      if (o && o.waiting) {
        // Waiting for a gesture to start the sound: a slow, soft pulse
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700)
        for (let i = 0; i < BARS; i++) targets[i] = 0.06 + 0.16 * pulse * (0.7 + 0.3 * Math.sin(i * 0.9))
      } else {
        // Idle wiggle while loading / waiting
        const t = performance.now() / 600
        for (let i = 0; i < BARS; i++) {
          targets[i] = 0.08 + 0.06 * Math.sin(t + i * 0.5)
        }
      }
    }
    // else: bars decay to 0

    // Smooth toward target
    for (let i = 0; i < BARS; i++) {
      heights[i] += (targets[i] - heights[i]) * 0.25
    }

    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(1.5, heights[i] * CSS_H)
      const x = i * (BAR_W + GAP)
      const y = (CSS_H - h) / 2
      ctx.fillRect(x, y, BAR_W, h)
    }
  }
  drawViz()

  // Music starts enabled by default — try to autoplay
  state.musicEnabled = true
  musicBtn.classList.add('is-on')

  const tryStart = () => {
    if (override() || audioBlocked) return
    // Nothing plays before the loader finishes (the user is then in, automatically)
    if (window.__loader && !window.__loader.entered) return
    if (!state.musicEnabled) return
    ensureAudioGraph()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
    bgMusic.play().catch(() => {})
  }
  tryStart()

  // If the browser blocked autoplay, retry on first user gesture
  const onFirstGesture = () => {
    tryStart()
    if (!bgMusic.paused) {
      window.removeEventListener('pointerdown', onFirstGesture, true)
      window.removeEventListener('keydown', onFirstGesture, true)
      window.removeEventListener('touchstart', onFirstGesture, true)
    }
  }
  window.addEventListener('pointerdown', onFirstGesture, true)
  window.addEventListener('keydown', onFirstGesture, true)
  window.addEventListener('touchstart', onFirstGesture, true)

  musicBtn.addEventListener('click', () => {
    if (!override() && !audioBlocked) {
      ensureAudioGraph()
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
    }

    state.musicEnabled = !state.musicEnabled
    musicBtn.classList.toggle('is-on', state.musicEnabled)
    updateMusic()
  })

  // Update music state when scrolling between info sections
  const sections = ['info-about', 'info-vision', 'info-contact']
    .map(id => document.getElementById(id))
    .filter(Boolean)

  if (sections.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      let best = null
      let bestRatio = 0
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio
          best = e.target.id
        }
      })
      if (best) {
        let next = state.currentInfoTarget
        if (best === 'info-about') next = 'about'
        else if (best === 'info-vision') next = 'vision'
        else if (best === 'info-contact') next = 'contact'
        // Only react when the active section actually changes — avoids
        // rapid play/pause flicker as multiple thresholds trip during scroll
        if (next !== state.currentInfoTarget) {
          state.currentInfoTarget = next
          if (state.isInfoMode) updateMusic()
        }
      }
    }, { threshold: [0.55] })

    sections.forEach(s => obs.observe(s))
  }
}
