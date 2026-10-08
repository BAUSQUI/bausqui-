// Sound for the tornado home: three stems played with the Web Audio API.
//
//   music-port            → portGain    ┐   the main ambient bed: always playing
//   music-tornado         → tornadoGain ├→ master → analyser → destination
//   music-tornado-details → detailsGain ┘   a short loop on top
//
// - Every stem is decoded to an AudioBuffer and loops on its OWN length (lengths differ on
//   purpose: the details are a short loop). All start at the same context time.
// - The context is created and the stems start on the first gesture (pointerdown, keydown,
//   touchend; mousemove doesn't count); the master fades in over ~1.5s.
// - The bottom-left music toggle drives the master (music.js defers to this engine).
// - The storm calms while a work is hovered (incl. its leave delay), while About / Vision /
//   Contact is open and during the click explosion: both tornado stems fade out (~600ms)
//   and only music-port remains; they come back over ~1.2s.
// - Inside a project: both tornado stems muted; music-port ducks to ~15%, and to 0 while
//   the project video's own sound is on. Closing brings everything back with slow fades.
// - Every change is a gain ramp (setTargetAtTime / linearRampToValueAtTime), never a jump.
// - Hidden tab: the context is suspended, and resumed when visible.
// - Media guard (mediaGuard.js): webdriver or ?mute=1 → no audio at all.
import { state } from '../../state.js'
import { playback } from '../../ui/playback.js'
import { audioBlocked } from '../../ui/mediaGuard.js'

const STEMS = {
  port: '/music-port.mp3',
  tornado: '/music-tornado.mp3',
  details: '/music-tornado-details.mp3',
}

