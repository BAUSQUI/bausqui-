// The tornado's swirl, built from DISCRETE DRAWN STROKES (experiences/ink). See CLAUDE.md
// "Ink rendering rules": nothing here touches pixels. Each stroke is a ribbon along a
// helical path around the funnel's live axis; this file only moves control points.
//
// - Stroke variety: three scales (a few heavy masses, medium strokes, many fine threads),
//   each stroke with its own shape, width, length, speed, ink load and filament split.
// - Tornado motion: strokes rise as they turn (helices); angular speed changes with
//   height, per stroke and with the radius (inner strokes faster), so they shear. Each
//   control point carries its depth around the axis: near-side strokes draw wider, the
//   far side thinner and in halftone, and the two sides cross the screen in opposite
//   directions. The axis sways and the radius breathes (shared with the works).
// - Every so often a stroke breaks away and is thrown outward (drawn multiples + speed
//   lines while it flies), and small flecks flick off stroke heads.
// - Collisions: the works push nearby control points aside and drag them along.
// - Particles (specks + Kirby dots) spiral in toward the funnel and dissolve into it.
// - Burst (click transition, see clickTransition.js): `burst` 0..1 throws every stroke off
//   along the spin and outward (smears + speed lines), thinning and splitting it, and
//   scatters the particles radially. Reassembly runs it back to 0 (burstSign -1).
import * as THREE from 'three'
import { InkStrokes, SHAPE } from '../ink/inkStrokes.js'
import { InkParticles } from '../ink/inkParticles.js'
import { axisOffset, breath } from './tornadoLayout.js'

const TAU = Math.PI * 2
const FUNNEL_CURVE = 1.6
const POINTS = 24          // control points per stroke
const MAX_FLECKS = 30

const CLASSES = {
  heavy: { n: 12, width: [0.22, 0.38], span: [0.9, 1.6], rf: [0.85, 1.2], shapes: [SHAPE.comma, SHAPE.crescent, SHAPE.teardrop], dry: [0, 0.35], split: [0.15, 0.45], rough: [0.8, 1.1] },
  medium: { n: 64, width: [0.07, 0.14], span: [0.6, 1.4], rf: [0.6, 1.3], shapes: [SHAPE.crescent, SHAPE.comma, SHAPE.hook, SHAPE.teardrop], dry: [0.2, 0.75], split: [0, 0.6], rough: [0.9, 1.4] },
  fine: { n: 130, width: [0.01, 0.024], span: [0.5, 1.8], rf: [0.4, 1.4], shapes: [SHAPE.crescent, SHAPE.speedLine, SHAPE.comma], dry: [0.4, 1], split: [0, 0.2], rough: [1.1, 1.7] },
}
const MEDIUM_WIDTH = 0.1

const rand = (a, b) => a + Math.random() * (b - a)
const pick = (list) => list[Math.floor(Math.random() * list.length)]

function funnelRadius(h, p) {
  const hh = Math.min(Math.max(h, 0), 1)
  return p.baseRadius + (p.topRadius - p.baseRadius) * Math.pow(hh, FUNNEL_CURVE)
}

