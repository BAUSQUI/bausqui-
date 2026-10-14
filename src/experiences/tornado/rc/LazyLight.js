// Cursor light with lag: JS port of the lazy-brush smoothing in buffer-a.glsl.
// The light trails the pointer at a distance of RADIUS and closes the gap with
// frame-rate independent easing (1 - FRICTION^(dt*10)).
// No autonomous motion (the reference's idle Lissajous path is dropped): before the
// first pointer move the light is off; when the mouse leaves the window it stays
// where it is and fades out; on re-entry it appears at the pointer and fades in.
// `presence` (0..1) is the fade, to multiply into the light's intensity.
// Coordinates are CSS pixels, origin top-left.
// Touch devices (`touch: true`): touch feedback only. It appears at the touch point on
// touchstart, follows the finger while dragging, and fades out over TOUCH_FADE_OUT after
// touchend; the rest of the time it's off (base light + inner lights only).
const FADE_TIME = 0.4        // s
const TOUCH_FADE_OUT = 0.6   // s

export class LazyLight {
  constructor({ radius = 0.015, friction = 0.05, touch = false } = {}) {
    this.touch = touch
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
    if (touch) {
      const point = (e) => e.touches[0] && { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      this.onTouch = (e) => { const p = point(e); if (p) this.onMove(p) }
      this.onTouchEnd = (e) => { if (!e.touches.length) this.onLeave() }
      window.addEventListener('touchstart', this.onTouch, { passive: true })
      window.addEventListener('touchmove', this.onTouch, { passive: true })
      window.addEventListener('touchend', this.onTouchEnd, { passive: true })
      window.addEventListener('touchcancel', this.onTouchEnd, { passive: true })
      return
    }
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerdown', this.onMove)
    document.documentElement.addEventListener('mouseleave', this.onLeave)
  }

  update(dt, w, h) {
    const out = this.touch ? TOUCH_FADE_OUT : FADE_TIME
    this.fade = Math.min(1, Math.max(0, this.fade + (this.inside ? dt / FADE_TIME : -dt / out)))
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
    if (this.touch) {
      window.removeEventListener('touchstart', this.onTouch)
      window.removeEventListener('touchmove', this.onTouch)
      window.removeEventListener('touchend', this.onTouchEnd)
      window.removeEventListener('touchcancel', this.onTouchEnd)
      return
    }
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerdown', this.onMove)
    document.documentElement.removeEventListener('mouseleave', this.onLeave)
  }
}
