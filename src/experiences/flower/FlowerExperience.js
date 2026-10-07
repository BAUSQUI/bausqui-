// Flower experience: particle flower over the 3D body scan, ambient "bichos",
// suction on project select and the camera trip into the project.
// Code moved as-is from the original main.js; only wiring changed
// (shared renderer from ctx, shared UI state, ctx.openProject on arrival).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer, RenderPass, BloomEffect, EffectPass, GodRaysEffect } from 'postprocessing'
import { Experience } from '../Experience.js'
import { state } from '../../state.js'

// Estado
let isAnimating = false
let targetPosition = null
let targetNombre = null
let entryPoint = null
let animPhase = 0
let cameraStartZ = 2

let hoverTimer = null
let progressInterval = null

let suctionActive = false
let suctionTarget = new THREE.Vector3()
let suctionStrength = 0

const colorBase = new THREE.Color(0x4488ff)
const colorHot  = new THREE.Color(0xffffff)

const savedViews = {
  'Icosphere002': { position: new THREE.Vector3(-1.521607155584099e-7, 1.5911579051880829, 0.000001584823812675362), target: new THREE.Vector3(0,0,0) },
  'Icosphere005': { position: new THREE.Vector3(1.5083250087324505, 0.7278169163137288, -0.023204705793248764), target: new THREE.Vector3(0,0,0) },
  'Icosphere004': { position: new THREE.Vector3(0.48442436031750274, 0.7769615102373574, -1.5066618011892938), target: new THREE.Vector3(0,0,0) },
  'Icosphere003': { position: new THREE.Vector3(-1.3063868392351983, 0.7985289310137534, -0.8741114946214887), target: new THREE.Vector3(0,0,0) },
  'Icosphere001': { position: new THREE.Vector3(0.4522744012624762, 0.81994704739456, 1.4938208185234094), target: new THREE.Vector3(0,0,0) }
}

let hoveredNombre = null
let pendingProjectId = null

let ctx = null
let renderer = null
let scene = null
let camera = null
let composer = null
let controls = null

function setupScene() {
  // Escena
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  const godRaySource = new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16), new THREE.MeshBasicMaterial({ color: 0x2255ff }))
  godRaySource.visible = false
  scene.add(godRaySource)

  const godRaysEffect = new GodRaysEffect(camera, godRaySource, { density:0.96, decay:0.92, weight:0.1, exposure:0.2, samples:60, clampMax:1.0 })

  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new EffectPass(camera, new BloomEffect({ intensity:0.24, luminanceThreshold:0.2, luminanceSmoothing:0.7 })))
  composer.addPass(new EffectPass(camera, godRaysEffect))

  camera.position.z = 5
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableZoom = true
  controls.enablePan = false
}

let updateParticles = () => {}
let particles = null
let bautiParticlesRef = null
let bichosRef = null
let originalPositions = null
let framePositions = null
let distancesToSuction = null
let maxDist = 1
let transitionProgress = 0
let isTransitioning = false
let transitionDirection = 1
const modelCenter = new THREE.Vector3()
let sizes = null

