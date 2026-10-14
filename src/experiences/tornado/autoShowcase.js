// Touch devices only (hover: none, pointer: coarse): there is no hover, so the tornado
// rescues works by itself, one at a time (CLAUDE.md "Mobile behavior").
// - A work leaves its slot for the CENTER of the screen (approach), the tornado stops and the
//   work lights up with its label centered below it (WorkHover, same states as the hover).
// - A drawn-ink glint + Kirby dots twinkle at a corner during the hold: it can be tapped.
// - Nobody taps: it returns to its slot (release), the tornado spins back up, and after a
//   short free spin the next work is rescued. Every project once (one random thumbnail
//   each) before repeating, never the same project twice in a row.
// Poses are applied on top of the slot transforms each frame, so a work that is released
// simply eases back onto its (moving) slot.
import * as THREE from 'three'

export const SHOWCASE_DEFAULTS = {
  approach: 0.8,    // s: slot → center
  hold: 1.7,        // s: featured, lit, label + glint
  release: 0.8,     // s: center → slot
  free: 2.5,        // s: free spin between works
  calmAudio: true,  // the auto cycle uses the hover's calm audio state (taps always do)
}
const REDUCED_MOTION_SLOWER = 1.6   // reduced motion: the whole cycle runs this much slower
const RESUME_DELAY = 0.8            // s after a touch / scroll before the cycle runs again
const CENTER_WIDTH = 0.62           // featured work: this fraction of the screen width
const CENTER_Y = 0.12               // NDC: a little above the middle, the label goes below
const CENTER_DEPTH = 0.62           // fraction of the camera → funnel-front distance

const ease = (k) => k * k * (3 - 2 * k)

