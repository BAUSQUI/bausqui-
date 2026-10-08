import * as THREE from 'three'
import { Experience } from '../../Experience.js'
import { RadianceCascades, VIEWS } from './RadianceCascades.js'
import { LazyLight } from './LazyLight.js'

// Checkpoint 3 laboratory: receivers and blockers have independent masks.
export class RCTestExperience extends Experience {
  init({ renderer }) {
    this.renderer = renderer
    this.disposed = false
    this.style = document.createElement('style')
    this.style.textContent = `body > :not(canvas):not(.lil-gui):not(.rc-test-note) { display: none !important; }
      html, body { cursor: crosshair !important; }
      .rc-test-note { position: fixed; bottom: 24px; left: 24px; z-index: 10000; color: white;
        font: 12px Helvetica, Arial, sans-serif; pointer-events: none; max-width: 70vw; }`
    document.head.append(this.style)
    this.note = document.createElement('p')
    this.note.className = 'rc-test-note'
    this.note.textContent = 'RC / CHECKPOINT 3 — Move the cursor to illuminate the rectangles. Silent preview.'
    document.body.append(this.note)
    if (!RadianceCascades.isSupported(renderer)) {
      this.note.textContent = 'RC preview requires WebGL2 and renderable floating-point textures.'
      return
    }
    this.rc = new RadianceCascades(renderer)
    this.light = new LazyLight()
    this.params = { lightRadius: 0.025, lightIntensity: 5, follow: true }
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1)
    this.albedo = new THREE.Scene()
    this.occluders = new THREE.Scene()
    this.emissive = new THREE.Scene()
    this.geometry = new THREE.PlaneGeometry(1, 1)
    this.materials = []
    const addRect = (scene, x, y, w, h, gray) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(gray), depthTest: false, depthWrite: false, toneMapped: false })
      this.materials.push(material)
      const mesh = new THREE.Mesh(this.geometry, material)
      mesh.position.set(x, y, 0)
      mesh.scale.set(w, h, 1)
      scene.add(mesh)
      return mesh
    }
    // Broad receiver surfaces make shadow boundaries visible across the scene.
    addRect(this.albedo, 0.5, 0.5, 1, 1, 0.12)
    for (const [x, y, w, h, gray] of [
      [0.26, 0.65, 0.28, 0.27, 0.9], [0.70, 0.63, 0.27, 0.31, 0.65],
      [0.42, 0.23, 0.32, 0.19, 0.8], [0.83, 0.23, 0.17, 0.16, 0.45],
    ]) addRect(this.albedo, x, y, w, h, gray)
    addRect(this.occluders, 0.48, 0.59, 0.012, 0.35, 1)
    addRect(this.occluders, 0.65, 0.37, 0.23, 0.012, 1)
    addRect(this.occluders, 0.22, 0.36, 0.012, 0.16, 1)
    this.discGeometry = new THREE.CircleGeometry(1, 64)
    this.discMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false })
    this.disc = new THREE.Mesh(this.discGeometry, this.discMaterial)
    this.emissive.add(this.disc)
    this.resize(window.innerWidth, window.innerHeight)
    this.initGui()
  }

  async initGui() {
    if (!import.meta.env.DEV) return
    const { default: GUI } = await import('lil-gui')
    if (this.disposed) return
    this.gui = new GUI({ title: 'RC / Checkpoint 3' })
    this.gui.add(this.rc.params, 'view', VIEWS).name('Buffer')
    this.gui.add(this.rc.params, 'debugCascade', 0, this.rc.nCascades - 1, 1).name('Cascade n')
    this.gui.add(this.params, 'lightIntensity', 0, 20, 0.1).name('Light intensity')
    this.gui.add(this.params, 'lightRadius', 0.005, 0.1, 0.001).name('Light radius')
    this.gui.add(this.params, 'follow').name('Move light')
    this.gui.add(this.light, 'friction', 0.001, 0.99, 0.001).name('Follow friction')
    this.gui.add(this.rc.params, 'ambient', 0, 0.2, 0.001)
    this.gui.add(this.rc.params, 'exposure', 0.1, 4, 0.1)
  }

  resize(w, h) {
    this.width = w
    this.height = h
    if (!this.rc) return
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.rc.setSize(w, h, size.x, size.y)
  }

  update(dt) {
    if (!this.rc) return
    if (this.params.follow || this.light.x === null) this.light.update(dt, this.width, this.height)
    this.disc.position.set(this.light.x / this.width, 1 - this.light.y / this.height, 0)
    this.disc.scale.set(this.params.lightRadius * this.height / this.width, this.params.lightRadius, 1)
    this.discMaterial.color.setScalar(this.params.lightIntensity * this.light.presence)
    this.disc.visible = this.light.x !== null && this.light.presence > 0
    const r = this.renderer
    const oldTarget = r.getRenderTarget()
    const oldColor = r.getClearColor(new THREE.Color())
    const oldAlpha = r.getClearAlpha()
    const oldAutoClear = r.autoClear
    try {
      r.autoClear = false
      r.setClearColor(0x000000, 1)
      for (const [scene, target] of [[this.albedo, this.rc.albedoTarget], [this.occluders, this.rc.occluderTarget], [this.emissive, this.rc.emissiveTarget]]) {
        r.setRenderTarget(target)
        r.clear()
        r.render(scene, this.camera)
      }
      this.rc.render()
    } finally {
      r.setRenderTarget(oldTarget)
      r.setClearColor(oldColor, oldAlpha)
      r.autoClear = oldAutoClear
    }
  }

  dispose() {
    this.disposed = true
    this.gui?.destroy()
    this.light?.dispose()
    this.rc?.dispose()
    this.geometry?.dispose()
    this.materials?.forEach(m => m.dispose())
    this.discGeometry?.dispose()
    this.discMaterial?.dispose()
    this.style.remove()
    this.note.remove()
  }
}
