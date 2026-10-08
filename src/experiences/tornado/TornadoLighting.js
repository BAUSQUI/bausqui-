import * as THREE from 'three'
import { RadianceCascades } from './rc/RadianceCascades.js'
import { LazyLight } from './rc/LazyLight.js'
import { MAX_INNER_LIGHTS } from './innerLights.js'

const SWIRL_BACK = 0, SWIRL_FRONT = 1, SWIRL_OCCLUDER = 2   // InkTornado layers: behind works, the rest, RC occluders
const MAX_FRONT_OPACITY = 0.9                                 // the veil is never opaque
export const CURSOR_LIGHT_MIN = 1                             // cursor light: default = slider minimum

// Smooth gust noise in 0..1 (a few incommensurate slow sines)
function gustNoise(t) {
  const s = 0.5 * Math.sin(t * 0.37) + 0.3 * Math.sin(t * 0.83 + 1.7) + 0.2 * Math.sin(t * 1.91 + 4.2)
  const x = THREE.MathUtils.clamp((s + 0.8) / 1.6, 0, 1)
  return x * x * (3 - 2 * x)
}

// Adapter from the perspective tornado scene to the three screen-space RC inputs,
// plus the swirl's two layers (behind / in front of the works) for the composite.
export class TornadoLighting {
  constructor(renderer) {
    this.renderer = renderer
    this.rc = new RadianceCascades(renderer)
    this.light = new LazyLight()
    this.params = {
      // Cursor light: a subtle light, not a spotlight. The default is the minimum of the
      // panel's range (CURSOR_LIGHT_MIN); it fades in from 0 up to it, never above.
      lightRadius: 0.025, lightIntensity: CURSOR_LIGHT_MIN, thumbsOcclude: false,
      thumbBrightness: 0.6,   // works' base brightness (the hovered work shows at full)
      swirlBrightness: 0.92,  // white of the ink strokes (flat: strokes are never shaded)
      flareThreshold: 1.8,    // light above the ambient that turns into a flat white flare
      flareRays: 0.8,         // raggedness of the flare's edge
      frontOpacity: 0.75,     // heaviest gust: the front draws its most strokes
      gustStrength: 0.75,     // how far gusts thin the front strokes (0 = constant)
      strokeShadows: 0.6,     // how much of the front strokes block light (0 = none)
    }
    this.rc.params.ambient = 0.12
    this.rc.params.exposure = 1.2
    this.clock = 0
    this.veil = 0
    this.maskMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false,
    })
    this.emissiveScene = new THREE.Scene()
    this.lightCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1)
    const circle = new THREE.CircleGeometry(1, 64)
    // Inner lights: emit into the RC but write alpha 0, so the composite never draws their
    // discs directly (they are seen only through the light they cast)
    this.innerDiscs = Array.from({ length: MAX_INNER_LIGHTS }, () => {
      const disc = new THREE.Mesh(circle, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.NoBlending,
        depthTest: false, depthWrite: false, toneMapped: false,
      }))
      this.emissiveScene.add(disc)
      return disc
    })
    // Cursor light, drawn last (on top) and seen directly
    this.disc = new THREE.Mesh(
      circle,
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1, blending: THREE.NoBlending,
        depthTest: false, depthWrite: false, toneMapped: false,
      }),
    )
    this.disc.renderOrder = 1
    this.emissiveScene.add(this.disc)
    this.savedColor = new THREE.Color()
    this.bufferSize = new THREE.Vector2()
    this.projected = new THREE.Vector3()
    this.viewPos = new THREE.Vector3()
    // The swirl's halves, at CSS resolution (the dither is sized in CSS pixels)
    const layer = () => new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
    })
    this.swirlBack = layer()
    this.swirlFront = layer()
    // Hovered work, rendered alone at full resolution (composited, not lit)
    this.highlightTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
    this.highlightScene = new THREE.Scene()
    this.highlightProxy = new THREE.Mesh()
    this.highlightProxy.frustumCulled = false
    this.highlightScene.add(this.highlightProxy)
  }

  resize(w, h) {
    this.width = w
    this.height = h
    this.renderer.getDrawingBufferSize(this.bufferSize)
    // A window that opens hidden can report 0×0: never allocate a zero-size target
    this.bufferSize.set(Math.max(1, this.bufferSize.x), Math.max(1, this.bufferSize.y))
    this.rc.setSize(w, h, this.bufferSize.x, this.bufferSize.y)
    // Dithering runs at CSS pixel resolution rather than multiplying its cost by DPR².
    const cw = Math.max(1, Math.round(w)), ch = Math.max(1, Math.round(h))
    this.swirlBack.setSize(cw, ch)
    this.swirlFront.setSize(cw, ch)
    this.highlightTarget.setSize(this.bufferSize.x, this.bufferSize.y)
  }

  // Inner lights → screen-space discs in the emissive pass (0..1 coords, y up)
  placeInnerLights(lights, camera) {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    this.innerDiscs.forEach((disc, i) => {
      const light = lights?.[i]
      disc.visible = Boolean(light && light.intensity > 0.001)
      if (!disc.visible) return
      this.projected.copy(light.position).project(camera)
      this.viewPos.copy(light.position).applyMatrix4(camera.matrixWorldInverse)
      const r = light.radius / (2 * Math.max(0.1, -this.viewPos.z) * tanHalf)   // fraction of the height
      disc.position.set((this.projected.x + 1) / 2, (this.projected.y + 1) / 2, 0)
      disc.scale.set(r * this.height / this.width, r, 1)
      disc.material.color.setScalar(light.intensity)
    })
  }

  // scene/camera: the tornado; receivers: the works; debris: extra occluders;
  // swirl: InkTornado (drawn strokes); highlight: { mesh, amount }; hole: { x, y, radius, amount }
  // in CSS px; innerLights: InnerLights.lights
  render(dt, { scene, camera, receivers, debris, swirl, highlight = null, hole = null, innerLights = null }) {
    const p = this.params
    this.clock += dt
    // Cursor light runs every frame
    this.light.update(dt, this.width, this.height)
    this.disc.position.set(this.light.x / this.width, 1 - this.light.y / this.height, 0)
    this.disc.scale.set(p.lightRadius * this.height / this.width, p.lightRadius, 1)
    // Off until the pointer first enters; fades out / in when it leaves / returns
    this.disc.visible = this.light.x !== null && this.light.presence > 0
    this.disc.material.color.setScalar(p.lightIntensity * this.light.presence)
    this.placeInnerLights(innerLights, camera)
    // Gusts: the front veil thickens and clears over several seconds, never opaque
    const heavy = Math.min(p.frontOpacity, MAX_FRONT_OPACITY)
    this.veil = heavy * (1 - p.gustStrength * (1 - gustNoise(this.clock)))

    const r = this.renderer
    const oldTarget = r.getRenderTarget()
    const oldAutoClear = r.autoClear
    r.getClearColor(this.savedColor)
    const oldAlpha = r.getClearAlpha()
    const oldBackground = scene.background
    const oldOverride = scene.overrideMaterial
    const receiversVisible = receivers.visible
    const debrisVisible = debris.visible
    const k = this.rc.compositeMat.uniforms
    try {
      r.autoClear = false
      r.setClearColor(0x000000, 1)
      scene.background = null

      // Linear thumbnail colors with a depth buffer: nearest image wins at overlaps.
      receivers.visible = true
      debris.visible = false
      scene.overrideMaterial = null
      r.setRenderTarget(this.rc.albedoTarget)
      // Alpha distinguishes work silhouettes from empty space in the final composite.
      r.setClearColor(0x000000, 0)
      r.clear()
      r.render(scene, camera)

      // The swirl's two halves, sorted against the works' depth
      const su = swirl?.material.uniforms
      if (swirl) {
        su.uDepth.value = this.rc.albedoTarget.depthTexture
        su.uUseDepth.value = true
        su.uHole.value.set(hole?.x ?? 0, this.height - (hole?.y ?? 0), hole?.radius ?? 0)
        su.uHoleAmount.value = hole?.amount ?? 0
        // Gusts change how many front strokes there are, not their opacity (ink is opaque)
        su.uVeil.value = this.veil / MAX_FRONT_OPACITY
        // Lit zones draw fatter strokes: last frame's fluence (one frame late is invisible)
        su.uLight.value = this.rc.cascades[0]?.texture ?? null
        su.uHasLight.value = Boolean(this.rc.cascades[0])
        su.uAmbientFluence.value = this.rc.params.ambient * 2 * Math.PI
        for (const [layer, target] of [[SWIRL_BACK, this.swirlBack], [SWIRL_FRONT, this.swirlFront]]) {
          swirl.setLayer(layer, target.width, target.height)
          r.setRenderTarget(target)
          r.clear()
          r.render(swirl.scene, camera)
        }
      }
      r.setClearColor(0x000000, 1)
      k.uSwirlBack.value = this.swirlBack.texture
      k.uSwirlFront.value = this.swirlFront.texture
      k.uHasSwirl.value = Boolean(swirl)
      k.uSwirlBrightness.value = p.swirlBrightness
      k.uFrontAlpha.value = 1
      k.uFlareThreshold.value = p.flareThreshold
      k.uFlareRays.value = p.flareRays
      if (swirl) k.uBoil.value.copy(swirl.boil)
      k.uThumbBrightness.value = p.thumbBrightness

      // Union of projected blockers, independent of the thumbnail depth buffer.
      receivers.visible = p.thumbsOcclude
      debris.visible = true
      scene.overrideMaterial = this.maskMaterial
      r.setRenderTarget(this.rc.occluderTarget)
      r.clear()
      r.render(scene, camera)
      // The thick bodies of the front strokes block light too, so the inner light leaks out
      // between them as rays. Their density already follows the gusts.
      if (swirl && p.strokeShadows > 0) {
        const t = this.rc.occluderTarget
        swirl.setLayer(SWIRL_OCCLUDER, t.width, t.height)
        // Only stroke bodies wider than this (px, half width) block light
        su.uOccOffset.value = 0.5 + (1 - p.strokeShadows) * 6
        r.render(swirl.scene, camera)
      }

      // Pixel-aligned screen-space lights, independent of the perspective camera.
      r.setRenderTarget(this.rc.emissiveTarget)
      r.clear()
      r.render(this.emissiveScene, this.lightCamera)

      // Hovered work alone, with its own material and current transform
      k.uHighlightAmount.value = highlight?.mesh ? highlight.amount : 0
      if (highlight?.mesh && highlight.amount > 0) {
        const proxy = this.highlightProxy
        proxy.geometry = highlight.mesh.geometry
        proxy.material = highlight.mesh.material
        highlight.mesh.updateWorldMatrix(true, false)
        proxy.matrixAutoUpdate = false
        proxy.matrix.copy(highlight.mesh.matrixWorld)
        proxy.matrixWorld.copy(highlight.mesh.matrixWorld)
        r.setRenderTarget(this.highlightTarget)
        r.setClearColor(0x000000, 0)
        r.clear()
        // Color comes back on the hovered work only
        const sat = proxy.material.uniforms?.uSaturation
        const oldSat = sat?.value
        if (sat) sat.value = 1
        r.render(this.highlightScene, camera)
        if (sat) sat.value = oldSat
        r.setClearColor(0x000000, 1)
      }
      k.uHighlight.value = this.highlightTarget.texture
      this.rc.render()
    } finally {
      receivers.visible = receiversVisible
      debris.visible = debrisVisible
      scene.overrideMaterial = oldOverride
      scene.background = oldBackground
      r.setRenderTarget(oldTarget)
      r.setClearColor(this.savedColor, oldAlpha)
      r.autoClear = oldAutoClear
    }
  }

  dispose() {
    this.light.dispose()
    this.rc.dispose()
    this.swirlBack.dispose()
    this.swirlFront.dispose()
    this.highlightTarget.dispose()
    this.maskMaterial.dispose()
    this.disc.geometry.dispose()
    this.disc.material.dispose()
    this.innerDiscs.forEach(d => d.material.dispose())
  }
}