// Particles' 3D space: spiral around the funnel axis, from outside the view inward
class FunnelSpace {
  constructor(owner) { this.o = owner }
  spawn(m, anywhere = false) {
    const p = this.o.p
    m.h = rand(0.05, 0.95)
    m.a = Math.random() * TAU
    const rStart = p.topRadius * 1.7 + 2
    m.r = anywhere ? rand(funnelRadius(m.h, p) * 1.3, rStart) : rStart
    m.rStart = rStart
    m.omega = rand(0.35, 0.8)
    m.inflow = rand(0.5, 1.2)
    m.dissolve = 1
    m.burstK = rand(0.6, 1.5)
  }
  step(m, dt) {
    const p = this.o.p
    m.a += dt * m.omega * p.spinSpeed * (1 + 1.5 / (m.r + 0.4))
    m.r -= dt * m.inflow * (0.3 + 0.7 * m.r / m.rStart)
    m.h = Math.min(0.98, m.h + dt * 0.01)
    if (m.r < funnelRadius(m.h, p) * 1.1) m.dissolve -= dt * 2.5   // dissolving into the strokes
    return m.dissolve > 0
  }
  position(m, out) {
    const p = this.o.p
    const [ax, az] = axisOffset(m.h, this.o.clock, p)
    // Burst: scattered radially (and a little along the spin)
    const b = this.o.burst
    const r = m.r * (1 + 3.5 * b * (m.burstK ?? 1))
    const a = m.a + b * 0.6
    return out.set(ax + Math.cos(a) * r, (m.h - 0.5) * p.height, az + Math.sin(a) * r)
  }
  // Burst: the dots shrink away as they fly out; on the reassembly they ride the inflow.
  // Loader assembly: each dot joins once progress passes its rank, entering at the edge.
  scale(m) {
    const asm = this.o.assembly
    if (asm) {
      m.rank ??= Math.random()
      if (m.rank > asm.particles) return 0
      if (!m.joined) { m.joined = true; this.spawn(m) }
    }
    const b = this.o.burst
    return this.o.burstSign < 0 ? 1 - 0.6 * b : 1 - b * b
  }
  // The cursor LIGHT makes nearby particles bigger and fuller
  near(x, y, z) {
    const c = this.o.cursor
    if (!c) return 0
    const v = this.o._proj.set(x, y, z).project(this.o.camera)
    const sx = (v.x + 1) / 2 * this.o.viewW, sy = (1 - v.y) / 2 * this.o.viewH
    const d = Math.hypot(sx - c.x, sy - c.y)
    return c.presence * Math.exp(-(d * d) / (160 * 160))
  }
  pxPerUnit(m) {
    const cam = this.o.camera
    const dist = Math.max(0.5, cam.position.distanceTo(this.position(m, this.o._proj2)))
    return this.o.viewH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist)
  }
}

export class InkTornado {
  constructor() {
    this.params = {
      scaleVariance: 1,     // 0 = all medium strokes .. 1 = heavy masses + medium + fine threads
      loadVariance: 1,      // 0 = equal ink load .. 1 = wet dense and dry broken strokes mixed
      filamentSplit: 0.5,   // strokes splitting into filaments toward their tails
      splatter: 0.5,        // flecks flicked off stroke heads (per second ×3)
      depthContrast: 0.8,   // near strokes wider, far strokes thinner and halftone
      differential: 1,      // speed changes with height, per stroke and with radius
      rise: 0.02,           // strokes climb the funnel (height / s)
      pitch: 0.09,          // how steep the helices are (height per radian)
      flungRate: 0.35,      // strokes thrown off per second
      collisions: true,
      density: 1,           // stroke count multiplier
    }
    this.strokes = new InkStrokes(900)   // room for burst smears + speed lines
    this.material = this.strokes.material
    const u = this.material.uniforms
    u.uLayer.value = 1
    u.uDepthContrast.value = this.params.depthContrast
    this.particles = new InkParticles({ space: new FunnelSpace(this), specks: 140, clusters: 8, layerUniforms: u })
    this.scene = new THREE.Scene()
    this.scene.add(this.particles.points)
    this.scene.add(this.strokes.mesh)
    this.boil = u.uBoil.value
    this.list = []
    this.flecks = []
    this.clock = 0
    this.lastTime = null
    this.flingIn = 2
    this.burst = 0         // click transition: 0 = tornado .. 1 = fully exploded
    this.burstSign = 1     // +1 exploding, -1 reassembling (direction of smears / speed lines)
    this.assembly = null   // loader: { particles, strokes } 0..1 from the real load progress
    this.viewW = 1
    this.viewH = 1
    this.cursor = null
    this._proj = new THREE.Vector3()
    this._proj2 = new THREE.Vector3()
    this._tmp = new THREE.Vector3()
    this.pool = []
    this.build()
  }

  build() {
    this.pool = []
    for (const [cls, c] of Object.entries(CLASSES)) {
      const n = Math.round(c.n * this.params.density)
      for (let i = 0; i < n; i++) {
        const s = { cls }
        this.respawn(s, true)
        this.pool.push(s)
      }
    }
  }

