// "Eye of the storm": the background while a project is open. The viewer is inside the
// tornado, in its calm center. A light mode (no works, no RC): a ring of drawn-ink strokes
// circulates around the screen edges in the tornado's direction — fewer, slower and at a
// flat low level — plus sparse, faint particles orbiting the center.
//
// - Calm zone: an ellipse around the overlay content in view (video, controls, text,
//   manual). Stroke control points get zero width inside it, fading in across its border,
//   so nothing ever crosses the content; particles vanish there too.
// - Scroll link: scrolling toward the manual turns the storm a little further.
// - Continuity: on open the ring settles in from outside (the click burst flying out and
//   slowing into orbit); on close it pulls inward and fades while the tornado reassembles.
// Same drawn-ink renderer and rules as the tornado (CLAUDE.md "Ink rendering rules").
import * as THREE from 'three'
import { InkStrokes, SHAPE } from '../ink/inkStrokes.js'
import { InkParticles } from '../ink/inkParticles.js'

const POINTS = 20
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }

// Desktop counts; mobile gets about half. width: half width in CSS px; span: radians
const CLASSES = {
  heavy: { n: 8, width: [10, 18], span: [0.35, 0.6], shapes: [SHAPE.comma, SHAPE.crescent, SHAPE.teardrop], dry: [0, 0.4], split: [0.2, 0.5] },
  medium: { n: 30, width: [3, 8], span: [0.25, 0.55], shapes: [SHAPE.crescent, SHAPE.comma, SHAPE.hook], dry: [0.3, 0.8], split: [0, 0.5] },
  fine: { n: 44, width: [0.8, 1.8], span: [0.2, 0.8], shapes: [SHAPE.crescent, SHAPE.speedLine], dry: [0.4, 1], split: [0, 0.2] },
}

// Particles orbiting the center (world = CSS px, origin at the screen center, y up)
class EyeSpace {
  constructor(eye) { this.e = eye }
  spawn(m) {
    m.rho = rand(0.3, 1.6)
    m.a = Math.random() * Math.PI * 2
    m.omega = rand(0.03, 0.08)
    m.dissolve = 1
  }
  step(m, dt) { m.a -= dt * m.omega * this.e.speedMul; return true }   // clockwise, like the tornado
  position(m, out) {
    const e = this.e
    const rho = m.rho * e.ringScale
    const a = m.a - e.scrollTurn * 0.5
    return out.set(Math.cos(a) * e.w * 0.5 * rho, Math.sin(a) * e.h * 0.5 * rho, 0)
  }
  near() { return 0 }
  pxPerUnit() { return this.e.pixelRatio }
  // Gone inside the calm zone; fading with the settle / close
  scale(m) {
    const v = this.position(m, this.e._v)
    return this.e.calmK(v.x, v.y) * this.e.presence
  }
}

