// Ink strokes as DISCRETE DRAWN OBJECTS (Spider-Verse FX language, see CLAUDE.md
// "Ink rendering rules"). Each stroke is a ribbon mesh along its own path (a polyline
// of control points the caller moves), facing the camera, with a designed width
// profile. Everything that makes it look inked lives in the stroke's own UV space
// (s along, t across), so it travels with the stroke and never smears:
// - silhouette: crescent / comma / teardrop / speed line / hook profile × brush pressure;
// - hard edge (alpha threshold, ~1px AA) whose only breakup is dry brush: edge
//   serration, bristle streaks, filament splits at the tail;
// - mid-tones as halftone dots, never gradients.
// The drawing "boils": the edge / pressure / bristle noise gets a new seed at a fixed
// rate (hand-drawn animation on twos) while the paths themselves move smoothly.
// Nothing here samples or displaces the rendered image.
//
// In the tornado (uLayer >= 0) each control point also carries a depth (0 = near side
// of the funnel, 1 = far side): near strokes are wider, far ones thinner and drawn in
// halftone. Fragments are sorted against the works' depth (layer 0 = behind a work,
// 1 = the rest, 2 = near stroke bodies as RC occluders), the hover hole cuts the near
// side with a ragged edge, and lit zones draw fatter strokes.
import * as THREE from 'three'
import { inkNoiseGlsl } from '../tornado/inkNoise.js'

const SEG = 40                      // segments along each stroke
export const SHAPE = { crescent: 0, comma: 1, teardrop: 2, speedLine: 3, hook: 4 }

const vertexShader = /* glsl */`
  attribute vec3 aCenter;
  attribute vec3 aTangent;
  attribute float aSide;            // -1 / +1
  attribute float aS;               // 0..1 along the stroke
  attribute vec4 aA;                // seed, half width (world), shape, dryness
  attribute vec4 aB;                // length (world), tone, split, roughness
  attribute float aDepth;           // 0 near side .. 1 far side (tornado)
  attribute float aWK;              // per-point width multiplier (0 = no stroke here: the eye's calm zone)
  uniform vec2 uViewport;           // px of the target being drawn
  uniform float uDepthContrast;     // 0 = no depth treatment (test page)
  uniform float uVeil;              // gusts: thin the near side when clear (1 = heavy)
  varying float vDepth;
  varying vec2 vUv;                 // s, t (t in units of the max half width; |t| > 1 = AA margin)
  varying float vHalfPx, vLenPx;
  varying vec4 vA, vB;
  void main() {
    vec4 c = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
    vec4 e = projectionMatrix * modelViewMatrix * vec4(aCenter + aTangent * 0.01, 1.0);
    vec2 dir = (e.xy / e.w - c.xy / c.w) * uViewport;
    dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    // World sizes → pixels at this depth (works for perspective and orthographic cameras)
    float pxPerUnit = projectionMatrix[1][1] * uViewport.y * 0.5 / c.w;
    // Near strokes wider, far strokes thinner; a clear gust thins the near side
    float wScale = mix(1.15, 0.55, aDepth * uDepthContrast) * mix(mix(0.55, 1.0, uVeil), 1.0, aDepth);
    float halfPx = aWK < 0.02 ? 1e-4 : max(aA.y * pxPerUnit * wScale * aWK, 0.6);   // threads stay ≥ ~1px
    float margin = aWK < 0.02 ? 0.0 : 1.5;       // px for the antialiased edge
    c.xy += nrm * aSide * (halfPx + margin) / uViewport * 2.0 * c.w;
    gl_Position = c;
    vUv = vec2(aS, aSide * (halfPx + margin) / halfPx);
    vHalfPx = halfPx;
    vLenPx = aB.x * pxPerUnit;
    vA = aA;
    vB = aB;
    // Far side: halftone (the dots shrink with depth; never a gray fill)
    vB.y = aB.y * mix(1.0, 0.42, smoothstep(0.35, 0.75, aDepth) * uDepthContrast);
    vDepth = aDepth;
  }
`