  // New random drawing for a stroke (variety: no two neighbours alike)
  respawn(s, anywhere = false) {
    const c = CLASSES[s.cls]
    s.shape = pick(c.shapes)
    s.width0 = rand(...c.width)
    s.span = rand(...c.span)
    s.rf = rand(...c.rf)
    s.dry0 = rand(...c.dry)
    s.split0 = rand(...c.split)
    s.rough = rand(...c.rough)
    s.seed = Math.random() * 1000
    s.jitter = rand(-0.18, 0.18)
    s.riseK = rand(0.6, 1.4)
    s.theta = Math.random() * TAU
    s.h = anywhere ? rand(-0.05, 1.0) : rand(-0.08, -0.02)
    s.fling = -1
    // How far this stroke flies in the burst: outward, along the spin, up / down
    s.bR = rand(2.2, 4.2)
    s.bT = rand(0.7, 1.6)
    s.bY = rand(-0.5, 0.5)
  }

  resize(w, h) {
    this.viewW = w
    this.viewH = h
    this.material.uniforms.uViewSize.value.set(w, h)
  }

  // Which layer the next render draws (0 behind works, 1 the rest, 2 RC occluders)
  setLayer(layer, w, h) {
    const u = this.material.uniforms
    u.uLayer.value = layer
    u.uTargetSize.value.set(w, h)
    this.strokes.setViewport(w, h)
  }

  // dt: wall clock (boil, flecks); time: the tornado's clock (stops on hover);
  // works: the thumbnail meshes (collisions); cursor: { x, y, presence } CSS px or null
  update(dt, time, p, works, camera, cursor) {
    this.p = p
    this.camera = camera
    this.cursor = cursor
    const q = this.params
    const dTime = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime)
    this.lastTime = time
    const dClock = dTime * p.motionSpeed
    this.clock = time * p.motionSpeed
    this.strokes.updateBoil(dt)
    this.material.uniforms.uDepthContrast.value = q.depthContrast

    // Camera direction around the axis, for each point's near / far depth
    const camDir = this._tmp.set(camera.position.x, 0, camera.position.z).normalize()

    // Occasionally throw a stroke off the funnel
    this.flingIn -= dt
    const b = this.burst
    if (this.flingIn <= 0 && q.flungRate > 0 && b === 0 && !this.assembly) {
      this.flingIn = (0.4 + 1.2 * Math.random()) / q.flungRate
      const cand = this.pool.filter(s => s.cls !== 'fine' && s.fling < 0 && s.h > 0.2 && s.h < 0.9)
      if (cand.length) pick(cand).fling = 0
    }

