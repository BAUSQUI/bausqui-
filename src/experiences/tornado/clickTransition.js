// Click transition: the tornado explodes and comes apart, then the project opens.
// On return (overlay closed) it reassembles: the same burst, reversed.
//
//   impact  (first 1–2 frames): drawn impact frames in the composite — a high-contrast
//           silhouette frame, then an inverted one. Capped well below full white, never
//           repeated (photosensitivity).
//   burst   (impactMs → burstEnd): strokes break off along the spin and outward with
//           smears + speed lines, thinning and splitting; particles scatter radially; the
//           other works are flung out, tumbling (InkTornado.burst / TornadoExperience).
//   focus   (focusStart → focusEnd): the clicked work flies to the camera, fills the screen
//           and goes to full brightness (the hover highlight pass, in color).
//   handoff (focusEnd → handoffEnd): the project overlay fades in over the frozen frame.
//           The video starts loading at the click.
//
// Every interaction (hover, clicks, wheel / touch / key scroll) is blocked while the
// tornado explodes or reassembles. Reduced motion, or a list click with the hero off
// screen: no explosion, the overlay's own fade in and out.
import { getProject } from '../../data/projects.js'

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'])

export class ClickTransition {
  constructor({ onOpen }) {
    this.onOpen = onOpen
    this.params = {
      impactMs: 80,        // impact frames happen inside this; the burst starts after it
      impactFrames: 2,     // 1 = silhouette only, 2 = silhouette then inverted
      impactLevel: 0.82,   // brightest value an impact frame may use (never full white)
      burstEnd: 0.7,       // s
      focusStart: 0.3,     // s
      focusEnd: 1.0,       // s
      handoffEnd: 1.2,     // s
      returnDuration: 1.0, // s
    }
    this.mode = 'idle'     // idle | explode | handoff | open | assemble
    this.t = 0
    this.frame = 0
    this.burst = 0
    this.focus = 0
    this.impact = 0
    this.mesh = null
    this.projectId = null

    this.blocker = document.createElement('div')
    this.blocker.className = 'tornado-blocker'
    this.blocker.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;background:transparent;'
    document.body.append(this.blocker)
    this.onWheel = (e) => { if (this.blocking) e.preventDefault() }
    this.onKey = (e) => { if (this.blocking && SCROLL_KEYS.has(e.key)) e.preventDefault() }
    this.onBlockedClick = (e) => { e.preventDefault(); e.stopPropagation() }
    window.addEventListener('wheel', this.onWheel, { passive: false, capture: true })
    window.addEventListener('touchmove', this.onWheel, { passive: false, capture: true })
    window.addEventListener('keydown', this.onKey, { capture: true })
    this.blocker.addEventListener('click', this.onBlockedClick)
    this.blocker.addEventListener('pointerdown', this.onBlockedClick)
  }

  get busy() { return this.mode === 'explode' || this.mode === 'handoff' || this.mode === 'assemble' }
  get exploded() { return this.mode !== 'idle' }

  setBlocking(on) {
    this.blocking = on
    this.blocker.style.display = on ? 'block' : 'none'
  }

  // Start loading the project's video right away, so it's ready at the handoff
  preload(id) {
    const src = getProject(id)?.data?.video
    if (!src) return
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    v.src = src
    v.load()
    this.preloaded = v
  }

  explode(mesh, id) {
    if (this.mode !== 'idle') return
    this.mode = 'explode'
    this.t = 0
    this.frame = 0
    this.mesh = mesh
    this.projectId = id
    this.preload(id)
    this.setBlocking(true)
  }

  // No explosion: the overlay's own fade in (and out)
  fadeOpen(id) {
    if (this.mode !== 'idle') return
    this.onOpen(id)
  }

  update(dt) {
    const q = this.params
    if (this.mode === 'explode') {
      this.t += dt
      this.frame++
      // Drawn impact frames: frame 1 silhouette, frame 2 inverted, then never again
      this.impact = this.frame <= q.impactFrames ? this.frame : 0
      const impact = q.impactMs / 1000
      this.burst = smooth((this.t - impact) / Math.max(0.01, q.burstEnd - impact))
      this.focus = smooth((this.t - q.focusStart) / Math.max(0.01, q.focusEnd - q.focusStart))
      if (this.t >= q.focusEnd) this.handoff()
    } else if (this.mode === 'assemble') {
      this.t += dt
      this.impact = 0
      const k = smooth(this.t / Math.max(0.01, q.returnDuration))
      this.burst = 1 - k
      this.focus = 1 - k
      if (this.t >= q.returnDuration) this.finish()
    } else {
      this.impact = 0
      if (this.mode === 'idle') { this.burst = 0; this.focus = 0 }
    }
  }

  // The overlay fades in over the frozen last frame
  handoff() {
    const q = this.params
    this.mode = 'handoff'
    const ms = Math.max(0, (q.handoffEnd - q.focusEnd) * 1000)
    const overlay = document.getElementById('video-overlay')
    if (overlay) overlay.style.transition = `opacity ${ms}ms ease`
    this.onOpen(this.projectId)
    this.preloaded = null
    clearTimeout(this.handoffTimer)
    this.handoffTimer = setTimeout(() => {
      if (overlay) overlay.style.transition = ''
      if (this.mode === 'handoff') this.mode = 'open'
      this.setBlocking(false)
    }, ms + 30)
  }

  // Overlay closed: reassemble (the burst in reverse)
  assemble() {
    if (this.mode !== 'open' && this.mode !== 'handoff') return
    clearTimeout(this.handoffTimer)
    this.mode = 'assemble'
    this.t = 0
    this.burst = 1
    this.focus = 1
    this.setBlocking(true)
  }

  finish() {
    this.mode = 'idle'
    this.burst = 0
    this.focus = 0
    this.mesh = null
    this.projectId = null
    this.setBlocking(false)
  }

  dispose() {
    clearTimeout(this.handoffTimer)
    window.removeEventListener('wheel', this.onWheel, { capture: true })
    window.removeEventListener('touchmove', this.onWheel, { capture: true })
    window.removeEventListener('keydown', this.onKey, { capture: true })
    this.blocker.remove()
  }
}