export class InkEye {
  constructor() {
    this.params = {
      speed: 0.07,        // rad/s around the center
      white: 0.62,        // flat ink level (the overlay's 55% veil brings it to ~25–30%)
      scrollTurn: 0.0006, // extra rotation per px scrolled toward the manual
      settle: 0.9,        // s: the ring settling in from the burst
      calmBorder: 0.18,   // fade band outside the calm zone (× its radius)
      calmShape: 4,       // calm zone superellipse exponent: 2 = ellipse, higher = squarer
    }
    this.mobile = window.matchMedia('(max-width: 700px)').matches
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const density = this.mobile ? 0.5 : 1
    this.strokes = new InkStrokes(160)
    this.strokes.material.uniforms.uWhite.value = this.params.white
    this.particles = new InkParticles({ space: new EyeSpace(this), specks: Math.round(70 * density), clusters: Math.round(4 * density) })
    this.particles.material.uniforms.uWhite.value = 0.5
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050505)
    this.scene.add(this.particles.points)
    this.scene.add(this.strokes.mesh)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    this.defs = []
    for (const [cls, c] of Object.entries(CLASSES)) {
      for (let i = 0; i < Math.round(c.n * density); i++) {
        this.defs.push({
          cls, shape: pick(c.shapes), width: rand(...c.width), span: rand(...c.span),
          // Denser toward the corners (outer radii), thinning toward the center
          rho: 0.82 + 0.75 * Math.sqrt(Math.random()),
          theta: Math.random() * Math.PI * 2, k: rand(0.6, 1.4),
          dryness: rand(...c.dry), split: rand(...c.split), rough: rand(0.8, 1.5), seed: Math.random() * 1000,
        })
      }
    }
    this.calm = { cx: 0, cy: 0, ax: 1, ay: 1, ready: false }
    this.t = 0
    this.settleT = 0
    this.closeT = 0
    this.w = 1
    this.h = 1
    this.pixelRatio = 1
    this.scrollTurn = 0
    this.ringScale = 1
    this.presence = 1
    this.speedMul = 1
    this._v = new THREE.Vector3()
    this.list = []
  }

  resize(w, h, pixelRatio) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.pixelRatio = pixelRatio
    Object.assign(this.camera, { left: -this.w / 2, right: this.w / 2, top: this.h / 2, bottom: -this.h / 2 })
    this.camera.updateProjectionMatrix()
    this.strokes.setViewport(this.w * pixelRatio, this.h * pixelRatio)
  }

  // Opening: the ring settles in from outside (continuing the click burst)
  start() {
    this.settleT = 0
    this.closeT = 0
    this.calm.ready = false
  }

  // 0 inside the calm zone, rising to 1 across its border band. The zone is a superellipse
  // (a squarer ellipse): smooth, but it hugs the content box instead of swallowing the screen.
  calmK(x, y) {
    const c = this.calm
    const n = this.params.calmShape
    const d = Math.pow(Math.pow(Math.abs((x - c.cx) / c.ax), n) + Math.pow(Math.abs((y - c.cy) / c.ay), n), 1 / n)
    return smooth((d - 1) / this.params.calmBorder)
  }

  // dt: wall clock; scroll: px scrolled in the overlay; calm: { cx, cy, ax, ay } in world;
  // closing: the overlay is fading out (the ring pulls back in)
  update(dt, { scroll, calm, closing }) {
    const q = this.params
    this.speedMul = this.reduced.matches ? 0.35 : 1
    this.t += dt * this.speedMul
    this.settleT += dt
    this.closeT = closing ? this.closeT + dt : 0
    // The calm zone follows the content in view (eased, so scrolling never pops it)
    if (calm) {
      const c = this.calm
      const k = c.ready ? 1 - Math.exp(-dt * 10) : 1
      c.cx += (calm.cx - c.cx) * k; c.cy += (calm.cy - c.cy) * k
      c.ax += (calm.ax - c.ax) * k; c.ay += (calm.ay - c.ay) * k
      c.ready = true
    }
    const settle = smooth(this.settleT / q.settle)
    const close = smooth(this.closeT / 0.7)
    // Settling: from far out (the burst) into orbit; closing: pulling in and fading
    // Closing: the ring pulls in toward the funnel (still drawn) and hands over to the
    // tornado reassembly, whose strokes start at the edges and spiral in
    this.ringScale = (1 + (1 - settle) * 0.45) * (1 - 0.35 * close)
    this.presence = settle * (1 - 0.5 * close)
    this.scrollTurn = scroll * q.scrollTurn
    this.strokes.material.uniforms.uWhite.value = q.white
    this.strokes.updateBoil(dt)

    const list = this.list
    list.length = 0
    const rx = this.w * 0.5, ry = this.h * 0.5
    for (const d of this.defs) {
      // Clockwise like the tornado; outer strokes a touch slower (differential)
      const head = d.theta - this.t * q.speed * d.k * (1.2 - 0.3 * (d.rho - 1)) - this.scrollTurn * (0.8 + 0.4 * d.k)
      const points = [], widthK = []
      for (let i = 0; i < POINTS; i++) {
        const f = i / (POINTS - 1)
        const a = head + f * d.span   // the tail trails behind the head
        const rho = (d.rho + 0.02 * Math.sin(f * 3 + this.t * 0.5 + d.seed)) * this.ringScale
        const x = Math.cos(a) * rx * rho, y = Math.sin(a) * ry * rho
        points.push(new THREE.Vector3(x, y, 0))
        // Through widthK (not widthScale) so 0 really hides it: no 1px thread left over
        widthK.push(this.calmK(x, y) * this.presence)
      }
      list.push({ shape: d.shape, width: d.width, dryness: d.dryness, split: d.split,
        rough: d.rough, tone: 1, seed: d.seed, points, widthK })
    }
    this.strokes.setStrokes(list)
    this.particles.update(dt, this.strokes.material.uniforms.uBoil.value, this.pixelRatio)
  }

  dispose() {
    this.strokes.dispose()
    this.particles.dispose()
  }
}