    const list = this.list
    list.length = 0
    const workList = q.collisions && b === 0 ? works : []
    for (const s of this.pool) {
      // Differential rotation: faster higher up, per stroke, and on inner radii
      const omega = p.spinSpeed * (1 + q.differential * (0.6 * (s.h - 0.5) + 0.3 * Math.sin(s.h * TAU * 2.5 + s.seed)))
        * (1 + q.differential * 0.6 * Math.max(0, 1 - s.rf)) * (1 + s.jitter)
      s.theta += dClock * omega
      s.h += dTime * q.rise * s.riseK
      if (s.fling >= 0) {
        s.fling += dt / 1.2
        if (s.fling >= 1) { this.respawn(s); continue }
      }
      if (s.h > 1.04) { this.respawn(s); continue }
      const life = THREE.MathUtils.smoothstep(s.h, -0.06, 0.08) * (1 - THREE.MathUtils.smoothstep(s.h, 0.88, 1.03))
      if (life <= 0.01) continue
      const v = q.scaleVariance
      const width = MEDIUM_WIDTH + (s.width0 - MEDIUM_WIDTH) * v
      const dryness = 0.45 + (s.dry0 - 0.45) * q.loadVariance
      const fl = s.fling >= 0 ? s.fling : 0
      // Burst: thinner, drier, split into filaments as it flies; gone at the end
      const stroke = {
        // Exploding: thinning to nothing. Reassembling: already drawn at the edges, thickening
        // as they spiral back in (the eye's ring handing over to the funnel)
        shape: s.shape, width, widthScale: life * (1 - 0.8 * fl) * (this.burstSign < 0 ? 0.35 + 0.65 * (1 - b) : Math.pow(1 - b, 0.8)),
        dryness: Math.min(1, dryness + fl * 0.5 + b * 0.6),
        split: Math.min(1, Math.max(s.split0 * q.filamentSplit * 2, fl, b * 1.1)), rough: s.rough, tone: 1, seed: s.seed,
        points: [], depths: [],
      }
      // Loader assembly: strokes form around the funnel from the bottom up
      if (this.assembly) {
        const g = THREE.MathUtils.clamp((this.assembly.strokes * 1.25 - THREE.MathUtils.clamp(s.h, 0, 1)) / 0.25, 0, 1)
        stroke.widthScale *= g * g * (3 - 2 * g)
      }
      if (stroke.widthScale < 0.01) continue
      this.buildPath(s, stroke, p, camDir, fl, workList)
      list.push(stroke)
      // Thrown strokes fly fast: drawn multiples and speed lines (never motion blur)
      if (fl > 0.05) this.addSmears(stroke, fl)
      else if (b > 0.02 && b < 0.92) this.addBurstSmears(stroke, s, b)
    }
    this.updateFlecks(dt, list, q)
    this.strokes.setStrokes(list)
    // While assembling, the particles spiral in on wall time (the tornado clock waits for 100%)
    this.particles.update(this.assembly ? dt : dTime, this.boil)
  }

  buildPath(s, stroke, p, camDir, fl, works) {
    const pts = stroke.points, deps = stroke.depths
    const fling = 1 + 2.2 * Math.pow(fl, 1.5)
    const rw = this.clock * 0.8
    for (let i = 0; i < POINTS; i++) {
      const f = i / (POINTS - 1)
      const b = this.burst
      // Burst: control points fly along the spin and outward (the tail lags a little)
      const th = s.theta - f * s.span + b * s.bT * (1 + 0.3 * f)
      const hh = s.h - f * s.span * this.params.pitch
      // Control-point noise: a slow radial / vertical wobble (moves points, never pixels)
      const R = funnelRadius(hh, p) * breath(hh, this.clock, p) * s.rf * fling
        * (1 + 0.06 * Math.sin(f * 3 + rw + s.seed)) * (1 + b * s.bR * (1 + 0.4 * f))
      const [ax, az] = axisOffset(hh, this.clock, p)
      const c = Math.cos(th), sn = Math.sin(th)
      const pt = new THREE.Vector3(ax + c * R, (hh - 0.5) * p.height + 0.08 * Math.sin(f * 2.3 + s.seed + rw * 0.7)
        + b * s.bY * p.height * 0.4, az + sn * R)
      if (works.length) this.collide(pt, works, p)
      pts.push(pt)
      // 0 = near side (facing the camera) .. 1 = far side
      deps.push(0.5 - 0.5 * (c * camDir.x + sn * camDir.z))
    }
  }

  // The works push stroke control points out of their way and drag them along
  collide(pt, works, p) {
    const R0 = p.planeWidth * 0.62
    for (const w of works) {
      const dy = pt.y - w.position.y
      if (dy > R0 || dy < -R0) continue
      const dx = pt.x - w.position.x, dz = pt.z - w.position.z
      const d = Math.hypot(dx, dy, dz)
      if (d >= R0 || d < 1e-4) continue
      const push = (R0 - d) / d * 0.85
      pt.x += dx * push; pt.y += dy * push; pt.z += dz * push
      // Drag along the work's motion around the axis (a small wake)
      const k = (R0 - d) / R0 * 0.12
      const tl = Math.hypot(w.position.x, w.position.z) || 1
      pt.x += -w.position.z / tl * k
      pt.z += w.position.x / tl * k
    }
  }

  // Burst: drawn multiples trailing each stroke along its own burst motion (outward on
  // the explosion, inward on the reassembly), plus speed lines behind it
  addBurstSmears(stroke, s, b) {
    const head = stroke.points[0]
    const th = s.theta + b * s.bT
    const dir = new THREE.Vector3(-Math.sin(th) * s.bT + Math.cos(th) * s.bR, 0, Math.cos(th) * s.bT + Math.sin(th) * s.bR)
      .normalize().multiplyScalar(this.burstSign)
    const strength = Math.sin(Math.PI * b)   // strongest mid-flight
    for (let k = 1; k <= 2; k++) {
      const back = dir.clone().multiplyScalar(-0.35 * k * strength)
      this.list.push({ ...stroke, seed: stroke.seed + k * 7.1, widthScale: stroke.widthScale * (k === 1 ? 0.6 : 0.38),
        dryness: Math.min(1, stroke.dryness + 0.3 * k), split: Math.max(stroke.split, 0.6),
        points: stroke.points.map(pt => pt.clone().add(back)), depths: stroke.depths })
    }
    if (stroke.width < 0.06) return   // speed lines only behind the bigger strokes
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    const L = 0.5 + 1.4 * strength
    for (let k = -1; k <= 1; k += 2) {
      const start = head.clone().addScaledVector(side, k * stroke.width * 1.2).addScaledVector(dir, -0.2)
      this.list.push({ shape: SHAPE.speedLine, width: 0.012, widthScale: strength, dryness: 0.3, split: 0, rough: 0.5, tone: 1,
        seed: stroke.seed + 30 + k, points: [start, start.clone().addScaledVector(dir, -L)], depths: [stroke.depths[0], stroke.depths[0]] })
    }
  }

  addSmears(stroke, fl) {
    const n = stroke.points.length
    const head = stroke.points[0], next = stroke.points[1]
    const dir = new THREE.Vector3().subVectors(head, next).normalize()
    for (let k = 1; k <= 2; k++) {
      const back = dir.clone().multiplyScalar(-0.18 * k * (0.5 + fl))
      this.list.push({ ...stroke, seed: stroke.seed + k * 7.1, widthScale: stroke.widthScale * (k === 1 ? 0.6 : 0.38),
        dryness: Math.min(1, stroke.dryness + 0.3 * k), split: Math.max(stroke.split, 0.5),
        points: stroke.points.map(pt => pt.clone().add(back)), depths: stroke.depths })
    }
    // Speed lines behind the tail
    const tail = stroke.points[n - 1]
    const up = new THREE.Vector3(0, 1, 0)
    const side = new THREE.Vector3().crossVectors(dir, up).normalize()
    for (let k = -1; k <= 1; k++) {
      const start = tail.clone().addScaledVector(side, k * 0.08).addScaledVector(dir, -0.1 * (k + 2))
      this.list.push({ shape: SHAPE.speedLine, width: 0.012, widthScale: 1 - fl, dryness: 0.3, split: 0, rough: 0.5, tone: 1,
        seed: stroke.seed + 20 + k, points: [start, start.clone().addScaledVector(dir, -0.6 - fl)], depths: [stroke.depths[n - 1], stroke.depths[n - 1]] })
    }
  }

  // Small flecks flicked off stroke heads, tangentially, for a moment
  updateFlecks(dt, list, q) {
    if (q.splatter > 0 && !this.assembly && Math.random() < dt * q.splatter * 3 && this.flecks.length < MAX_FLECKS && list.length) {
      const src = list[Math.floor(Math.random() * Math.min(list.length, this.pool.length))]
      if (src.points.length > 1 && src.width > 0.03) {
        const dir = new THREE.Vector3().subVectors(src.points[0], src.points[1]).normalize()
        const out = new THREE.Vector3(src.points[0].x, 0, src.points[0].z).normalize()
        this.flecks.push({ pos: src.points[0].clone(), dir, out, age: 0, life: rand(0.4, 0.8), seed: Math.random() * 100, depth: src.depths[0] })
      }
    }
    for (let i = this.flecks.length - 1; i >= 0; i--) {
      const f = this.flecks[i]
      f.age += dt / f.life
      if (f.age >= 1) { this.flecks.splice(i, 1); continue }
      const head = f.pos.clone().addScaledVector(f.dir, 1.4 * f.age).addScaledVector(f.out, 0.6 * f.age)
      list.push({ shape: SHAPE.teardrop, width: 0.014, widthScale: 1 - f.age, dryness: 0.2, split: 0, rough: 0.6, tone: 1, seed: f.seed,
        points: [head.clone().addScaledVector(f.dir, -0.1), head], depths: [f.depth, f.depth] })
    }
  }

  dispose() {
    this.strokes.dispose()
    this.particles.dispose()
  }
}