const vertexShader = `
  attribute float aSize;
  varying vec3 vColor;
  varying float vDist;
  uniform float uPixelRatio;
  uniform float uBaseSize;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDist = -mvPosition.z;
    gl_PointSize = aSize * uBaseSize * uPixelRatio / vDist;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  varying float vDist;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    float alpha = 1.0 - smoothstep(0.25, 0.5, dist);
    float depthFade = 1.0 - smoothstep(1.0, 4.0, vDist);
    alpha *= depthFade * 0.25;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function buildFramePositions(count, targetPos) {
  const W = 1.6, H = 0.9
  const positions = new Float32Array(count * 3)
  const perSide = Math.floor(count / 4)
  for (let i = 0; i < count; i++) {
    let x, y
    const z = targetPos.z + 0.01
    const side = Math.floor(i / perSide)
    const t = (i % perSide) / perSide
    if (side === 0)      { x = -W/2 + t*W; y = H/2 }
    else if (side === 1) { x = -W/2 + t*W; y = -H/2 }
    else if (side === 2) { x = -W/2; y = -H/2 + t*H }
    else                 { x = W/2;  y = -H/2 + t*H }
    x += (Math.random()-0.5)*0.03
    y += (Math.random()-0.5)*0.03
    positions[i*3]   = x + targetPos.x
    positions[i*3+1] = y + targetPos.y
    positions[i*3+2] = z
  }
  return positions
}

function computeDistancesToTarget(target) {
  const count = originalPositions.length / 3
  const dists = new Float32Array(count)
  let max = 0
  for (let i = 0; i < count; i++) {
    const dx = originalPositions[i*3]   - target.x
    const dy = originalPositions[i*3+1] - target.y
    const dz = originalPositions[i*3+2] - target.z
    dists[i] = Math.sqrt(dx*dx + dy*dy + dz*dz)
    if (dists[i] > max) max = dists[i]
  }
  maxDist = max
  return dists
}

function startFrameTransition(direction) {
  transitionDirection = direction
  isTransitioning = true
  transitionProgress = direction === 1 ? 0 : 1
}

function startProgress(nombre) {
  const savedView = savedViews[nombre]
  if (savedView) {
    suctionTarget.copy(savedView.target)
    suctionActive = true
    suctionStrength = 0
    distancesToSuction = computeDistancesToTarget(savedView.target)
  }
  let elapsed = 0
  progressInterval = setInterval(() => {
    elapsed += 50
    suctionStrength = (elapsed / 3000) * 0.08
    if (elapsed >= 3000) {
      clearInterval(progressInterval)
      suctionActive = false; suctionStrength = 0
      launchTravel(nombre)
    }
  }, 50)
}

function cancelProgress() {
  clearInterval(progressInterval)
  suctionActive = false; suctionStrength = 0
  if (particles) {
    const col = particles.geometry.attributes.color?.array
    if (col) {
      for (let i = 0; i < col.length; i += 3) { col[i]=colorBase.r; col[i+1]=colorBase.g; col[i+2]=colorBase.b }
      particles.geometry.attributes.color.needsUpdate = true
    }
  }
}

function launchTravel(nombre) {
  if (isAnimating) return
  targetNombre = nombre
  const savedView = savedViews[nombre]
  targetPosition = savedView ? savedView.target.clone() : new THREE.Vector3(0,0,0)
  entryPoint = savedView ? savedView.position.clone() : targetPosition.clone().add(new THREE.Vector3(0,0,1.5))
  isAnimating = true; animPhase = 2; controls.enabled = false
}

function loadModels() {
  // Cargar flor
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  loader.load('/FLOR-1.glb', (gltf) => {
    window.__loaderDone?.('flor')
    const positions = []
    const SAMPLE = 20
    // KHR_mesh_quantization stores positions in a normalized range and applies
    // a node transform to recover real coords — apply it per vertex.
    gltf.scene.updateMatrixWorld(true)
    const _v = new THREE.Vector3()
    let florMinX = Infinity, florMaxX = -Infinity
    let florMinY = Infinity, florMaxY = -Infinity
    let florMinZ = Infinity, florMaxZ = -Infinity
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const pos = child.geometry.attributes.position
        for (let i = 0; i < pos.count; i += SAMPLE) {
          _v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld)
          positions.push(_v.x, _v.y, _v.z)
          if (_v.x < florMinX) florMinX = _v.x
          if (_v.x > florMaxX) florMaxX = _v.x
          if (_v.y < florMinY) florMinY = _v.y
          if (_v.y > florMaxY) florMaxY = _v.y
          if (_v.z < florMinZ) florMinZ = _v.z
          if (_v.z > florMaxZ) florMaxZ = _v.z
        }
      }
    })
    const florMaxDim = Math.max(florMaxX - florMinX, florMaxY - florMinY, florMaxZ - florMinZ)

    const loaderBauti = new GLTFLoader()
    loaderBauti.setMeshoptDecoder(MeshoptDecoder)
    loaderBauti.load('/bauti.glb', (gltfBauti) => {
      window.__loaderDone?.('bauti')
      const bautiPositions = []
      gltfBauti.scene.updateMatrixWorld(true)
      const _vb = new THREE.Vector3()
      gltfBauti.scene.traverse((child) => {
        if (child.isMesh) {
          const pos = child.geometry.attributes.position
          for (let i = 0; i < pos.count; i += 8) {
            _vb.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld)
            bautiPositions.push(_vb.x, _vb.y, _vb.z)
          }
        }
      })
      const bautiGeo = new THREE.BufferGeometry()
      const bautiVerts = new Float32Array(bautiPositions)
      bautiGeo.setAttribute('position', new THREE.BufferAttribute(bautiVerts, 3))
      const bautiColors = new Float32Array(bautiVerts.length)
      for (let i = 0; i < bautiColors.length; i += 3) { bautiColors[i]=colorBase.r; bautiColors[i+1]=colorBase.g; bautiColors[i+2]=colorBase.b }
      bautiGeo.setAttribute('color', new THREE.BufferAttribute(bautiColors, 3))
      const bautiSizes = new Float32Array(bautiVerts.length/3)
      for (let i = 0; i < bautiSizes.length; i++) bautiSizes[i] = 0.4+Math.random()*0.6
      bautiGeo.setAttribute('aSize', new THREE.BufferAttribute(bautiSizes, 1))
      const bautiMat = new THREE.ShaderMaterial({ vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ uPixelRatio:{value:renderer.getPixelRatio()}, uBaseSize:{value:30.0} }, vertexShader, fragmentShader })
      const bautiParticles = new THREE.Points(bautiGeo, bautiMat)
      bautiGeo.computeBoundingBox()
      const bautiCenter = new THREE.Vector3()
      bautiGeo.boundingBox.getCenter(bautiCenter)
      const bautiBoxSize = new THREE.Vector3()
      bautiGeo.boundingBox.getSize(bautiBoxSize)
      const bautiMaxDim = Math.max(bautiBoxSize.x, bautiBoxSize.y, bautiBoxSize.z)
      // Size bauti relative to FLOR so visuals are robust to source-GLB scale.
      // Tunable: BAUTI_SIZE_RATIO (~ how big bauti is vs flower), BAUTI_Y_OFFSET_RATIO (how far below center)
      const BAUTI_SIZE_RATIO = 0.80
      const BAUTI_Y_OFFSET_RATIO = 0.75
      const visualScale = (florMaxDim * BAUTI_SIZE_RATIO) / Math.max(bautiMaxDim, 0.0001)
      bautiParticles.position.sub(bautiCenter)
      bautiParticles.scale.set(visualScale, visualScale, visualScale)
      bautiParticles.position.y -= florMaxDim * BAUTI_Y_OFFSET_RATIO
      scene.add(bautiParticles)
      bautiParticlesRef = bautiParticles
    })

    const geometry = new THREE.BufferGeometry()
    const vertices = new Float32Array(positions)
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    const colors = new Float32Array(vertices.length)
    for (let i = 0; i < colors.length; i += 3) { colors[i]=colorBase.r; colors[i+1]=colorBase.g; colors[i+2]=colorBase.b }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    sizes = new Float32Array(vertices.length/3)
    for (let i = 0; i < sizes.length; i++) sizes[i] = 0.4+Math.random()*0.8
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const particleMaterial = new THREE.ShaderMaterial({ vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ uPixelRatio:{value:renderer.getPixelRatio()}, uBaseSize:{value:55.0} }, vertexShader, fragmentShader })
    particles = new THREE.Points(geometry, particleMaterial)
    geometry.computeBoundingBox()
    geometry.boundingBox.getCenter(modelCenter)
    particles.position.sub(modelCenter)
    const size = new THREE.Vector3()
    geometry.boundingBox.getSize(size)
    cameraStartZ = Math.max(size.x, size.y, size.z) * 1
    camera.position.z = cameraStartZ
    scene.add(particles)

    originalPositions = vertices.slice()
    framePositions = buildFramePositions(vertices.length/3, new THREE.Vector3(0,0,0))
    let time = 0

    const NUM_BICHOS = 80
    const bichosGeo = new THREE.BufferGeometry()
    const bichosPos = new Float32Array(NUM_BICHOS*3)
    const bichosVel = []
    for (let i = 0; i < NUM_BICHOS; i++) {
      const theta = Math.random()*Math.PI*2
      const phi = Math.random()*Math.PI
      const r = 0.8+Math.random()*1.2
      bichosPos[i*3]   = r*Math.sin(phi)*Math.cos(theta)
      bichosPos[i*3+1] = r*Math.sin(phi)*Math.sin(theta)
      bichosPos[i*3+2] = r*Math.cos(phi)
      bichosVel.push({ speed:0.003+Math.random()*0.008, radius:0.8+Math.random()*1.5, theta:Math.random()*Math.PI*2, phi:Math.random()*Math.PI, thetaV:(Math.random()-0.5)*0.015, phiV:(Math.random()-0.5)*0.008, offset:Math.random()*Math.PI*2 })
    }
    bichosGeo.setAttribute('position', new THREE.BufferAttribute(bichosPos, 3))
    const bichos = new THREE.Points(bichosGeo, new THREE.PointsMaterial({ color:0x4488ff, size:0.006, sizeAttenuation:true, transparent:true, opacity:0.5 }))
    scene.add(bichos)
    bichosRef = bichos

    updateParticles = () => {
      time += 0.005
      const pos = particles.geometry.attributes.position.array
      const col = particles.geometry.attributes.color.array

      if (isTransitioning) {
        transitionProgress += transitionDirection * 0.02
        transitionProgress = Math.max(0, Math.min(1, transitionProgress))
        for (let i = 0; i < pos.length; i += 3) {
          const t = transitionProgress
          pos[i]   = originalPositions[i]   *(1-t)+framePositions[i]   *t
          pos[i+1] = originalPositions[i+1] *(1-t)+framePositions[i+1] *t
          pos[i+2] = originalPositions[i+2] *(1-t)+framePositions[i+2] *t
        }
        if (transitionProgress <= 0 || transitionProgress >= 1) isTransitioning = false
      } else if (!state.isVideoMode) {
        const pulse = 1 + Math.sin(time) * 0.1
        for (let i = 0; i < pos.length; i += 3) {
          const idx = i/3
          let x = originalPositions[i]   *pulse + Math.sin(time+i*0.1)*0.005
          let y = originalPositions[i+1] *pulse + Math.cos(time+i*0.1)*0.005
          let z = originalPositions[i+2] *pulse + Math.sin(time+i*0.15)*0.005
          if (suctionActive && distancesToSuction) {
            const dx=suctionTarget.x-x, dy=suctionTarget.y-y, dz=suctionTarget.z-z
            const dist=Math.sqrt(dx*dx+dy*dy+dz*dz)
            const force=suctionStrength*(1/(dist+0.5))*3
            x+=dx*force; y+=dy*force; z+=dz*force
            const distNorm=distancesToSuction[idx]/maxDist
            const flicker=Math.sin(time*(8+suctionStrength*80)+idx*0.3-distNorm*2)*0.5+0.5
            const intensity=Math.max(0,flicker-distNorm*(1-suctionStrength*12))
            col[i]  =colorBase.r+(colorHot.r-colorBase.r)*intensity
            col[i+1]=colorBase.g+(colorHot.g-colorBase.g)*intensity
            col[i+2]=colorBase.b+(colorHot.b-colorBase.b)*intensity
            sizes[idx]=(0.4+Math.random()*0.1)*(1+intensity*1.2)
          } else {
            col[i]  +=(colorBase.r-col[i]  )*0.05
            col[i+1]+=(colorBase.g-col[i+1])*0.05
            col[i+2]+=(colorBase.b-col[i+2])*0.05
            sizes[idx]+=(0.4+Math.random()*0.4-sizes[idx])*0.05
          }
          pos[i]=x; pos[i+1]=y; pos[i+2]=z
        }
        particles.geometry.attributes.color.needsUpdate = true
        particles.geometry.attributes.aSize.needsUpdate = true
      }
      particles.geometry.attributes.position.needsUpdate = true

      const bp = bichos.geometry.attributes.position.array
      for (let i = 0; i < NUM_BICHOS; i++) {
        const b = bichosVel[i]
        b.theta += b.thetaV+Math.sin(time*b.speed+b.offset)*0.005
        b.phi   += b.phiV  +Math.cos(time*b.speed+b.offset)*0.003
        const r = b.radius+Math.sin(time*b.speed*2+b.offset)*0.1
        bp[i*3]  =r*Math.sin(b.phi)*Math.cos(b.theta)
        bp[i*3+1]=r*Math.sin(b.phi)*Math.sin(b.theta)
        bp[i*3+2]=r*Math.cos(b.phi)
      }
      bichos.geometry.attributes.position.needsUpdate = true
    }
  })

}

export class FlowerExperience extends Experience {
  init(context) {
    ctx = context
    renderer = ctx.renderer
    setupScene()
    loadModels()

    // G: save the current camera as the hovered project's view (authoring helper)
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'g' || e.key === 'G') && hoveredNombre) {
        savedViews[hoveredNombre] = { position: camera.position.clone(), target: controls.target.clone() }
        console.log(`✅ Vista guardada para ${hoveredNombre}:`, savedViews[hoveredNombre])
      }
    })
  }

  update() {
    updateParticles()
    if (isAnimating && targetPosition) {
      const savedView = savedViews[targetNombre]
      const savedTarget = savedView ? savedView.target : targetPosition
      if (animPhase === 1) {
        camera.position.lerp(entryPoint, 0.04)
        controls.target.lerp(savedTarget, 0.04)
      } else if (animPhase === 2) {
        camera.position.lerp(targetPosition, 0.05)
        controls.target.lerp(targetPosition, 0.05)
        if (camera.position.distanceTo(targetPosition) < 0.3) {
          isAnimating=false; animPhase=0
          framePositions=buildFramePositions(originalPositions.length/3, targetPosition)
          ctx.openProject(pendingProjectId)
          pendingProjectId = null
        }
      } else if (animPhase === 3) {
        const returnPos = new THREE.Vector3(0, 0, cameraStartZ)
        camera.position.lerp(returnPos, 0.04)
        controls.target.lerp(new THREE.Vector3(0,0,0), 0.04)
        if (camera.position.distanceTo(returnPos) < 0.1) { isAnimating=false; animPhase=0; controls.enabled=true }
      }
    }
    controls.update()
    composer.render()
  }

  resize(w, h) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    composer.setSize(w, h)
  }

  // Card click → suction + camera trip. Returns false if the trip can't start.
  selectProject(project) {
    if (isAnimating) return false

    const nombre = project?.flower?.icosphere
    if (!nombre) return false

    const savedView = savedViews[nombre]
    if (!savedView) return false

    cancelProgress()
    clearTimeout(hoverTimer)

    hoveredNombre = nombre
    pendingProjectId = project.id
    targetNombre = nombre

    entryPoint = savedView.position.clone()
    targetPosition = savedView.target.clone()

    isAnimating = true
    animPhase = 1
    controls.enabled = false

    hoverTimer = setTimeout(() => {
      if (hoveredNombre === nombre) {
        isAnimating = false
        animPhase = 0
        startProgress(nombre)
      }
    }, 1000)
    return true
  }

  // Overlays sit on top of the canvas: hide the flower and the body scan,
  // keep the ambient bichos drifting behind them.
  onOverlay(kind, open) {
    if (open) {
      if (particles) particles.visible = false
      if (bautiParticlesRef) bautiParticlesRef.visible = false
      if (bichosRef) bichosRef.visible = true
      if (kind === 'project') {
        // Camera glides back to the start position behind the project overlay
        isAnimating = true
        animPhase = 3
        targetPosition = new THREE.Vector3(0, 0, cameraStartZ)
        controls.enabled = false
      }
    } else {
      if (particles) particles.visible = true
      if (bautiParticlesRef) bautiParticlesRef.visible = true
      if (kind === 'project') {
        startFrameTransition(-1)
        controls.enabled = true
        hoveredNombre = null
      }
    }
  }
}
