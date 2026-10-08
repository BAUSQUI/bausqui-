// Thumbnail funnel lit by full-frame screen-space RC. Motion is continuous and dt-based.
import * as THREE from 'three'
import { Experience } from '../Experience.js'
import { PROJECTS } from '../../data/projects.js'
import { DEFAULT_PARAMS, createSlots, slotTransform } from './tornadoLayout.js'

// prefers-reduced-motion: the same tornado, just turning slower
const REDUCED_MOTION_RATE = 0.35
import { createDebris, updateDebris } from './debris.js'
import { TornadoLighting, CURSOR_LIGHT_MIN } from './TornadoLighting.js'
import { RadianceCascades, VIEWS } from './rc/RadianceCascades.js'
import { mountTornadoHome } from './homeLayout.js'
import { WorkHover } from './workHover.js'
import { InnerLights } from './innerLights.js'
import { InkTornado } from './inkTornado.js'
import { ClickTransition } from './clickTransition.js'
import { InkEye } from './inkEye.js'
import { TornadoAudio } from './tornadoAudio.js'
import { state } from '../../state.js'

const HOLE_SCALE = 1.5   // the hover hole in the strokes is ~1.5× the hovered work
const TAU = Math.PI * 2
const FOCUS_DISTANCE = 1.2   // the clicked work ends this far in front of the camera, filling the view
const rand = (a, b) => a + Math.random() * (b - a)
// What the eye's calm zone must keep clear: the overlay content (video, controls, text,
// manual, embed). Only the parts on screen count, so the zone follows the scroll.
const CALM_CONTENT = '#video-wrapper, #timeline-control, #video-abstract, #section-video .scroll-hint, '
  + '#pdf-header, #pdf-container > *, #section-embed > *'