export class AutoShowcase {
  constructor({ camera, reducedMotion, onFeature, onRelease }) {
    this.camera = camera
    this.reducedMotion = reducedMotion
    this.onFeature = onFeature   // (mesh, auto) → light it + show its label
    this.onRelease = onRelease   // () → label off, tornado spins back up
    this.params = { ...SHOWCASE_DEFAULTS }
    this.featured = null
    this.auto = false            // the featured work came from the cycle (not a tap)
    this.phase = 'free'          // free | approach | hold | release
    this.timer = 0
    this.poses = new Map()       // mesh → k (0 slot … 1 center), incl. works easing back
    this.queue = []
    this.lastProject = null
    this.touching = false
    this.idleFor = Infinity      // s since the last touch / scroll
    this.frontDepth = 4          // camera → funnel front, set by the experience
    this.tmp = { fwd: new THREE.Vector3(), up: new THREE.Vector3(), pos: new THREE.Vector3(), scale: new THREE.Vector3() }

    this.onDown = (e) => { if (e.pointerType === 'touch') { this.touching = true; this.idleFor = 0 } }
    this.onUp = (e) => { if (e.pointerType === 'touch') { this.touching = false; this.idleFor = 0 } }
    this.onScroll = () => { this.idleFor = 0 }
    window.addEventListener('pointerdown', this.onDown, { passive: true })
    window.addEventListener('pointerup', this.onUp, { passive: true })
    window.addEventListener('pointercancel', this.onUp, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    this.buildGlint()
  }

  get slow() { return this.reducedMotion.matches ? REDUCED_MOTION_SLOWER : 1 }

  // The tap target: a 4-point drawn glint (concave sides, hard edges, flat white) plus a
  // couple of Kirby dots. Twinkles once or twice during the hold; static with reduced motion.
  buildGlint() {
    const svgNS = 'http://www.w3.org/2000/svg'
    this.glint = document.createElementNS(svgNS, 'svg')
    this.glint.setAttribute('class', 'tornado-glint')
    this.glint.setAttribute('viewBox', '0 0 40 40')
    this.glint.setAttribute('aria-hidden', 'true')
    this.glint.innerHTML =
      '<path class="tornado-glint-star" d="M16 2 C17.2 11 19 13.6 30 16 C19 18.4 17.2 21 16 30 C14.8 21 13 18.4 2 16 C13 13.6 14.8 11 16 2 Z"/>' +
      '<circle class="tornado-glint-dot" cx="31" cy="5.5" r="2.4"/>' +
      '<circle class="tornado-glint-dot tornado-glint-dot-2" cx="35.5" cy="11" r="1.5"/>'
    document.body.append(this.glint)
  }

  // Next work: every project once per round, never the same project twice in a row; one
  // random loaded thumbnail of it, preferring the near side of the funnel (a clear path)
  pick(meshes) {
    const visible = meshes.filter(m => m.visible)
    if (!visible.length) return null
    const projects = [...new Set(visible.map(m => m.userData.projectId))]
    this.queue = this.queue.filter(id => projects.includes(id))
    if (!this.queue.length) {
      this.queue = projects.sort(() => Math.random() - 0.5)
      if (this.queue.length > 1 && this.queue[0] === this.lastProject) this.queue.push(this.queue.shift())
    }
    const id = this.queue.shift()
    const own = visible.filter(m => m.userData.projectId === id)
    const near = own.filter(m => m.position.z > 0)
    const list = near.length ? near : own
    return list[Math.floor(Math.random() * list.length)]
  }

  // Make `mesh` the featured work now (a tap interrupts the cycle; the previous one eases back)
  feature(mesh, auto = false) {
    if (mesh === this.featured) return
    this.featured = mesh
    this.auto = auto
    this.lastProject = mesh.userData.projectId
    // A tapped project counts as shown in this round
    this.queue = this.queue.filter(id => id !== this.lastProject)
    if (!this.poses.has(mesh)) this.poses.set(mesh, 0)
    this.phase = 'approach'
    this.timer = 0
    this.setGlint(false)
    this.onFeature(mesh, auto)
  }

  release() {
    if (!this.featured) return
    this.featured = null
    this.phase = 'release'
    this.timer = 0
    this.setGlint(false)
    this.onRelease()
  }

  // Project opened / overlay over the home: forget everything (the scene is hidden, so the
  // works snap back to their slots unseen); the cycle restarts with a free spin
  reset() {
    this.featured = null
    this.phase = 'free'
    this.timer = 0
    this.poses.clear()
    this.setGlint(false)
  }

  setGlint(on) {
    this.glint.classList.toggle('is-visible', on)
    this.glint.classList.toggle('is-static', on && this.reducedMotion.matches)
    // Restart the twinkle on each hold
    if (on && !this.reducedMotion.matches) {
      this.glint.classList.remove('is-twinkling')
      void this.glint.getBoundingClientRect()
      this.glint.classList.add('is-twinkling')
    } else this.glint.classList.remove('is-twinkling')
  }

  // frozen: the click transition owns the scene (poses hold, nothing advances)
  update(dt, meshes, { frozen = false } = {}) {
    const q = this.params, slow = this.slow
    this.idleFor += dt
    if (frozen) return
    const paused = this.touching || this.idleFor < RESUME_DELAY
    // Poses: the featured work heads for the center, every other one eases back to its slot
    for (const [mesh, k] of this.poses) {
      const next = mesh === this.featured
        ? Math.min(1, k + dt / (q.approach * slow))
        : Math.max(0, k - dt / (q.release * slow))
      if (next <= 0 && mesh !== this.featured) this.poses.delete(mesh)
      else this.poses.set(mesh, next)
    }
    if (this.phase === 'approach' && this.poses.get(this.featured) >= 1) {
      this.phase = 'hold'
      this.timer = 0
      this.setGlint(true)
    } else if (this.phase === 'hold') {
      if (!paused) this.timer += dt
      if (this.timer >= q.hold * slow) this.release()
    } else if (this.phase === 'release') {
      if (this.poses.size === 0) { this.phase = 'free'; this.timer = 0 }
    } else if (this.phase === 'free') {
      if (!paused) this.timer += dt
      if (this.timer >= q.free * slow) {
        const mesh = this.pick(meshes)
        if (mesh) this.feature(mesh, true)
        else this.timer = 0
      }
    }
  }

  // After the slot transforms: blend each posed work toward a camera-facing pose at the
  // center (in front of the funnel), keeping its 16:9 proportions
  apply() {
    if (!this.poses.size) return
    const cam = this.camera, t = this.tmp
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2)
    const depth = Math.max(0.5, this.frontDepth * CENTER_DEPTH)
    const visH = 2 * depth * Math.tan(halfFov)
    t.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
    t.up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    t.pos.copy(cam.position).addScaledVector(t.fwd, depth).addScaledVector(t.up, CENTER_Y * visH / 2)
    const w = CENTER_WIDTH * visH * cam.aspect
    for (const [mesh, k] of this.poses) {
      const e = ease(k)
      t.scale.set(w, w * mesh.scale.y / Math.max(1e-6, mesh.scale.x), 1)
      mesh.position.lerp(t.pos, e)
      mesh.quaternion.slerp(cam.quaternion, e)
      mesh.scale.lerp(t.scale, e)
      mesh.updateMatrixWorld()
    }
  }

  // The glint sits on the featured work's top-right corner (screen space)
  placeGlint() {
    const mesh = this.featured
    if (!mesh || !this.glint.classList.contains('is-visible')) return
    const v = this.tmp.pos.set(0.5, 0.5, 0)
    mesh.localToWorld(v).project(this.camera)
    const x = (v.x + 1) / 2 * window.innerWidth, y = (1 - v.y) / 2 * window.innerHeight
    this.glint.style.transform = `translate(${x}px, ${y}px)`
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    window.removeEventListener('scroll', this.onScroll)
    this.glint.remove()
  }
}
