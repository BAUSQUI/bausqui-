// Ink particles: crisp grain specks (1–2px, hard edges) and "Kirby dot" clusters
// (small groups of round dots, comic-book energy). They spiral in toward a center and
// dissolve (shrink away) into the strokes, then respawn at the screen edges.
// Positions move smoothly every frame; only the dot outlines boil (redrawn at the
// strokes' boil rate). Near the cursor they get bigger and fuller (brighter), never
// a glow: every dot is flat white with a hard edge.
//
// Motion lives in a "space": the default is a flat spiral around a 2D center (the
// `?debug=ink` page); the tornado passes its own 3D space (spiral around the funnel
// axis). With `layerUniforms` the dots are sorted against the works' depth like the
// strokes (some pass in front of a work, some behind).
import * as THREE from 'three'
import { inkNoiseGlsl } from '../tornado/inkNoise.js'

const vertexShader = /* glsl */`
  attribute float aSize;     // px
  attribute float aSeed;
  attribute float aRound;    // 0 = speck (square-ish grain), 1 = round dot
  varying float vSeed, vRound;
  void main() {
    vSeed = aSeed;
    vRound = aRound;
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */`
  varying float vSeed, vRound;
  uniform vec2 uBoil;
  uniform float uWhite;          // flat level of the dots (1 = white)
  uniform int uLayer;            // < 0: no sorting (test page)
  uniform sampler2D uDepth;
  uniform bool uUseDepth;
  uniform vec2 uTargetSize;
  ${inkNoiseGlsl}
  void main() {
    if (uLayer == 2) discard;    // too small to block light
    if (uLayer >= 0 && uUseDepth) {
      bool behindWork = texture2D(uDepth, gl_FragCoord.xy / uTargetSize).r < gl_FragCoord.z;
      if ((uLayer == 0) != behindWork) discard;
    }
    vec2 c = gl_PointCoord - 0.5;
    if (vRound < 0.5) {
      // Grain speck: a hard little chip, its corners redrawn with the boil
      float k = 0.5 - 0.18 * vnoise(vec2(vSeed, 3.0) + uBoil);
      if (max(abs(c.x), abs(c.y)) > k) discard;
      gl_FragColor = vec4(vec3(uWhite), 1.0);
      return;
    }
    // Round dot with a slightly irregular, hand-inked outline that boils
    float r = length(c) * 2.0;
    float a = atan(c.y, c.x);
    float wob = 1.0 + 0.16 * (vnoise(vec2(a * 1.6 + vSeed, vSeed * 2.3) + uBoil) - 0.5) * 2.0;
    float aa = fwidth(r) + 1e-4;
    float cov = 1.0 - smoothstep(wob * 0.92 - aa, wob * 0.92 + aa, r);
    if (cov < 0.01) discard;
    gl_FragColor = vec4(vec3(uWhite), cov);
  }
