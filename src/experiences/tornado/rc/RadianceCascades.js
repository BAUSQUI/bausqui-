// 2D radiance cascades as a screen-space post-process (port of Shadertoy mtlBzX, fad).
//
// Per frame the caller renders three inputs into the targets this class owns:
//   albedoTarget   (full res)  linear albedo of receivers
//   occluderTarget (SDF res)   r > 0.5 where light is blocked
//   emissiveTarget (SDF res)   linear emitted radiance
// then calls render(), which runs: JFA seed → jump flood → SDF resolve →
// cascades top-down (same frame, no lag) → composite to the screen.
import * as THREE from 'three'
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw'
import commonGlsl from './shaders/common.glsl?raw'
import seedFrag from './shaders/seed.frag.glsl?raw'
import jfaFrag from './shaders/jfa.frag.glsl?raw'
import sdfFrag from './shaders/sdf.frag.glsl?raw'
import cascadeFrag from './shaders/cascade.frag.glsl?raw'
import compositeFrag from './shaders/composite.frag.glsl?raw'

export const VIEWS = { final: 0, albedo: 1, occluders: 2, emissive: 3, SDF: 4, 'cascade n': 5, fluence: 6 }

export class RadianceCascades {
  static isSupported(renderer) {
    return renderer.capabilities.isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))
  }

  constructor(renderer, { sdfScale = 0.5, c0Scale = 0.5, nCascades = 5, cDRes = 16 } = {}) {
    this.renderer = renderer
    this.sdfScale = sdfScale
    this.c0Scale = c0Scale
    this.nCascades = nCascades
    this.cDRes = cDRes
    // Jump flood stores texel coordinates: Float keeps them exact, HalfFloat is the fallback
    this.seedType = renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType

    this.params = { view: 0, debugCascade: 0, ambient: 0, emissiveScale: 1, exposure: 1, saturation: 0 }

    // Fullscreen triangle shared by every pass
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    this.quad = new THREE.Mesh(geo)
    this.quad.frustumCulled = false
    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quad)
    this.quadCamera = new THREE.Camera()

    const mat = (frag, uniforms, withCommon = false) => new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: 'out highp vec4 rcColor;\n#define gl_FragColor rcColor\n' + (withCommon ? commonGlsl + '\n' : '') + frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })
    this.seedMat = mat(seedFrag, { uOccluder: { value: null }, uEmissive: { value: null } }, true)
    this.jfaMat = mat(jfaFrag, { uSeeds: { value: null }, uStep: { value: 1 } })
    this.sdfMat = mat(sdfFrag, {
      uOccluder: { value: null }, uEmissive: { value: null }, uSeeds: { value: null }, uEmissiveScale: { value: 1 },
    }, true)
    this.cascadeMat = mat(cascadeFrag, {
      uSDF: { value: null }, uUpper: { value: null }, uUpperSize: { value: new THREE.Vector2(1, 1) },
      uSdfRes: { value: new THREE.Vector2() }, uC0: { value: new THREE.Vector2() },
      uN: { value: 0 }, uNCascades: { value: nCascades }, uCDRes: { value: cDRes },
      uAmbient: { value: new THREE.Vector3() },
    })
    this.compositeMat = mat(compositeFrag, {
      uAlbedo: { value: null }, uOccluder: { value: null }, uEmissive: { value: null }, uSDF: { value: null },
      uCascade0: { value: null }, uDebugTex: { value: null },
      // Tornado layers (see composite.frag.glsl); defaults leave the plain RC composite
      uSwirlBack: { value: null }, uSwirlFront: { value: null }, uHasSwirl: { value: false },
      uSwirlBrightness: { value: 0 }, uFrontAlpha: { value: 0 },
      uFlareThreshold: { value: 1 }, uFlareRays: { value: 0 }, uBoil: { value: new THREE.Vector2() },
      uImpact: { value: 0 }, uImpactLevel: { value: 0.8 },
      uThumbBrightness: { value: 1 }, uAmbientFluence: { value: 0 },
      uHighlight: { value: null }, uHighlightAmount: { value: 0 },
      uEmissiveScale: { value: 1 }, uExposure: { value: 1 }, uSaturation: { value: 0 }, uView: { value: 0 },
    })

    this.targets = []
    this.cascades = []
  }

  rt(w, h, { type = THREE.HalfFloatType, filter = THREE.LinearFilter, depthBuffer = false, depthTexture = false } = {}) {
    const t = new THREE.WebGLRenderTarget(w, h, {
      type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer,
      depthTexture: depthTexture ? new THREE.DepthTexture(w, h) : null,
    })
    this.targets.push(t)
    return t
  }

  // cssW/cssH in CSS pixels; bufferW/bufferH = drawing buffer (albedo is full res)
  setSize(cssW, cssH, bufferW, bufferH) {
    this.targets.forEach(t => { t.depthTexture?.dispose(); t.dispose() })
    this.targets = []
    const sdfW = Math.max(16, Math.round(cssW * this.sdfScale))
    const sdfH = Math.max(16, Math.round(cssH * this.sdfScale))
    this.sdfRes = new THREE.Vector2(sdfW, sdfH)

    // Cascade 0 spatial resolution, snapped so every c0 >> n halves exactly
    const snap = 1 << (this.nCascades - 1)
    const c0x = Math.max(snap, Math.round(sdfW * this.c0Scale / snap) * snap)
    const c0y = Math.max(snap, Math.round(sdfH * this.c0Scale / snap) * snap)
    this.c0 = new THREE.Vector2(c0x, c0y)

    // The 3D receivers overlap: preserve their depth ordering before screen-space lighting.
    // The depth is a texture so other layers (the tornado's swirl) can sort against it.
    this.albedoTarget = this.rt(bufferW, bufferH, { depthBuffer: true, depthTexture: true })
    this.occluderTarget = this.rt(sdfW, sdfH, { type: THREE.UnsignedByteType, filter: THREE.NearestFilter })
    this.emissiveTarget = this.rt(sdfW, sdfH, { filter: THREE.NearestFilter })
    this.seedA = this.rt(sdfW, sdfH, { type: this.seedType, filter: THREE.NearestFilter })
    this.seedB = this.rt(sdfW, sdfH, { type: this.seedType, filter: THREE.NearestFilter })
    this.sdfTarget = this.rt(sdfW, sdfH)   // LINEAR: smooth distances for sphere tracing
    // One target per cascade: cascade 0 is c0, every cascade n >= 1 is exactly 2 * c0
    this.cascades = []
    for (let n = 0; n < this.nCascades; n++) {
      this.cascades.push(n === 0 ? this.rt(c0x, c0y) : this.rt(2 * c0x, 2 * c0y))
    }
  }

  pass(material, target) {
    this.quad.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  render() {
    const r = this.renderer
    const prevAutoClear = r.autoClear
    r.autoClear = false
    const p = this.params

    // 1. Seeds from the occluder + emissive masks
    this.seedMat.uniforms.uOccluder.value = this.occluderTarget.texture
    this.seedMat.uniforms.uEmissive.value = this.emissiveTarget.texture
    this.pass(this.seedMat, this.seedA)

    // 2. Jump flood: steps max/2 … 1, plus one extra 1-step pass (JFA+1)
    let src = this.seedA, dst = this.seedB
    const maxDim = Math.max(this.sdfRes.x, this.sdfRes.y)
    const steps = []
    for (let k = 1 << (Math.ceil(Math.log2(maxDim)) - 1); k >= 1; k >>= 1) steps.push(k)
    steps.push(1)
    for (const k of steps) {
      this.jfaMat.uniforms.uSeeds.value = src.texture
      this.jfaMat.uniforms.uStep.value = k
      this.pass(this.jfaMat, dst)
      ;[src, dst] = [dst, src]
    }

    // 3. Signed distance + nearest-surface emissivity
    this.sdfMat.uniforms.uOccluder.value = this.occluderTarget.texture
    this.sdfMat.uniforms.uEmissive.value = this.emissiveTarget.texture
    this.sdfMat.uniforms.uSeeds.value = src.texture
    this.sdfMat.uniforms.uEmissiveScale.value = p.emissiveScale
    this.pass(this.sdfMat, this.sdfTarget)

    // 4. Cascades, top down, all in this frame
    const cu = this.cascadeMat.uniforms
    cu.uSDF.value = this.sdfTarget.texture
    cu.uSdfRes.value.copy(this.sdfRes)
    cu.uC0.value.copy(this.c0)
    cu.uAmbient.value.setScalar(p.ambient)
    for (let n = this.nCascades - 1; n >= 0; n--) {
      const upper = this.cascades[n + 1] || this.sdfTarget   // never bind the active draw attachment as a sampler
      cu.uN.value = n
      cu.uUpper.value = upper.texture
      cu.uUpperSize.value.set(upper.width, upper.height)
      this.pass(this.cascadeMat, this.cascades[n])
    }

    // 5. Composite to the screen
    const k = this.compositeMat.uniforms
    k.uAlbedo.value = this.albedoTarget.texture
    k.uOccluder.value = this.occluderTarget.texture
    k.uEmissive.value = this.emissiveTarget.texture
    k.uSDF.value = this.sdfTarget.texture
    k.uCascade0.value = this.cascades[0].texture
    k.uDebugTex.value = this.cascades[Math.min(p.debugCascade, this.nCascades - 1)].texture
    k.uEmissiveScale.value = p.emissiveScale
    k.uExposure.value = p.exposure
    k.uAmbientFluence.value = p.ambient * 2 * Math.PI   // fluence of the ambient alone, in open space
    k.uSaturation.value = p.saturation
    k.uView.value = p.view
    this.pass(this.compositeMat, null)

    r.autoClear = prevAutoClear
  }

  dispose() {
    this.targets.forEach(t => { t.depthTexture?.dispose(); t.dispose() })
    ;[this.seedMat, this.jfaMat, this.sdfMat, this.cascadeMat, this.compositeMat].forEach(m => m.dispose())
    this.quad.geometry.dispose()
  }
}

