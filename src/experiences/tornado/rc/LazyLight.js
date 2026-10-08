// Cursor light with lag: JS port of the lazy-brush smoothing in buffer-a.glsl.
// The light trails the pointer at a distance of RADIUS and closes the gap with
// frame-rate independent easing (1 - FRICTION^(dt*10)).
// No autonomous motion (the reference's idle Lissajous path is dropped): before the
// first pointer move the light is off; when the mouse leaves the window it stays
// where it is and fades out; on re-entry it appears at the pointer and fades in.
// `presence` (0..1) is the fade, to multiply into the light's intensity.
// Coordinates are CSS pixels, origin top-left.
const FADE_TIME = 0.4   // s

export class LazyLight {
  constructor({ radius = 0.015, friction = 0.05 } = {}) {
    this.radiusFactor = radius   // × viewport height, like RADIUS in the reference
    this.friction = friction
    this.x = null
    this.y = null
    this.targetX = 0
    this.targetY = 0
    this.inside = false
    this.fade = 0                // linear 0..1; presence is its eased value
    this.presence = 0
    this.onMove = (e) => {
      this.targetX = e.clientX
      this.targetY = e.clientY
      if (!this.inside) {
        // (Re)entering: start at the pointer, no sweep across the screen
        this.inside = true
        this.x = e.clientX
        this.y = e.clientY
      }
    }
    this.onLeave = () => {
      this.inside = false
      // Stay put while fading out
      if (this.x !== null) { this.targetX = this.x; this.targetY = this.y }
    }
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerdown', this.onMove)
    document.documentElement.addEventListener('mouseleave', this.onLeave)
  }

  update(dt, w, h) {
    this.fade = Math.min(1, Math.max(0, this.fade + (this.inside ? dt : -dt) / FADE_TIME))
    this.presence = this.fade * this.fade * (3 - 2 * this.fade)
    if (this.x === null || !this.inside) return

    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0) {
      const len = Math.max(dist - this.radiusFactor * h, 0)
      const ease = 1 - Math.pow(this.friction, dt * 10)
      this.x += (dx / dist) * len * ease
      this.y += (dy / dist) * len * ease
    }
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerdown', this.onMove)
    document.documentElement.removeEventListener('mouseleave', this.onLeave)
  }
}
