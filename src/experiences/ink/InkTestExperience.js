// `?debug=ink` (dev only): the ink style on its own, before it builds the tornado.
// Black page, 8 isolated strokes of different scales moving along one looping curve,
// plus particles. No tornado, no thumbnails, no site UI.
// Strokes are discrete ribbons (inkStrokes.js); the noise only moves their control
// points, the fast parts of the loop get drawn multiples (smear frames) and speed
// lines, and the drawing boils at its own rate while the motion stays at 60 fps.
import * as THREE from 'three'
import { Experience } from '../Experience.js'
import { InkStrokes, SHAPE } from './inkStrokes.js'
import { InkParticles } from './inkParticles.js'

// width: half width in CSS px; len: radians of the loop; omega: rad/s
const STROKES = [
  { name: 'heavy mass', shape: SHAPE.comma, width: 44, len: 1.15, omega: 0.42, dryness: 0.15, split: 0.25, rough: 1.0 },
  { name: 'medium crescent', shape: SHAPE.crescent, width: 17, len: 0.9, omega: 0.63, dryness: 0.55, split: 0.5, rough: 1.2 },
  { name: 'medium teardrop', shape: SHAPE.teardrop, width: 21, len: 0.55, omega: 0.55, dryness: 0.3, split: 0, rough: 0.9 },
  { name: 'hook', shape: SHAPE.hook, width: 13, len: 0.75, omega: 0.74, dryness: 0.7, split: 0.35, rough: 1.3, curl: 1 },
  { name: 'fine thread', shape: SHAPE.crescent, width: 2.2, len: 1.5, omega: 0.9, dryness: 0.8, split: 0, rough: 1.6 },
  { name: 'fine thread 2', shape: SHAPE.comma, width: 3.2, len: 1.05, omega: 0.81, dryness: 0.6, split: 0, rough: 1.4 },
  { name: 'speed line', shape: SHAPE.speedLine, width: 5, len: 0.8, omega: 1.15, dryness: 0.4, split: 0, rough: 0.6 },
  { name: 'halftone mid-tone', shape: SHAPE.crescent, width: 30, len: 0.95, omega: 0.36, dryness: 0.35, split: 0.3, rough: 1.0, tone: 0.45 },
]
const POINTS = 28

export class InkTestExperience extends Experience {
  static loaderKeys = {}