const CALM_PAD = 24   // px around the content
const CALM_CORNER = Math.pow(2, 1 / 4)   // superellipse n = 4 through the box corners (inkEye calmShape)

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Grayscale thumbnail. Back faces flip U so images never read mirrored, and sit a bit darker.
const fragmentShader = /* glsl */`
  uniform sampler2D uMap;
  uniform float uSaturation;
  varying vec2 vUv;
  void main() {
    vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec3 color = texture2D(uMap, uv).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, uSaturation);
    if (!gl_FrontFacing) color *= 0.6;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

// Every thumbnail frame, interleaved (frame 1 of each project, then frame 2, …)
// so neighbouring planes come from different projects.
function listThumbs() {
  const withThumbs = PROJECTS.filter(p => p.thumbs.count > 0)
  const maxFrames = Math.max(...withThumbs.map(p => p.thumbs.count))
  const list = []
  for (let f = 1; f <= maxFrames; f++) {
    for (const p of withThumbs) {
      if (f > p.thumbs.count) continue
      list.push({ projectId: p.id, url: `/thumbs/${p.thumbs.folder}/${String(f).padStart(2, '0')}.jpg` })
    }
  }
  return list
}

export class TornadoExperience extends Experience {
  // Loader checklist entries for this experience (fonts + music are shared)
  // The loader IS the tornado assembling itself (CLAUDE.md "Loader"): this experience
  // registers its own assets in load order and seals the loader (main.js)
  static ownLoader = true
  static loaderKeys = {}

  init(ctx) {
    this.ctx = ctx
    this.renderer = ctx.renderer
    this.heroVisible = true
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.homeLayout = mountTornadoHome(this.renderer, { onHeroVisibility: (v) => this.setHeroVisible(v) })
    this.params = { ...DEFAULT_PARAMS }
    // The loader's assembly replaces the old intro where the works flew in from outside
    this.params.captureSpread = 0
    // Load order: the core (this first rendered frame) → then thumbnails + audio
    this.coreDone = false
    this.spinIn = 0
    window.__loader?.add('core')
    this.time = 0
    this.disposed = false
    this.openOverlays = new Set()
    this.innerLights = new InnerLights()
    // The swirl: discrete drawn ink strokes (see CLAUDE.md "Ink rendering rules")
    this.ink = new InkTornado()
    // Click: the tornado explodes, the clicked work fills the screen, the project opens
    this.transition = new ClickTransition({ onOpen: (id) => this.ctx.openProject(id) })
    this.focusPose = { pos: new THREE.Vector3(), scale: new THREE.Vector3(), fwd: new THREE.Vector3() }
    // While a project is open: the light "eye of the storm" mode instead of the tornado
    this.eye = new InkEye()
    // Sound: music-port + two tornado stems; the storm calms (tornado stems out, only
    // music-port left) while a work is hovered (incl. its leave delay) and during the explosion
    this.audio = new TornadoAudio({
      isCalm: () => Boolean(this.hover?.hovered) || this.transition.mode === 'explode' || this.transition.mode === 'handoff',
    })
    this.hole = { x: 0, y: 0, radius: 0, amount: 0 }
    this.holePoint = new THREE.Vector3()

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050505)
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100)

    this.geometry = new THREE.PlaneGeometry(1, 1)
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.meshes = []
    this.debrisMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
    this.debris = createDebris(this.geometry, this.debrisMaterial)
    this.debris.visible = false
    this.scene.add(this.debris)
    if (RadianceCascades.isSupported(this.renderer)) {
      this.lighting = new TornadoLighting(this.renderer)
    } else {
      // Keep project navigation available. The spotlight fallback belongs to Checkpoint 6.
      console.warn('RC unavailable on this device; showing the unlit tornado preview.')
    }

    this.thumbs = listThumbs()
    this.materials = this.thumbs.map(() => new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uSaturation: { value: this.params.saturation } },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    }))

    this.rebuild()
    this.resize(window.innerWidth, window.innerHeight)

    this.hover = new WorkHover({
      camera: this.camera,
      canvas: this.renderer.domElement,
      hero: this.homeLayout.hero,
      getMeshes: () => this.meshes.filter(m => m.visible),
      onOpen: (id, mesh, highlight) => this.openProject(id, mesh, highlight),
    })

    this.initGui()
  }

  // Each thumbnail is its own loader asset; it pops into its slot when it actually arrives
  loadTextures() {
    const L = window.__loader
    const loader = new THREE.TextureLoader()
    this.thumbs.forEach((thumb, i) => {
      const id = `thumb:${i}`
      L?.add(id)
      loader.load(thumb.url, (tex) => {
        L?.done(id)
        if (this.disposed) { tex.dispose(); return }
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
        this.materials[i].uniforms.uMap.value = tex
        this.materials[i].userData.loadedAt = performance.now()
      }, undefined, () => {
        console.warn('Thumbnail failed to load:', thumb.url)
        L?.done(id)   // failed: skipped, never blocks the loader
      })
    })
  }

  // After the first rendered frame: the core is up (the loader turns transparent, unless
  // reduced motion keeps it opaque until the finished tornado fades in), then the rest loads
  startAssets() {
    const L = window.__loader
    this.coreDone = true
    L?.coreReady(!this.reducedMotion.matches)
    L?.done('core')
    this.loadTextures()
    this.audio.load()
    L?.seal()
  }

  // (Re)create the planes for the current count. Materials/textures are shared and kept.
  rebuild() {
    this.meshes.forEach(m => this.group.remove(m))
    this.slots = createSlots(this.params.count, this.params.turns, this.params.strands)
    this.meshes = this.slots.map((slot, i) => {
      const thumbIndex = i % this.thumbs.length
      const mesh = new THREE.Mesh(this.geometry, this.materials[thumbIndex])
      mesh.userData.projectId = this.thumbs[thumbIndex].projectId
      mesh.userData.slot = slot
      this.group.add(mesh)
      return mesh
    })
  }

  // Frame the whole funnel, whichever of height or width is the tighter fit
  fitCamera() {
    const p = this.params
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2)
    // Frame the settled vortex, allowing incoming works to enter from outside the
    // hero. Including their starting spread made the final tornado unnecessarily small.
    const halfH = p.height / 2 + p.planeWidth * 0.5 + 0.3 * p.turbulence
    const halfW = p.topRadius * (1 + 0.24 * p.turbulence + p.breathe) + p.planeWidth * 0.5 + 0.8 * p.axisSway
    // The tornado is the protagonist: ~85% of the viewport height. On narrow portrait
    // screens the width limit wins; let the wide top crop slightly so it still fills the screen.
    const heightFill = 0.85
    const widthFill = this.camera.aspect < 0.8 ? 1.15 : 0.95
    const dist = Math.max(
      halfH / (Math.tan(halfFov) * heightFill),
      halfW / (Math.tan(halfFov) * this.camera.aspect * widthFill),
    )
    this.camera.position.set(0, p.height * 0.08, dist)
    this.camera.lookAt(0, 0, 0)
  }

  update(dt) {
    // Hide the home scene during overlays and avoid running the expensive lighting
    // behind video playback. The independent overlay flags also handle delayed closes.
    const onlyProject = this.openOverlays.has('project') && this.openOverlays.size === 1
    // Closing a project after an explosion: the reassembly starts as soon as the overlay
    // starts fading, so the video gives way to its thumbnail shrinking back and the eye's
    // ring hands straight over to the tornado's inflowing strokes (no cut, no gap)
    if (onlyProject && state.isExiting && this.transition.mode === 'open') this.transition.assemble()
    if (this.openOverlays.size > 0 && !(onlyProject && this.transition.mode === 'assemble')) {
      // A project is open: the full tornado (works, RC, collisions) is paused and only the
      // light eye-of-the-storm mode runs behind the overlay
      if (onlyProject) this.updateEye(dt)
      return
    }
    // Hero scrolled away (<10% visible): skip the update loop and the RC passes
    if (!this.heroVisible && !this.transition.busy) return
    this.transition.update(dt)
    const tr = this.transition
    // Loading: the tornado assembles from the loader's REAL progress and doesn't turn yet;
    // at 100% it eases into its normal rotation. Hover waits until the user is in.
    const L = window.__loader
    const loading = Boolean(L) && !L.complete
    const entered = !L || L.entered
    const assembling = loading && !this.reducedMotion.matches
    const d = L ? L.displayed : 1
    if (!loading) this.spinIn = Math.min(1, this.spinIn + dt / 1.5)
    const spin = this.spinIn * this.spinIn * (3 - 2 * this.spinIn)
    // The clock advances by dt, so the speed doesn't depend on the frame rate.
    // Hovering a work decelerates it to a stop (timeScale eases to 0).
    const rate = this.reducedMotion.matches ? REDUCED_MOTION_RATE : 1
    this.time += dt * this.hover.timeScale * rate * spin
    // Transforms are recomputed every frame from the clock: continuous motion
    for (const mesh of this.meshes) slotTransform(mesh.userData.slot, this.time, this.params, mesh)
    this.popThumbs()
    if (tr.burst > 0 || tr.focus > 0) this.applyBurst(tr)
    updateDebris(this.debris, this.time, this.params)
    // Raycast against the transforms just applied
    this.hover.enabled = entered && !tr.exploded
    this.hover.update(dt)
    this.innerLights.update(dt, this.time, this.params, this.hover.highlight)
    // The lights come up with the assembly
    if (assembling) for (const l of this.innerLights.lights) l.intensity *= d * d
    this.innerLights.calm = assembling
    // Strokes and particles: control points follow the clock; the drawing boils on wall time.
    // The cursor light (lazy, fading) makes nearby particles bigger.
    const light = this.lighting?.light
    const cursor = light && light.x !== null && light.presence > 0 ? { x: light.x, y: light.y, presence: light.presence } : null
    // The inner lights go out with the burst (no flare left floating in empty space)
    if (tr.burst > 0) for (const l of this.innerLights.lights) l.intensity *= 1 - tr.burst
    this.ink.burst = tr.burst
    this.ink.burstSign = tr.mode === 'assemble' ? -1 : 1
    // Loader assembly: 0–30% particles spiral in, 30–80% strokes form from the bottom up
    this.ink.assembly = assembling
      ? { particles: Math.min(1, d / 0.3), strokes: Math.min(1, Math.max(0, (d - 0.3) / 0.5)) }
      : null
    this.ink.update(dt, this.time, this.params, this.meshes, this.camera, cursor)
    if (this.lighting) {
      const k = this.lighting.rc.compositeMat.uniforms
      k.uImpact.value = tr.impact === 2 && tr.params.impactFrames < 2 ? 0 : tr.impact
      k.uImpactLevel.value = tr.params.impactLevel
      this.updateHole()
      this.lighting.render(dt, {
        scene: this.scene,
        camera: this.camera,
        receivers: this.group,
        debris: this.debris,
        swirl: this.ink,
        // The clicked work goes to full brightness (and color) as it fills the screen
        highlight: tr.mesh
          ? { mesh: tr.mesh, amount: Math.max(tr.focus, tr.mode === 'explode' ? this.clickHighlight : 0) }
          : { mesh: this.hover.highlightMesh, amount: this.hover.highlight },
        hole: this.hole,
        innerLights: this.innerLights.lights,
      })
    } else {
      const autoClear = this.renderer.autoClear
      const background = this.scene.background
      try {
        this.renderer.autoClear = false
        this.renderer.clear()
        // Unlit preview: the works, then every stroke over them
        this.scene.background = null
        this.renderer.render(this.scene, this.camera)
        this.ink.setLayer(1, window.innerWidth, window.innerHeight)
        this.ink.material.uniforms.uUseDepth.value = false
        this.renderer.render(this.ink.scene, this.camera)
      } finally {
        this.renderer.autoClear = autoClear
        this.scene.background = background
      }
    }
    if (!this.coreDone) this.startAssets()
  }

  // Thumbnails appear only once their image has loaded, easing into their slot (soft, no
  // overshoot: the loading stays calm), one by one as each one actually arrives
  popThumbs() {
    const now = performance.now()
    for (const mesh of this.meshes) {
      const at = mesh.material.userData.loadedAt
      mesh.visible = Boolean(at)
      if (!at) continue
      const k = (now - at) / 700
      if (k < 1) mesh.scale.multiplyScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)))   // easeOutCubic
    }
  }

  // Burst: every work but the clicked one is flung outward along the spin, tumbling; the
  // clicked one flies to the camera and fills the screen (focus). Runs on top of the slot
  // transforms, so reversing burst / focus puts everything back in its slot.
  applyBurst(tr) {
    const b = Math.pow(tr.burst, 1.1)
    for (const mesh of this.meshes) {
      if (mesh === tr.mesh) continue
      const f = mesh.userData.burst ??= { r: rand(3.5, 6.5), t: rand(1, 2.5), y: rand(-2, 2), sx: rand(-1.5, 1.5), sz: rand(-1.5, 1.5) }
      const p = mesh.position
      const rl = Math.hypot(p.x, p.z) || 1
      const rx = p.x / rl, rz = p.z / rl
      p.x += (rx * f.r - rz * f.t) * b
      p.z += (rz * f.r + rx * f.t) * b
      p.y += f.y * b
      mesh.rotation.x += f.sx * TAU * b
      mesh.rotation.z += f.sz * TAU * b
      mesh.scale.multiplyScalar(1 - 0.35 * b)
    }
    const m = tr.mesh
    if (m && tr.focus > 0) {
      // A camera-facing pose that covers the whole view
      const cam = this.camera
      const fp = this.focusPose
      fp.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
      fp.pos.copy(cam.position).addScaledVector(fp.fwd, FOCUS_DISTANCE)
      const visH = 2 * FOCUS_DISTANCE * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      const s = Math.max(visH * cam.aspect, visH / (9 / 16)) * 1.03
      m.position.lerp(fp.pos, tr.focus)
      m.quaternion.slerp(cam.quaternion, tr.focus)
      m.scale.lerp(fp.scale.set(s, s * 9 / 16, 1), tr.focus)
    }
    for (const mesh of this.meshes) mesh.updateMatrixWorld()
  }

  // The eye of the storm, behind the project overlay
  updateEye(dt) {
    const sc = document.getElementById('video-scroll-container')
    this.eye.update(dt, { scroll: sc?.scrollTop || 0, calm: this.calmZone(), closing: state.isExiting })
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.eye.scene, this.eye.camera)
  }

  // Calm zone (world: CSS px, origin at the center, y up) around the overlay content in view:
  // a superellipse (exponent 4) whose semi-axes are the content box's half sizes × 2^(1/4),
  // so it passes through the box's corners and covers all of it.
  calmZone() {
    const W = window.innerWidth, H = window.innerHeight
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (const el of document.querySelectorAll(CALM_CONTENT)) {
      const rc = el.getBoundingClientRect()
      if (rc.width < 2 || rc.height < 2 || rc.bottom < 0 || rc.top > H) continue
      l = Math.min(l, Math.max(0, rc.left)); t = Math.min(t, Math.max(0, rc.top))
      r = Math.max(r, Math.min(W, rc.right)); b = Math.max(b, Math.min(H, rc.bottom))
    }
    if (!Number.isFinite(l)) return null
    l -= CALM_PAD; t -= CALM_PAD; r += CALM_PAD; b += CALM_PAD
    return {
      cx: (l + r) / 2 - W / 2, cy: H / 2 - (t + b) / 2,
      ax: Math.max(1, (r - l) / 2 * CALM_CORNER), ay: Math.max(1, (b - t) / 2 * CALM_CORNER),
    }
  }

  // A click on a work in the tornado (or a list row while the hero is visible) explodes the
  // tornado; reduced motion, or the hero off screen, opens the project with a plain fade
  openProject(id, mesh = null, highlight = 0) {
    if (this.transition.exploded) return
    this.hover.clear(true)
    if (!mesh || this.reducedMotion.matches || !this.heroVisible || !this.lighting) {
      this.transition.fadeOpen(id)
      return
    }
    this.clickHighlight = highlight
    this.meshes.forEach(m => { delete m.userData.burst })
    this.transition.explode(mesh, id)
  }

  // The work for a project nearest the camera, for list clicks
  meshFor(projectId) {
    let best = null
    for (const m of this.meshes) {
      if (m.userData.projectId !== projectId) continue
      if (!best || m.position.z > best.position.z) best = m
    }
    return best
  }

  // The front veil's hole follows the hovered work: centered on it, radius from its
  // projected size. The last position is kept while the hole closes.
  updateHole() {
    const mesh = this.hover.highlightMesh
    if (mesh) {
      const W = window.innerWidth, H = window.innerHeight
      const toScreen = (x, y) => {
        this.holePoint.set(x, y, 0)
        mesh.localToWorld(this.holePoint).project(this.camera)
        return [(this.holePoint.x + 1) / 2 * W, (1 - this.holePoint.y) / 2 * H]
      }
      const [cx, cy] = toScreen(0, 0)
      const [ax, ay] = toScreen(-0.5, 0), [bx, by] = toScreen(0.5, 0)
      const [dx, dy] = toScreen(0, -0.5), [ex, ey] = toScreen(0, 0.5)
      const size = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(ex - dx, ey - dy))
      this.hole.x = cx
      this.hole.y = cy
      this.hole.radius = size * HOLE_SCALE / 2
    }
    this.hole.amount = this.hover.hole
  }

  // The canvas covers the whole viewport (fixed); the list scrolls over it
  resize(w, h) {
    // A window that opens hidden can report 0×0: a 0/0 aspect would put NaN in the camera
    // and in everything placed from it (strokes, particles) on the first frame
    w = Math.max(1, w)
    h = Math.max(1, h)
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.fitCamera()
    this.lighting?.resize(w, h)
    this.ink.resize(w, h)
    this.eye.resize(w, h, this.renderer.getPixelRatio())
    if (this.openOverlays.size > 0) this.clearHome()
  }

  clearHome() {
    const r = this.renderer
    const target = r.getRenderTarget()
    const color = r.getClearColor(new THREE.Color())
    const alpha = r.getClearAlpha()
    r.setRenderTarget(null)
    r.setClearColor(0x050505, 1)
    r.clear()
    r.setClearColor(color, alpha)
    r.setRenderTarget(target)
  }

  setHeroVisible(visible) {
    this.heroVisible = visible
    if (!visible) this.hover?.clear(true)
  }

  onOverlay(kind, open) {
    if (open) { this.openOverlays.add(kind); this.hover?.clear(true) }
    else this.openOverlays.delete(kind)
    // Closing the project after an explosion: the tornado reassembles
    if (!open && kind === 'project' && this.transition.exploded) this.transition.assemble()
    // A project opening: the eye of the storm settles in behind it (continuing the burst)
    if (open && kind === 'project') this.eye.start()
    if (this.openOverlays.size > 0) {
      // Behind a project the eye draws the canvas; behind anything else the home is hidden
      if (!(this.openOverlays.has('project') && this.openOverlays.size === 1)) this.clearHome()
      this.gui?.hide()
    } else {
      this.gui?.show()
    }
  }

  // Works-list rows open straight away (hover/click inside the tornado is in workHover.js)
  selectProject(project) {
    if (this.transition.exploded) return true
    // Hero visible: the same explosion as a click in the tornado; otherwise a plain fade
    this.openProject(project.id, this.heroVisible ? this.meshFor(project.id) : null, 0)
    return true
  }

  // Debug controls, dev server only: the whole block (and lil-gui) is dropped from production builds
  async initGui() {
    if (!import.meta.env.DEV) return
    const { default: GUI } = await import('lil-gui')
    if (this.disposed) return
    const gui = new GUI({ title: 'Tornado' })
    const p = this.params
    const refit = () => this.fitCamera()
    gui.add(p, 'count', 6, 160, 1).name('plane count').onFinishChange(() => { this.rebuild(); refit() })
    gui.add(p, 'baseRadius', 0, 3, 0.01).name('base radius').onChange(refit)
    gui.add(p, 'topRadius', 0.5, 6, 0.01).name('top radius').onChange(refit)
    gui.add(p, 'height', 1, 12, 0.1).onChange(refit)
    gui.add(p, 'spinSpeed', 0, 2, 0.01).name('spin speed')
    gui.add(p, 'turns', 0.5, 10, 0.1).onFinishChange(() => { this.rebuild(); refit() })
    gui.add(p, 'strands', 1, 8, 1).onFinishChange(() => { this.rebuild(); refit() })
    gui.add(p, 'planeWidth', 0.3, 2, 0.01).name('plane size').onChange(refit)
    if (this.lighting) {
      // Look: a readable base light; the cursor and the inner lights add on top
      const { rc, params: lp } = this.lighting
      const light = gui.addFolder('Light')
      light.add(rc.params, 'ambient', 0, 0.4, 0.001)
      light.add(lp, 'thumbBrightness', 0, 1.5, 0.01)
      light.add(lp, 'lightIntensity', CURSOR_LIGHT_MIN, 12, 0.1).name('cursorLightIntensity')
      light.add(rc.params, 'exposure', 0.1, 4, 0.05)
      light.add(lp, 'swirlBrightness', 0, 1, 0.01).name('stroke white')
      light.add(lp, 'flareThreshold', 0.1, 4, 0.01).name('flare threshold')
      light.add(lp, 'flareRays', 0, 2, 0.01).name('flare raggedness')
      const gusts = gui.addFolder('Gusts')
      gusts.add(lp, 'frontOpacity', 0, 0.9, 0.01).name('heaviest gust')
      gusts.add(lp, 'gustStrength', 0, 1, 0.01)
      gusts.add(lp, 'strokeShadows', 0, 1, 0.01).name('stroke shadows')
      const inner = gui.addFolder('Inner light')
      const q = this.innerLights.params
      inner.add(q, 'lightCount', 0, 5, 1)
      inner.add(q, 'innerLightIntensity', 0, 10, 0.1)
      inner.add(q, 'pulseSpeed', 0, 4, 0.05)
      inner.add(q, 'flashFrequency', 0, 2, 0.01).name('flashFrequency (/s)')
      inner.add(q, 'flashIntensity', 0, 12, 0.1)
    }
    const ink = gui.addFolder('Ink')
    const ip = this.ink.params, sp = this.ink.strokes.params, pp = this.ink.particles.params
    ink.add(ip, 'scaleVariance', 0, 1, 0.01).name('stroke scale variance')
    ink.add(ip, 'loadVariance', 0, 1, 0.01).name('ink load variance')
    ink.add(ip, 'filamentSplit', 0, 1, 0.01).name('filament split')
    ink.add(ip, 'splatter', 0, 2, 0.01).name('splatter amount')
    ink.add(ip, 'depthContrast', 0, 1, 0.01).name('front/back depth contrast')
    ink.add(ip, 'differential', 0, 2, 0.01).name('differential rotation')
    ink.add(ip, 'rise', 0, 0.1, 0.001).name('rise (height/s)')
    ink.add(ip, 'pitch', 0, 0.2, 0.001).name('helix pitch')
    ink.add(ip, 'flungRate', 0, 2, 0.01).name('thrown strokes (/s)')
    ink.add(ip, 'collisions').name('works push strokes')
    ink.add(ip, 'density', 0.3, 2, 0.05).name('stroke count').onFinishChange(() => this.ink.build())
    ink.add(sp, 'boil').name('boil (redraw the drawing)')
    ink.add(sp, 'boilRate', 2, 30, 1).name('boil rate (redraws/s)')
    ink.add(sp, 'roughness', 0, 1.5, 0.01).name('edge roughness')
    ink.add(sp, 'dryBrush', 0, 2, 0.01).name('dry brush')
    ink.add(sp, 'halftoneCell', 2, 10, 0.5).name('halftone cell (px)')
    ink.add(pp, 'specks', 0, 400, 1).name('grain specks')
    ink.add(pp, 'clusters', 0, 30, 1).name('Kirby clusters')
    const tq = this.transition.params
    const click = gui.addFolder('Click transition')
    click.add(tq, 'impactMs', 0, 300, 5).name('impact (ms)')
    click.add(tq, 'impactFrames', 0, 2, 1).name('impact frames')
    click.add(tq, 'impactLevel', 0.3, 0.9, 0.01).name('impact max level')
    click.add(tq, 'burstEnd', 0.2, 2, 0.01).name('burst end (s)')
    click.add(tq, 'focusStart', 0, 2, 0.01).name('focus start (s)')
    click.add(tq, 'focusEnd', 0.2, 3, 0.01).name('focus end (s)')
    click.add(tq, 'handoffEnd', 0.2, 3, 0.01).name('handoff end (s)')
    click.add(tq, 'returnDuration', 0.2, 3, 0.01).name('reassembly (s)')
    const ap = this.audio.params
    const sound = gui.addFolder('Sound')
    sound.add(ap, 'master', 0, 1, 0.01).name('master volume')
    sound.add(ap, 'port', 0, 1, 0.01).name('music-port volume')
    sound.add(ap, 'tornado', 0, 1, 0.01).name('music-tornado volume')
    sound.add(ap, 'details', 0, 1, 0.01).name('details volume')
    sound.add(ap, 'projectDuck', 0, 0.5, 0.01).name('music-port level in a project')
    sound.add(ap, 'masterFadeIn', 0.1, 4, 0.05).name('start fade-in (s)')
    sound.add(ap, 'calmOut', 0.1, 3, 0.05).name('calm: fade out (s)')
    sound.add(ap, 'calmIn', 0.1, 3, 0.05).name('calm: fade back (s)')
    sound.add(ap, 'duckTime', 0.1, 3, 0.05).name('music-port duck (s)')
    sound.add(ap, 'toggleFade', 0.05, 2, 0.05).name('toggle fade (s)')
    const motion = gui.addFolder('Funnel motion')
    motion.add(p, 'axisSway', 0, 3, 0.01).name('axis sway').onChange(refit)
    motion.add(p, 'breathe', 0, 0.3, 0.005).name('radius breathing').onChange(refit)
    // Funnel flare: top radius as a multiple of the bottom radius
    const flare = { get ratio() { return p.topRadius / p.baseRadius }, set ratio(v) { p.topRadius = p.baseRadius * v } }
    motion.add(flare, 'ratio', 2, 14, 0.1).name('funnel flare (top/bottom)').onChange(refit)
    const vortex = motion
    vortex.add(p, 'attraction', 0.1, 2, 0.01).name('Attraction speed')
    vortex.add(p, 'motionSpeed', 0, 3, 0.05).name('Motion speed')
    vortex.add(p, 'turbulence', 0, 2, 0.05).name('Shape turbulence').onChange(refit)
    vortex.add(p, 'captureSpread', 0, 4, 0.1).name('Starting spread').onChange(refit)
    vortex.add({ replay: () => { this.time = 0 } }, 'replay').name('Replay attraction')
    gui.add(p, 'saturation', 0, 1, 0.01).onChange((v) => {
      this.materials.forEach(m => { m.uniforms.uSaturation.value = v })
      if (this.lighting) this.lighting.rc.params.saturation = v
    })
    if (this.lighting) {
      const lighting = gui.addFolder('RC debug')
      const { rc, light, params } = this.lighting
      lighting.add(rc.params, 'view', VIEWS).name('Buffer')
      lighting.add(rc.params, 'debugCascade', 0, rc.nCascades - 1, 1).name('Cascade n')
      lighting.add(params, 'lightRadius', 0.005, 0.1, 0.001).name('Light radius')
      lighting.add(light, 'friction', 0.001, 0.99, 0.001).name('Follow friction')
      lighting.add(params, 'thumbsOcclude').name('Thumbnails block light')
    }
    this.gui = gui
    gui.close()
    if (this.openOverlays.size > 0) gui.hide()
  }

  dispose() {
    this.disposed = true
    this.gui?.destroy()
    this.hover?.dispose()
    this.lighting?.dispose()
    this.ink.dispose()
    this.transition.dispose()
    this.eye.dispose()
    this.audio.dispose()
    this.homeLayout.dispose()
    this.debrisMaterial.dispose()
    this.geometry.dispose()
    this.materials.forEach(m => { m.uniforms.uMap.value?.dispose(); m.dispose() })
  }
}