export class TornadoAudio {
  // isCalm(): true while a work is hovered (incl. its leave delay) or the click explosion runs
  constructor({ isCalm }) {
    this.params = {
      master: 0.6,        // master volume (when the toggle is on)
      port: 1,            // music-port (main ambient bed) volume
      tornado: 1.8,         // music-tornado volume
      details: 0.8,         // music-tornado-details volume
      masterFadeIn: 1.5,  // s, first start
      toggleFade: 0.4,    // s, music toggle on / off
      calmOut: 0.6,       // s, tornado stems fading out (hover / About / explosion / project)
      calmIn: 1.2,        // s, everything coming back
      projectDuck: 0.15,  // music-port level inside a project
      duckTime: 0.8,      // s, music-port ducking into a project / to 0 under the video's sound
    }
    this.isCalm = isCalm
    this.buffers = null
    this.ctx = null
    this.started = false
    this.applied = {}
    this.blocked = audioBlocked
    // music.js defers the bottom-left toggle (and its waveform) to this engine
    window.__musicOverride = this
    if (this.blocked) { window.__loaderDone?.('music'); return }

    // Loading is started by the experience once the scene's core is up (loader order). At
    // 100% main.js calls start(); if the browser keeps the context suspended (autoplay), the
    // first gesture anywhere resumes it. Listeners are passive: the click isn't consumed.
    // A gesture on the music toggle waits for its click, so turning the sound off never blips.
    this.onGesture = (e) => {
      if (window.__loader && !window.__loader.entered) return
      if (!this.started) { this.start(); return }
      if (this.ctx?.state !== 'suspended' || document.hidden) return
      if (e?.target?.closest?.('#music-toggle')) setTimeout(() => { if (state.musicEnabled) this.ctx.resume() }, 0)
      else this.ctx.resume()
    }
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, this.onGesture, true)
    this.onVisibility = () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else this.ctx.resume()
    }
    document.addEventListener('visibilitychange', this.onVisibility)
    this.timer = setInterval(() => this.tick(), 80)
  }

  get playing() { return this.started && this.ctx?.state === 'running' }
  // Started but blocked by the browser until a gesture (the toggle's waveform pulses)
  get waiting() { return !this.blocked && (!this.started || this.ctx?.state === 'suspended') }

  async load() {
    if (this.blocked || this.loading) return
    this.loading = true
    const L = window.__loader
    // Loader weights (progress only), roughly by file size
    const WEIGHT = { port: 4, tornado: 2, details: 1 }
    try {
      // Decode without a live context (no autoplay warning); AudioBuffers work in any context
      const decoder = new OfflineAudioContext(2, 1, 44100)
      const names = Object.keys(STEMS)
      names.forEach(name => L?.add(`audio:${name}`, WEIGHT[name]))
      const decoded = await Promise.all(names.map(async (name) => {
        try {
          const res = await fetch(STEMS[name])
          if (!res.ok) throw new Error(`${STEMS[name]}: HTTP ${res.status}`)
          return await decoder.decodeAudioData(await res.arrayBuffer())
        } finally {
          L?.done(`audio:${name}`)   // loaded or failed: never blocks the loader
        }
      }))
      this.buffers = Object.fromEntries(names.map((n, i) => [n, decoded[i]]))
    } catch (e) {
      console.warn('[tornado audio] Could not load the stems', e)
    }
    window.__loaderDone?.('music')
    if (this.wantsStart) this.start()
  }

  // First user gesture: create / resume the context and start all stems together
  start() {
    if (this.blocked || this.started) return
    if (!this.buffers) { this.wantsStart = true; return }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    const p = this.params
    this.master = ctx.createGain()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 64
    this.analyser.smoothingTimeConstant = 0.75
    this.master.connect(this.analyser).connect(ctx.destination)

    const target = this.targets()
    const t0 = ctx.currentTime + 0.1
    this.gains = {}
    this.sources = {}
    for (const name of Object.keys(STEMS)) {
      const gain = ctx.createGain()
      gain.gain.value = target[name]   // stems start at their current targets
      gain.connect(this.master)
      const src = ctx.createBufferSource()
      src.buffer = this.buffers[name]
      src.loop = true                  // each loops on its own length
      src.connect(gain)
      src.start(t0)                    // same instant for all
      this.gains[name] = gain
      this.sources[name] = src
    }
    // The master fades in
    this.master.gain.setValueAtTime(0, t0)
    this.master.gain.linearRampToValueAtTime(target.master, t0 + p.masterFadeIn)
    this.applied = { ...target, masterUntil: t0 + p.masterFadeIn }
    this.started = true
    ctx.resume()
  }

  targets() {
    const p = this.params
    const inProject = state.isVideoMode
    const calm = this.isCalm() || state.isInfoMode
    const v = playback.currentPlayingVideo
    const videoAudible = inProject && ((v && !v.muted && !v.paused) || (playback.currentYouTube && !playback.ytMuted))
    const tornadoOn = !calm && !inProject
    return {
      master: state.musicEnabled ? p.master : 0,
      port: inProject ? (videoAudible ? 0 : p.port * p.projectDuck) : p.port,
      tornado: tornadoOn ? p.tornado : 0,
      details: tornadoOn ? p.details : 0,
    }
  }

  // Smooth ramp from the current value (anchored, so a new target never jumps)
  ramp(param, value, seconds) {
    const now = this.ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.setTargetAtTime(value, now, Math.max(0.01, seconds / 3))   // ~95% there after `seconds`
  }

  tick() {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return
    const p = this.params
    const t = this.targets()
    const a = this.applied
    for (const name of ['tornado', 'details']) {
      if (t[name] !== a[name]) this.ramp(this.gains[name].gain, t[name], t[name] < a[name] ? p.calmOut : p.calmIn)
    }
    if (t.port !== a.port) this.ramp(this.gains.port.gain, t.port, t.port < a.port ? p.duckTime : p.calmIn)
    // Master: let the first fade-in finish unless the toggle turns it off
    if (t.master !== a.master && (this.ctx.currentTime >= a.masterUntil || t.master === 0)) {
      this.ramp(this.master.gain, t.master, p.toggleFade)
      a.masterUntil = 0
    }
    Object.assign(a, { port: t.port, tornado: t.tornado, details: t.details, master: a.masterUntil ? a.master : t.master })
  }

  dispose() {
    clearInterval(this.timer)
    if (this.onGesture) for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, this.onGesture, true)
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility)
    try { Object.values(this.sources || {}).forEach(s => s.stop()) } catch (e) { /* already stopped */ }
    this.ctx?.close()
    if (window.__musicOverride === this) delete window.__musicOverride
  }
}