`

// Default space: a flat spiral around a 2D center, world = CSS px (the test page).
// A space provides: spawn(m, anywhere), step(m, dt, speed) → false when dissolved,
// position(m, outVec3), near(x, y, z) → 0..1 closeness to the cursor, pxPerUnit(m).
export class FlatSpiralSpace {
  constructor() { this.halfW = 1; this.halfH = 1; this.center = { x: 0, y: 0 }; this.cursor = null; this.pxScale = 1; this.cursorRadius = 140 }
  spawn(m, anywhere = false) {
    const edge = Math.hypot(this.halfW, this.halfH) * (anywhere ? 0.25 + 0.8 * Math.random() : 1.02)
    m.r = edge
    m.a = Math.random() * Math.PI * 2
    m.omega = 0.35 + 0.5 * Math.random()
    m.inflow = 0.6 + 0.8 * Math.random()
    m.dissolve = 1
  }
  step(m, dt, speed) {
    const sc = Math.hypot(this.halfW, this.halfH)
    const rMin = Math.min(this.halfW, this.halfH) * 0.12
    m.a += dt * speed * m.omega * (1 + 1.4 * sc * 0.25 / Math.max(m.r, rMin))
    m.r -= dt * speed * 0.35 * m.inflow * sc * 0.18 * (0.4 + 0.6 * m.r / sc)
    if (m.r < rMin * 2) m.dissolve -= dt * 2.5   // shrinking into the strokes
    return m.dissolve > 0 && m.r >= rMin
  }
  position(m, out) { return out.set(this.center.x + Math.cos(m.a) * m.r, this.center.y + Math.sin(m.a) * m.r, 0) }
  near(x, y) {
    if (!this.cursor) return 0
    const d = Math.hypot(x - this.cursor.x, y - this.cursor.y) * this.pxScale
    return Math.exp(-(d * d) / (this.cursorRadius * this.cursorRadius))
  }
  pxPerUnit() { return this.pxScale }
}

export class InkParticles {
  constructor({ specks = 160, clusters = 10, dotsPerCluster = 7, space = new FlatSpiralSpace(), layerUniforms = null } = {}) {
    this.params = { speed: 1, specks, clusters }
    this.space = space
    this.dotsPerCluster = dotsPerCluster
    this.maxSpecks = 400
    this.maxClusters = 30
    const n = this.maxSpecks + this.maxClusters * dotsPerCluster
    const g = this.geometry = new THREE.BufferGeometry()
    this.pos = new Float32Array(n * 3)
    this.size = new Float32Array(n)
    this.seed = new Float32Array(n)
    this.round = new Float32Array(n)
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1))
    g.setAttribute('aRound', new THREE.BufferAttribute(this.round, 1))
    const lu = layerUniforms
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false,
      uniforms: {
        uBoil: { value: new THREE.Vector2() },
        uWhite: { value: 1 },
        uLayer: lu ? lu.uLayer : { value: -1 },
        uDepth: lu ? lu.uDepth : { value: null },
        uUseDepth: lu ? lu.uUseDepth : { value: false },
        uTargetSize: lu ? lu.uTargetSize : { value: new THREE.Vector2(1, 1) },
      },
    })
    this.points = new THREE.Points(g, this.material)
    this.points.frustumCulled = false
    this.specks = Array.from({ length: this.maxSpecks }, () => ({}))
    this.clusters = Array.from({ length: this.maxClusters }, () => ({
      dots: Array.from({ length: dotsPerCluster }, () => ({})),
    }))
    this.seeded = false
    this._v = new THREE.Vector3()
  }

  // sizeScale: drawing px per CSS px of the target (e.g. DPR)
  update(dt, boil, sizeScale = 1) {
    const q = this.params
    const sp = this.space
    if (!this.seeded) {
      this.specks.forEach(m => { sp.spawn(m, true); m.seed = Math.random() * 100; m.base = 1 + Math.random() })
      this.clusters.forEach(c => {
        sp.spawn(c, true)
        c.dots.forEach((d, i) => {
          // Kirby cluster: one bigger dot, smaller ones around it
          const ring = i === 0 ? 0 : 0.5 + Math.random()
          const ang = Math.random() * Math.PI * 2
          d.ox = Math.cos(ang) * ring
          d.oy = Math.sin(ang) * ring
          d.base = i === 0 ? 8 + Math.random() * 4 : 3 + Math.random() * 4 / ring
          d.seed = Math.random() * 100
        })
        c.spread = 6 + Math.random() * 6   // px
      })
      this.seeded = true
    }
    this.material.uniforms.uBoil.value.copy(boil)
    const v = this._v
    let k = 0
    const nS = Math.min(Math.round(q.specks), this.maxSpecks)
    for (let i = 0; i < nS; i++) {
      const m = this.specks[i]
      if (!sp.step(m, dt, q.speed)) sp.spawn(m)
      sp.position(m, v)
      this.pos[k * 3] = v.x; this.pos[k * 3 + 1] = v.y; this.pos[k * 3 + 2] = v.z
      this.size[k] = Math.max(0, (m.base + 1.5 * sp.near(v.x, v.y, v.z)) * m.dissolve * sizeScale * (sp.scale ? sp.scale(m) : 1))
      this.seed[k] = m.seed
      this.round[k] = 0
      k++
    }
    const nC = Math.min(Math.round(q.clusters), this.maxClusters)
    for (let i = 0; i < nC; i++) {
      const c = this.clusters[i]
      if (!sp.step(c, dt, q.speed)) sp.spawn(c)
      sp.position(c, v)
      const boost = 1 + 0.8 * sp.near(v.x, v.y, v.z)
      const unit = 1 / sp.pxPerUnit(c)   // world units per CSS px at the cluster
      for (const d of c.dots) {
        this.pos[k * 3] = v.x + d.ox * c.spread * unit
        this.pos[k * 3 + 1] = v.y + d.oy * c.spread * unit
        this.pos[k * 3 + 2] = v.z
        this.size[k] = Math.max(0, d.base * boost * c.dissolve * sizeScale * (sp.scale ? sp.scale(c) : 1))
        this.seed[k] = d.seed
        this.round[k] = 1
        k++
      }
    }
    for (const name of ['position', 'aSize', 'aSeed', 'aRound']) this.geometry.attributes[name].needsUpdate = true
    this.geometry.setDrawRange(0, k)
  }

  dispose() { this.geometry.dispose(); this.material.dispose() }
}