const fragmentShader = /* glsl */`
  varying vec2 vUv;
  varying float vHalfPx, vLenPx;
  varying vec4 vA, vB;
  varying float vDepth;
  uniform vec2 uBoil;               // new value at each redraw of the drawing (boil)
  uniform float uRough, uDryBrush, uHalftoneCell;
  uniform float uWhite;             // flat level of the ink (1 = white; lower = a flat dimmer white)
  // Tornado only (uLayer < 0 on the test page: all of this is skipped)
  uniform int uLayer;
  uniform sampler2D uDepth;         // the works' depth
  uniform bool uUseDepth;
  uniform vec2 uTargetSize, uViewSize;
  uniform vec3 uHole;               // hover hole: center (CSS px, y up), radius
  uniform float uHoleAmount;
  uniform sampler2D uLight;         // last frame's fluence (RC cascade 0)
  uniform bool uHasLight;
  uniform float uAmbientFluence, uLightThicken;
  uniform float uOccOffset;         // px: only stroke bodies thicker than this block light
  ${inkNoiseGlsl}
  const float PI = 3.14159265;

  // Designed silhouettes: half width along the stroke (0..1 of the max).
  // cap: length of a round brush cap as a fraction of the stroke (round in pixels)
  float profile(float s, float shape, float cap) {
    if (shape < 0.5) return pow(sin(PI * s), 0.75);                              // crescent
    if (shape < 1.5) {                                                           // comma: round heavy head, long tail
      float head = s < cap ? sqrt(max(0.0, 1.0 - pow((cap - s) / cap, 2.0))) : 1.0;
      return head * pow(1.0 - s, 1.25) * 1.3;
    }
    if (shape < 2.5) {                                                           // teardrop: thin start, round fat end
      float body = pow(s / 0.8, 1.6);
      float cap = sqrt(max(0.0, 1.0 - pow((s - 0.8) / 0.2, 2.0)));
      return s < 0.8 ? body : cap;
    }
    if (shape < 3.5) return 0.35 * smoothstep(0.0, 0.3, s) * smoothstep(1.0, 0.7, s); // speed line
    float head = s < cap ? sqrt(max(0.0, 1.0 - pow((cap - s) / cap, 2.0))) : 1.0;
    return head * pow(1.0 - s, 0.85);                                            // hook (its path curls)
  }

  void main() {
    float s = vUv.x, t = vUv.y;
    float seed = vA.x, shape = vA.z, dryness = vA.w;
    float tone = vB.y, split = vB.z, rough = vB.w;

    if (uLayer >= 0) {
      // Sort against the works by real depth: 0 = behind a work, 1 = everything else
      if (uLayer != 2 && uUseDepth) {
        bool behindWork = texture2D(uDepth, gl_FragCoord.xy / uTargetSize).r < gl_FragCoord.z;
        if ((uLayer == 0) != behindWork) discard;
      }
      // Hover hole: a hard, ragged cut through the near side around the hovered work
      if (vDepth < 0.5 && uHoleAmount > 0.001) {
        vec2 px = gl_FragCoord.xy / uTargetSize * uViewSize;
        float jag = (vnoise(px * 0.07 + uBoil) - 0.5) * uHole.z * 0.4;
        if (distance(px, uHole.xy) + jag < uHole.z * uHoleAmount) discard;
      }
    }

    // Brush pressure: a slow thick-thin wobble along the stroke, redrawn with the boil
    float pressure = 0.82 + 0.36 * vnoise(vec2(s * 3.0 + seed, seed * 1.7) + uBoil * 0.25);
    float cap = clamp(vHalfPx / max(vLenPx, 1.0), 0.02, 0.35);
    float w = profile(s, shape, cap) * pressure;
    // Lit zones (inner lights, cursor) draw fatter strokes: drawn light, not shading
    if (uLayer >= 0 && uHasLight) {
      vec3 f = texture2D(uLight, gl_FragCoord.xy / uTargetSize).rgb * 6.2831853;
      float lit = clamp((dot(f, vec3(0.2126, 0.7152, 0.0722)) - uAmbientFluence) * 0.5, 0.0, 1.0);
      w *= 1.0 + uLightThicken * lit;
    }

    // Hard edge with dry-brush serration (each side its own noise), redrawn with the boil
    float side = t > 0.0 ? 1.0 : -1.0;
    float n = 0.7 * vnoise(vec2(s * vLenPx * 0.07, side * 7.0 + seed) + uBoil)
            + 0.3 * vnoise(vec2(s * vLenPx * 0.25, side * 3.0 + seed) - uBoil);
    float wEdge = w * (1.0 + rough * uRough * (n - 0.5) * 2.0);
    float d = (wEdge - abs(t)) * vHalfPx;          // px inside the edge
    float cov = smoothstep(-0.6, 0.6, d);

    // Filament split: toward the tail the stroke divides into a few threads
    float splitAmt = split * smoothstep(0.45, 0.9, s);
    if (splitAmt > 0.0 && w > 0.0) {
      float lanes = fract(t / max(w, 0.05) * 1.4 + 0.5 + 0.25 * vnoise(vec2(s * 5.0, seed)));
      float gapPx = abs(lanes - 0.5) * 2.0 * vHalfPx * w / 1.4;   // px to the lane boundary
      cov *= 1.0 - splitAmt * (1.0 - smoothstep(0.0, 1.2 + 2.0 * splitAmt, gapPx));
    }

    // Dry brush: bristle streaks along the stroke, more where the pressure is low
    // (thin ends) and in dry strokes
    float streak = vnoise(vec2(s * vLenPx * 0.012, t * vHalfPx * 0.45) + vec2(seed * 3.1, 0.0) + uBoil * 0.35);
    float dryAmt = uDryBrush * dryness * (0.35 + 0.65 * (1.0 - clamp(w, 0.0, 1.0)));
    float th = 1.0 - dryAmt * 0.75;
    float sw = fwidth(streak) + 1e-4;
    cov *= 1.0 - smoothstep(th - sw, th + sw, streak);

    // Mid-tone: halftone dots in stroke space (they travel with the stroke)
    if (tone < 0.999) {
      vec2 p = vec2(s * vLenPx, t * vHalfPx) / uHalftoneCell;
      float r = sqrt(max(tone, 0.0)) * 0.62;
      float dd = length(fract(p) - 0.5);
      float aa = fwidth(dd) + 1e-4;
      cov *= 1.0 - smoothstep(r - aa, r + aa, dd);
    }

    if (uLayer == 2) {
      // RC occluders: only the solid bodies of near-side strokes block light
      if (cov < 0.5 || vDepth > 0.5 || w * vHalfPx < uOccOffset) discard;
      gl_FragColor = vec4(1.0);
      return;
    }
    if (cov < 0.01) discard;
    gl_FragColor = vec4(vec3(uWhite), cov);
  }
`