  init({ renderer }) {
    this.renderer = renderer
    this.disposed = false
    this.time = 0
    this.params = { speed: 1, smearSpeed: 700, smears: true, speedLines: true }
    this.style = document.createElement('style')
    this.style.textContent = `body > :not(canvas):not(.lil-gui):not(.ink-test-note) { display: none !important; }
      .ink-test-note { position: fixed; bottom: 24px; left: 24px; z-index: 10000; color: #fff;
        font: 11px Helvetica, Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase;
        pointer-events: none; opacity: .7; }`
    document.head.append(this.style)
    this.note = document.createElement('p')
    this.note.className = 'ink-test-note'
    document.body.append(this.note)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050505)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    this.strokes = new InkStrokes(64)
    this.particles = new InkParticles()
    this.scene.add(this.particles.points)
    this.scene.add(this.strokes.mesh)
    // Each stroke rides its own concentric loop (radius ring) so they read as isolated objects
    const RINGS = [1.0, 0.82, 0.62, 0.92, 1.12, 0.72, 1.04, 0.52]
    this.defs = STROKES.map((d, i) => ({ ...d, ring: RINGS[i % RINGS.length],
      u: i * (Math.PI * 2 / STROKES.length), seed: 11.3 * i + 3.7, phase: i * 1.9 }))
    this.pool = []
    this.cursor = null
    this.onMove = (e) => { this.cursor = { cx: e.clientX, cy: e.clientY } }
    this.onLeave = () => { this.cursor = null }
    window.addEventListener('pointermove', this.onMove)
    document.documentElement.addEventListener('mouseleave', this.onLeave)
    this.resize(window.innerWidth, window.innerHeight)
    this.initGui()
  }

  resize(w, h) {
    w = Math.max(1, w)
    h = Math.max(1, h)
    this.renderer.setSize(w, h)
    this.w = w
    this.h = h
    // World units = CSS px, origin at the center
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 })
    this.camera.updateProjectionMatrix()
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.strokes.setViewport(size.x, size.y)
    this.pxPerUnit = size.x / w
  }

  // The loop the strokes travel on (world = CSS px)
  curve(u, out, ring = 1) {
    const rx = this.w * 0.34 * ring, ry = this.h * 0.3 * ring
    return out.set(
      rx * Math.cos(u) + rx * 0.14 * Math.cos(2 * u + 0.6),
      ry * Math.sin(u) + ry * 0.22 * Math.sin(2 * u),
      0,
    )
  }

  // Control points for one stroke: from its head (s = 0, leading) back along the loop.
  // Smooth noise displaces the points (never pixels); a hook curls its tail.
  buildPath(d, u, widthScale = 1, lateral = 0) {
    const pts = []
    const a = new THREE.Vector3(), b = new THREE.Vector3()
    for (let i = 0; i < POINTS; i++) {
      const f = i / (POINTS - 1)
      const uu = u - f * d.len
      this.curve(uu, a, d.ring)
      this.curve(uu + 0.01, b, d.ring)
      const tx = b.x - a.x, ty = b.y - a.y
      const tl = Math.hypot(tx, ty) || 1
      const nx = -ty / tl, ny = tx / tl
      // Whip: the tail swings more than the head; slow, smooth, per stroke
      let off = lateral + (14 + d.width * 0.8) * f * Math.sin(f * 2.4 + this.time * 0.9 + d.seed)
      if (d.curl) off += d.width * 3.2 * Math.pow(Math.max(0, f - 0.55) / 0.45, 2.2) * widthScale
      pts.push(new THREE.Vector3(a.x + nx * off, a.y + ny * off, 0))
    }
    // Hook: bend the last points around into a curl
    if (d.curl) {
      const n = pts.length
      const pivot = pts[Math.floor(n * 0.7)]
      for (let i = Math.floor(n * 0.7); i < n; i++) {
        const f = (i - n * 0.7) / (n * 0.3)
        const ang = f * 1.2
        const dx = pts[i].x - pivot.x, dy = pts[i].y - pivot.y
        pts[i].set(pivot.x + dx * Math.cos(ang) - dy * Math.sin(ang), pivot.y + dx * Math.sin(ang) + dy * Math.cos(ang), 0)
      }
    }
    return pts
  }

  update(dt) {
    if (this.disposed) return
    const q = this.params
    this.time += dt
    this.strokes.updateBoil(dt)
    const list = []
    const a = new THREE.Vector3(), b = new THREE.Vector3()
    for (const d of this.defs) {
      // Speed changes along the loop: fast stretches get smear frames and speed lines
      const rate = d.omega * q.speed * (1 + 0.85 * Math.sin(d.u * 1.5 + d.phase))
      d.u += dt * rate
      this.curve(d.u, a, d.ring); this.curve(d.u + 0.01, b, d.ring)
      const speedPx = a.distanceTo(b) / 0.01 * Math.abs(rate)
      const base = { shape: d.shape, width: d.width, dryness: d.dryness, split: d.split, rough: d.rough, tone: d.tone ?? 1, seed: d.seed }
      list.push({ ...base, points: this.buildPath(d, d.u) })
      const fast = speedPx > q.smearSpeed
      if (fast && q.smears) {
        // Drawn multiples: thinner, drier copies trailing behind (never motion blur)
        for (let k = 1; k <= 2; k++) {
          list.push({ ...base, width: d.width * (k === 1 ? 0.6 : 0.38), dryness: Math.min(1, d.dryness + 0.35 * k),
            split: Math.max(d.split, 0.5), seed: d.seed + k * 7.1,
            points: this.buildPath(d, d.u - k * 0.06 * Math.sign(rate), 1, (k % 2 ? 1 : -1) * d.width * 0.25) })
        }
      }
      if (fast && q.speedLines && d.width > 4) {
        // Speed lines: thin straight strokes behind the tail, along the motion
        const tail = this.curve(d.u - d.len, new THREE.Vector3(), d.ring)
        const prev = this.curve(d.u - d.len - 0.02, new THREE.Vector3(), d.ring)
        const dir = tail.clone().sub(prev).normalize()
        const nrm = new THREE.Vector3(-dir.y, dir.x, 0)
        const L = Math.min(speedPx * 0.18, 260)
        for (let k = -1; k <= 1; k++) {
          const start = tail.clone().addScaledVector(nrm, k * d.width * 0.9).addScaledVector(dir, -L * 0.15 * (k + 2))
          list.push({ shape: SHAPE.speedLine, width: 1.6, dryness: 0.3, split: 0, rough: 0.5, tone: 1, seed: d.seed + 20 + k,
            points: [start, start.clone().addScaledVector(dir, -L)] })
        }
      }
    }
    this.strokes.setStrokes(list)
    const sp = this.particles.space
    sp.halfW = this.w / 2
    sp.halfH = this.h / 2
    sp.pxScale = this.pxPerUnit
    sp.cursor = this.cursor ? { x: this.cursor.cx - this.w / 2, y: this.h / 2 - this.cursor.cy } : null
    this.particles.update(dt, this.strokes.material.uniforms.uBoil.value)
    const p = this.strokes.params
    this.note.textContent = `Ink style test — ${list.length} strokes · boil ${p.boil ? `on, ${p.boilRate}/s` : 'off'}`
    this.renderer.render(this.scene, this.camera)
  }

  async initGui() {
    if (!import.meta.env.DEV) return
    const { default: GUI } = await import('lil-gui')
    if (this.disposed) return
    const gui = this.gui = new GUI({ title: 'Ink style' })
    const s = this.strokes.params
    gui.add(s, 'boil').name('boil (redraw the drawing)')
    gui.add(s, 'boilRate', 2, 30, 1).name('boil rate (redraws/s)')
    gui.add(s, 'roughness', 0, 1.5, 0.01).name('edge roughness')
    gui.add(s, 'dryBrush', 0, 2, 0.01).name('dry brush')
    gui.add(s, 'halftoneCell', 2, 10, 0.5).name('halftone cell (px)')
    gui.add(this.params, 'speed', 0, 3, 0.01).name('motion speed')
    gui.add(this.params, 'smears').name('smear frames')
    gui.add(this.params, 'speedLines').name('speed lines')
    gui.add(this.params, 'smearSpeed', 100, 2000, 10).name('smear above (px/s)')
    const pp = this.particles.params
    gui.add(pp, 'specks', 0, 400, 1).name('grain specks')
    gui.add(pp, 'clusters', 0, 30, 1).name('Kirby clusters')
    gui.add(pp, 'speed', 0, 3, 0.01).name('particle speed')
  }

  dispose() {
    this.disposed = true
    this.gui?.destroy()
    window.removeEventListener('pointermove', this.onMove)
    document.documentElement.removeEventListener('mouseleave', this.onLeave)
    this.strokes.dispose()
    this.particles.dispose()
    this.style.remove()
    this.note.remove()
  }
}