export class InkStrokes {
  constructor(maxStrokes = 256) {
    this.max = maxStrokes
    this.params = { boil: true, boilRate: 12, roughness: 0.35, dryBrush: 1, halftoneCell: 4 }
    this.boilClock = 0
    this.boilStep = -1
    const vPer = (SEG + 1) * 2
    const n = maxStrokes * vPer
    const g = this.geometry = new THREE.BufferGeometry()
    const attr = (name, size) => {
      const a = new THREE.BufferAttribute(new Float32Array(n * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      return a
    }
    this.aCenter = attr('aCenter', 3)
    this.aTangent = attr('aTangent', 3)
    this.aSide = attr('aSide', 1)
    this.aS = attr('aS', 1)
    this.aA = attr('aA', 4)
    this.aB = attr('aB', 4)
    this.aDepth = attr('aDepth', 1)
    this.aWK = attr('aWK', 1)
    // Static parts: side, s, triangle indices
    const index = new Uint32Array(maxStrokes * SEG * 6)
    for (let k = 0; k < maxStrokes; k++) {
      for (let i = 0; i <= SEG; i++) {
        const v = k * vPer + i * 2
        this.aSide.array[v] = -1; this.aSide.array[v + 1] = 1
        this.aS.array[v] = this.aS.array[v + 1] = i / SEG
        if (i < SEG) {
          const o = (k * SEG + i) * 6
          index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], o)
        }
      }
    }
    g.setIndex(new THREE.BufferAttribute(index, 1))
    // Positions are unused (the vertex shader builds the ribbon) but three wants one
    g.setAttribute('position', this.aCenter)
    g.setDrawRange(0, 0)

    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      uniforms: {
        uViewport: { value: new THREE.Vector2(1, 1) },
        uBoil: { value: new THREE.Vector2() },
        uRough: { value: this.params.roughness },
        uDryBrush: { value: this.params.dryBrush },
        uHalftoneCell: { value: this.params.halftoneCell },
        uDepthContrast: { value: 0 }, uVeil: { value: 1 }, uWhite: { value: 1 },
        uLayer: { value: -1 }, uDepth: { value: null }, uUseDepth: { value: false },
        uTargetSize: { value: new THREE.Vector2(1, 1) }, uViewSize: { value: new THREE.Vector2(1, 1) },
        uHole: { value: new THREE.Vector3() }, uHoleAmount: { value: 0 },
        uLight: { value: null }, uHasLight: { value: false },
        uAmbientFluence: { value: 0 }, uLightThicken: { value: 0 }, uOccOffset: { value: 0 },
        uOccThreshold: { value: 0 },   // (kept for TornadoLighting's interface)
      },
    })
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this._pts = []
    this._len = []
  }

  setViewport(w, h) { this.material.uniforms.uViewport.value.set(w, h) }

  // The drawing boils: a new noise seed at boilRate (only when boil is on). Motion is
  // untouched: callers move the paths every frame.
  updateBoil(dt) {
    const q = this.params
    const u = this.material.uniforms
    u.uRough.value = q.roughness
    u.uDryBrush.value = q.dryBrush
    u.uHalftoneCell.value = q.halftoneCell
    if (!q.boil) return
    this.boilClock += dt
    const step = Math.floor(this.boilClock * Math.max(1, q.boilRate))
    if (step === this.boilStep) return
    this.boilStep = step
    const h = (n) => { const x = Math.sin(n * 127.1 + step * 311.7) * 43758.5453; return x - Math.floor(x) }
    u.uBoil.value.set(h(1) * 97, h(2) * 97)
  }

  // strokes: [{ points: Vector3[] (start → end, ≥ 2), width (world half width), shape,
  //             dryness 0..1, seed, tone 0..1 (1 = solid, < 1 = halftone), split 0..1,
  //             rough (edge serration multiplier), depths?: number[] per point (0 near .. 1 far),
  //             widthScale?: life envelope, widthK?: number[] per point (0 = hidden there) }]
  setStrokes(strokes) {
    const count = Math.min(strokes.length, this.max)
    const vPer = (SEG + 1) * 2
    const C = this.aCenter.array, T = this.aTangent.array, A = this.aA.array, B = this.aB.array
    const D = this.aDepth.array, K = this.aWK.array
    for (let k = 0; k < count; k++) {
      const st = strokes[k]
      const pts = st.points
      // Cumulative length, then resample evenly by arc length
      const len = this._len
      len.length = pts.length
      len[0] = 0
      for (let i = 1; i < pts.length; i++) len[i] = len[i - 1] + pts[i].distanceTo(pts[i - 1])
      const total = Math.max(len[pts.length - 1], 1e-5)
      let j = 1
      for (let i = 0; i <= SEG; i++) {
        const target = (i / SEG) * total
        while (j < pts.length - 1 && len[j] < target) j++
        const a = pts[j - 1], b = pts[j]
        const f = (target - len[j - 1]) / Math.max(len[j] - len[j - 1], 1e-6)
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, z = a.z + (b.z - a.z) * f
        const dep = st.depths ? st.depths[j - 1] + (st.depths[j] - st.depths[j - 1]) * f : 0
        const wk = st.widthK ? st.widthK[j - 1] + (st.widthK[j] - st.widthK[j - 1]) * f : 1
        const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z
        const tl = Math.hypot(tx, ty, tz) || 1
        for (let side = 0; side < 2; side++) {
          const v = k * vPer + i * 2 + side
          C[v * 3] = x; C[v * 3 + 1] = y; C[v * 3 + 2] = z
          T[v * 3] = tx / tl; T[v * 3 + 1] = ty / tl; T[v * 3 + 2] = tz / tl
          A[v * 4] = st.seed; A[v * 4 + 1] = st.width * (st.widthScale ?? 1); A[v * 4 + 2] = st.shape; A[v * 4 + 3] = st.dryness ?? 0.4
          D[v] = dep
          K[v] = wk
          B[v * 4] = total; B[v * 4 + 1] = st.tone ?? 1; B[v * 4 + 2] = st.split ?? 0; B[v * 4 + 3] = st.rough ?? 1
        }
      }
    }
    for (const a of [this.aCenter, this.aTangent, this.aA, this.aB, this.aDepth, this.aWK]) a.needsUpdate = true
    this.geometry.setDrawRange(0, count * SEG * 6)
  }

  dispose() { this.geometry.dispose(); this.material.dispose() }
}
