import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer, RenderPass, BloomEffect, EffectPass, GodRaysEffect } from 'postprocessing'

// Estado
let isAnimating = false
let targetPosition = null
let targetNombre = null
let entryPoint = null
let animPhase = 0
let isVideoMode = false
let isInfoMode = false  // NUEVO: info overlay (about/vision/contact)
let cameraStartZ = 2
let isExiting = false

let hoverTimer = null
let progressInterval = null

let suctionActive = false
let suctionTarget = new THREE.Vector3()
let suctionStrength = 0

const tunnelExitParticles = []
const colorBase = new THREE.Color(0x4488ff)
const colorHot  = new THREE.Color(0xffffff)

const proyectos = {
  'Icosphere002': {
    nombre: 'SOMA',
    subtitulo: { es: 'Soporte Orgánico Material', en: 'Organic Material Support' },
    video: '/videos/SOMA.webm',
    año: '2025',
    cliente: { es: 'UTDT', en: 'UTDT' },
    tipo: { es: 'Proyecto de géstion cultural', en: 'Cultural project' },
    descripcion: {
      es: 'SOMA explora el umbral difuso entre el cuerpo y el objeto. Un asiento que recuerda la curva de una columna. Un anillo que enmarca una oreja. Un vaso que se amolda al agarre de una mano. Los objetos que nos rodean son moldes invisibles del cuerpo humano —y el cuerpo, a su vez, es moldeado por lo que toca. El proyecto reúne una colección heterogénea —joyería, indumentaria, mobiliario, piezas gráficas, publicaciones— que trabaja con la contraforma del cuerpo a diferentes escalas. Algunos objetos contienen al cuerpo físicamente; otros lo registran de manera simbólica, como un eco gráfico. De esta dualidad emerge una identidad de marca: una forma orgánica que envuelve una tipografía industrial, donde lo rígido y lo blando coexisten en una simbiosis adaptativa. El sistema se expande a la tercera dimensión mediante una estructura volumétrica itinerante: soportes de espuma de alta densidad donde los visitantes pueden apoyarse, descansar y dejar su impronta. Finalizada la exhibición, SOMA se transforma en una fiesta: el cuerpo ya no interactúa con la materia, sino con otros cuerpos. Todo es cuerpo.',
      en: 'SOMA explores the blurred threshold between body and object. A seat that remembers the curve of a spine. A ring that frames an ear. A glass that folds into the grip of a hand. The objects that surround us are invisible molds of the human body — and the body, in turn, is shaped by what it touches. The project assembles a heterogeneous collection — jewelry, garments, furniture, graphic pieces, publications — all working with the counterform of the body at different scales. Some objects contain the body physically; others register it symbolically, as a graphic echo. From this duality, a brand identity emerges: an organic form wrapping industrial type, rigid and soft coexisting in adaptive symbiosis. The system extends into three dimensions through an itinerant volumetric structure — high-density foam supports where visitors can lean, rest, and leave their imprint. After the exhibition, SOMA becomes a fiesta: the body no longer interacting with matter, but with other bodies. Everything is body.'
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/soma/', frames: 48 },
    volumen: 0.2,
    autores: 'Bautista Ausqui'
  },
  'Icosphere005': {
    nombre: 'ARENA', youtube: 'D3SsaiTpvl8',
    año: '2026', ARENA: 'CO-FOUNDER',
    tipo: { es: 'Urbanismo', en: 'Urbanism' },
    descripcion: {
      es: 'La plataforma para construir la próxima generación de ciudades. Arena se compone de dos motores: A: un motor que cruza datos institucionales de la gestión de la ciudad como licitaciones, presupuestos y obras en tiempo real. B: y un motor que mide la experiencia viva de sus habitantes como los conflictos, las necesidades y los deseos de los habitantes de la ciudad. Arena contrasta ambas informaciones y ofrece insights sobre el estado real de las ciudades.',
      en: 'The platform to build the next generation of cities. Arena is composed of two engines: A: an engine that cross-references institutional data from city management — tenders, budgets and works in real time. B: an engine that measures the lived experience of its inhabitants — conflicts, needs and desires. Arena contrasts both data layers and surfaces insights about the real state of cities.'
    },
    descripcionFull: null, visitLink: 'https://www.arena.actor/', volumen: 0.5, autores: 'Bautista Ausqui'
  },
  'Icosphere004': {
    nombre: 'PAPOTA', video: '/videos/papotta.webm',
    año: '2025', cliente: 'MARCA BLANCA', tipo: 'WEB',
    descripcion: {
      es: 'PAPOTA es el sitio web del EP de Ca7riel & Paco Amoroso — un disco que canaliza su energía caótica en una mezcla de trap latino, jazz, funk y ritmos tropicales. El título, argot argentino para el cóctel de proteínas y pastillas que usan los que van al gimnasio para crecer rápido, alude a su propio ascenso veloz mientras pliega la autocrítica en un humor irreverente. El sitio desarrolla una experiencia 3D inmersiva con Three.js, con versiones infladas como globos del dúo flotando por el cielo — traduciendo la absurdidad lúdica del EP en un espacio digital interactivo.',
      en: "PAPOTA is the website for Ca7riel & Paco Amoroso's EP — a record that channels their chaotic energy through a mix of Latin trap, jazz, funk and tropical rhythms. The title, Argentine slang for the protein-and-pills cocktail gym-goers use to grow fast, alludes to the duo's own meteoric rise while folding self-critique into irreverent humor. The site develops an immersive 3D experience with Three.js — balloon-inflated versions of the duo floating across the sky, translating the EP's playful absurdity into an interactive digital space."
    },
    manual: { carpeta: '/pdf/papota/', frames: 8 },
    descripcionFull: null, videoFit: 'contain', volumen: 0.5, autores: 'Bautista Ausqui'
   
  },
  'Icosphere003': {
    nombre: 'DUALIDAD', video: '/videos/PortfolioVideo.webm',
    año: '2024', cliente: 'Universidad Torcuato DiTella',
    tipo: { es: 'Experiencia Inmersiva', en: 'Immersive Experience' },
    descripcion: {
      es: 'Tensión y Transformación: Instalación Inmersiva 360° Dos entidades que conviven en un espacio digital en constante transformación. Lo físico y lo aurático en tensión, generando formas que trascienden sus orígenes. Bajo esta premisa, se desarrolló un proyecto inmersivo para un formato medialab (proyección a 4 paredes). El trabajo incluyó el diseño integral de la planta de luces y la creación de todo el contenido de video, modelado en Blender y animado y postproducido en After Effects, envolviendo al espectador en una atmósfera de constante mutación.',
      en: 'Tension and Transformation: 360° Immersive Installation "Two entities coexisting in a constantly transforming digital space. The physical and the auratic in tension, generating forms that transcend their origins." Under this premise, an immersive project was developed for a medialab format (4-wall projection). The work included the comprehensive design of the lighting plot and the creation of all video content—modeled in Blender, then animated and post-produced in After Effects—enveloping the viewer in an atmosphere of constant mutation.'
    },
    descripcionFull: {
      es: 'Este proyecto explora la dinámica de lo dual y lo mutante: dos entidades que conviven en un espacio digital en constante transformación. Sus lenguajes gráficos opuestos generan un clima de mutación, transformación y creación única, manifestando lo evolutivo y sus formas de interacción con los espacios y los diferentes niveles de conciencia. Estas entidades encarnan dos naturalezas esenciales: una vinculada al plano físico, al material y lo palpable, y otra que representa lo aurático, lo intangible y lo espiritual. A través de sus encuentros, conflictos y conexiones, emergen formas y significados que trascienden sus orígenes. Esta coexistencia tensa pero complementaria transforma el espacio que habitan, generando nuevas posibilidades de ser y de existir.',
      en: 'This project explores the dynamics of the dual and the mutant: two entities that coexist in a digital space in constant transformation. Their opposing graphic languages generate a climate of mutation, transformation and unique creation, expressing the evolutionary and its forms of interaction with spaces and different levels of consciousness. These entities embody two essential natures: one linked to the physical plane, the material and the tangible, and another that represents the auratic, the intangible and the spiritual. Through their encounters, conflicts and connections, forms and meanings emerge that transcend their origins. This tense but complementary coexistence transforms the space they inhabit, generating new possibilities of being and existing.'
    },
    manual: { carpeta: '/pdf/immersive/', frames: 16 },
    volumen: 0.5, autores: 'Bautista Ausqui'
  },
  'Icosphere001': {
    nombre: 'GHOST PERROS', video: '/videos/ghost.webm',
    año: '2026',
    cliente: { es: 'Personal', en: 'Personal' },
    tipo: { es: 'Audiovisual', en: 'Audiovisual' },
    descripcion: {
      es: 'Diseño Espacial y Operación Sincrónica (Luces y Visuales) Desarrollo integral de la puesta escénica, abarcando desde la concepción espacial y el montaje inicial (momento cero) hasta la operación en vivo. El diseño central consistió en un sistema de video mapping proyectado sobre la infraestructura del lugar para generar la ilusión óptica de un cubo flotando en el espacio. Durante el espectáculo, se ejecutó el control simultáneo y sincronizado de la parrilla lumínica vía DMX y el sistema de visuales a través de TouchDesigner y Resolume Arena, logrando una integración total entre el espacio físico y el medio digital.',
      en: 'Spatial Design and Synchronous Operation (Lighting and Visuals) Comprehensive development of the stage production, spanning from spatial conception and the initial setup (from the ground up) to the live operation. The core design consisted of a video mapping system projected onto the venues infrastructure to generate the optical illusion of a cube floating in space. During the performance, simultaneous and synchronized control of the lighting rig via DMX and the visual system via TouchDesigner and Resolume Arena was executed, achieving total integration between the physical space and the digital medium.'
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/ghost/', frames: 7 },
    volumen: 0.5,
    autores: 'Bautista Ausqui'
  },
}

const proyectosExtra = {
  'MUTANTE': {
    nombre: 'MUTANTE', video: '/videos/mutante.webm', año: '2025',
    cliente: { es: 'Interactivo', en: 'Interactive' },
    tipo: { es: 'Audiovisual', en: 'Audiovisual' },
    descripcion: {
      es: 'La escena explora la mutación como reflejo cultural: un entramado de ideas, prejuicios, horrores y fascinaciones que proyectamos sobre lo vivo. Al ingresar en una esfera panorámica de 360°, el visitante recorre un paisaje textual donde mitos, ficciones y artefactos —quimeras, xenotrasplantes, CRISPR, cyborgs— se condensan en tres focos simultáneos: bestiario, control y post-especie. Criaturas híbridas, pulsiones de dominio y futuros transhumanos se enlazan en una narrativa jerárquica que, al desplazarse horizontalmente, transforma la lectura en un viaje inmersivo.',
      en: 'The scene explores mutation as a cultural mirror: a weave of ideas, prejudices, horrors and fascinations we project onto the living. Entering a 360° panoramic sphere, the visitor walks through a textual landscape where myths, fictions and artifacts — chimeras, xenotransplants, CRISPR, cyborgs — condense into three simultaneous foci: bestiary, control and post-species. Hybrid creatures, drives of dominion and transhuman futures are linked in a hierarchical narrative that, scrolling horizontally, turns reading into an immersive journey.'
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/molly/', frames: 37 },
    volumen: 0.5, autores: 'Bautista Ausqui'
  },
  'POSEIDO': {
    nombre: 'POSEIDO', youtube: 'Rm1ZafN1opc', año: '2025',
    cliente: { es: 'Personal', en: 'Personal' },
    tipo: { es: 'Audiovisual', en: 'Audiovisual' },
    descripcion: {
      es: 'Identidad Visual y Arte Generativo para Lanzamiento Discográfico. Dirección de arte y desarrollo visual integral estructurado en torno al concepto musical del artista. El proyecto abarcó desde el diseño de la identidad gráfica (tipografía y arte de tapa) hasta la creación de los visualizers oficiales. Para capturar la energía de la pista, el entorno visual fue generado y operado de manera audio-reactiva en tiempo real utilizando Resolume Arena, pasando luego por una etapa de postproducción y refinamiento en Premiere Pro.',
      en: "Visual Identity and Generative Art for Album Release. Art direction and comprehensive visual development structured around the artist's musical concept. The project spanned from the design of the graphic identity (typography and cover art) to the creation of the official visualizers. To capture the track's energy, the visual environment was generated and operated audio-reactively in real time using Resolume Arena, followed by a post-production and refinement stage in Premiere Pro."
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/poseido/', frames: 8 },
    volumen: 0.5, autores: 'Bautista Ausqui'
  },
  'TAHADIS': {
    nombre: 'TAHADIS', video360: 'https://pub-a7045e01a924422c85679d03511d9cc3.r2.dev/TAHADIS.webm', youtubeLink: 'https://www.youtube.com/watch?v=SRQN3ccOqA0', año: '2024',
    cliente: { es: 'Personal', en: 'Personal' },
    tipo: 'VR 360',
    descripcion: {
      es: 'Microuniversos en VR: Exploración Procedural. Un sistema molecular llevado a escala macro. Se diseñó una experiencia inmersiva para Realidad Virtual (VR) desarrollada íntegramente en Blender. Mediante el uso avanzado de Geometry Nodes, se generaron entornos y comportamientos procedurales complejos, permitiendo que las estructuras orgánicas evolucionen y reaccionen dentro del espacio digital.',
      en: 'VR Microuniverses: Procedural Exploration. A molecular system brought to a macro scale. An immersive Virtual Reality (VR) experience designed and developed entirely in Blender. Through the advanced use of Geometry Nodes, complex procedural environments and behaviors were generated, allowing organic structures to evolve and react within the digital space.'
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/tahadis/', frames: 23 },
    volumen: 0.5, autores: 'Bautista Ausqui'
  },
  'TIEMPO REAL': {
    nombre: 'TIEMPO REAL', video: '/videos/tiempo_real.webm', año: '2024 - 2026',
    cliente: { es: 'Personal', en: 'Personal' },
    tipo: { es: 'Audiovisual', en: 'Audiovisual' },
    descripcion: { es: 'Diseño escenico integral entendiendo que el escenario no es un conjunto de pantallas, sino un sistema vivo. Durante los últimos años, he desarrollado y operado experiencias visuales y lumínicas donde la tecnología se pone al servicio de la narrativa del artista. A través de la generación procedimental en TouchDesigner y la operación en vivo con Resolume Arena, construyo atmósferas inmersivas que escapan del formato de video tradicional. Cada proyecto integra mapping arquitectónico y control de iluminación vía DMX para que luz, píxel y espacio funcionen como un solo cuerpo en tiempo real, adaptándose orgánicamente a cada soporte y momento del espectáculo.', en: 'Comprehensive Stage Design. Understanding the stage not as a mere collection of screens, but as a living system. Over the past few years, I have developed and operated visual and lighting experiences where technology serves the artists narrative. Through procedural generation in TouchDesigner and live operation via Resolume Arena, I build immersive atmospheres that break away from traditional video formats. Each project integrates architectural mapping and DMX lighting control, allowing light, pixel, and space to function as a single entity in real time—adapting organically to every medium and moment of the performance.' },
    descripcionFull: null,
    manual: { carpeta: '/pdf/tiempo_real/', frames: 8 },
    volumen: 0.5, autores: 'Bautista Ausqui'
  }
}

// ── i18n helper for project data ─────────────────────
function getLang() {
  return (typeof window !== 'undefined' && window.getLang) ? window.getLang() : 'es'
}
function tr(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  const lang = getLang()
  return val[lang] ?? val.es ?? val.en ?? ''
}
const I18N = {
  readMore:    { es: 'LEER MÁS',  en: 'READ MORE' },
  readLess:    { es: 'LEER MENOS', en: 'READ LESS' },
  loading:     { es: 'CARGANDO MANUAL...', en: 'LOADING MANUAL...' },
  drag360:     { es: '↻ ARRASTRÁ PARA EXPLORAR', en: '↻ DRAG TO LOOK AROUND' },
  soundOn:     { es: '● ACTIVAR SONIDO', en: '● ENABLE SOUND' },
  soundOff:    { es: '● SILENCIAR',      en: '● MUTE' }
}

// Track currently audible video element so the sound-toggle controls the right one
let currentPlayingVideo = null
let currentYouTube = null    // YouTube iframe (when active)
let ytMuted = true           // tracked separately since iframe state isn't readable

function refreshSoundToggle() {
  const btn = document.getElementById('sound-toggle')
  if (!btn) return
  let muted
  if (currentYouTube) {
    muted = ytMuted
  } else {
    muted = !currentPlayingVideo || currentPlayingVideo.muted
  }
  btn.textContent = muted ? tr(I18N.soundOn) : tr(I18N.soundOff)
  btn.classList.toggle('is-on', !muted)
}

function ytPostMessage(iframe, func, args) {
  if (!iframe || !iframe.contentWindow) return
  iframe.contentWindow.postMessage(JSON.stringify({
    event: 'command',
    func: func,
    args: args || []
  }), '*')
}

function getProyectoData(icosphereKey, nombreCustom) {
  if (nombreCustom && proyectosExtra[nombreCustom]) return proyectosExtra[nombreCustom]
  return proyectos[icosphereKey]
}

const savedViews = {
  'Icosphere002': { position: new THREE.Vector3(-1.521607155584099e-7, 1.5911579051880829, 0.000001584823812675362), target: new THREE.Vector3(0,0,0) },
  'Icosphere005': { position: new THREE.Vector3(1.5083250087324505, 0.7278169163137288, -0.023204705793248764), target: new THREE.Vector3(0,0,0) },
  'Icosphere004': { position: new THREE.Vector3(0.48442436031750274, 0.7769615102373574, -1.5066618011892938), target: new THREE.Vector3(0,0,0) },
  'Icosphere003': { position: new THREE.Vector3(-1.3063868392351983, 0.7985289310137534, -0.8741114946214887), target: new THREE.Vector3(0,0,0) },
  'Icosphere001': { position: new THREE.Vector3(0.4522744012624762, 0.81994704739456, 1.4938208185234094), target: new THREE.Vector3(0,0,0) }
}

let hoveredNombre = null

// Escena
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(0x050505, 1)
document.body.appendChild(renderer.domElement)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
scene.add(ambientLight)

const godRaySource = new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16), new THREE.MeshBasicMaterial({ color: 0x2255ff }))
godRaySource.visible = false
scene.add(godRaySource)

const godRaysEffect = new GodRaysEffect(camera, godRaySource, { density:0.96, decay:0.92, weight:0.1, exposure:0.2, samples:60, clampMax:1.0 })

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new EffectPass(camera, new BloomEffect({ intensity:0.24, luminanceThreshold:0.2, luminanceSmoothing:0.7 })))
composer.addPass(new EffectPass(camera, godRaysEffect))

camera.position.z = 5
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableZoom = true
controls.enablePan = false

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

function spawnTunnelExitParticles() {
  for (let i = 0; i < 150; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 3 + Math.random() * 7
    tunnelExitParticles.push({
      x: window.innerWidth/2, y: window.innerHeight/2,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      size: 3+Math.random()*5, alpha: 0.8+Math.random()*0.2,
      decay: 0.006+Math.random()*0.012,
      r: Math.random()>0.5?68:150, g: Math.random()>0.5?136:180, b:255
    })
  }
}

function showVideo(nombreIcosphere, nombreCustom) {
  isVideoMode = true
  document.body.classList.add('is-video')
  updateMusic()
  const proyecto = getProyectoData(nombreIcosphere, nombreCustom)
  const overlay = document.getElementById('video-overlay')
  const videoEl = document.getElementById('video-player')
  const expandBtn = document.getElementById('abstract-expand')
  const fullDesc = document.getElementById('abstract-descripcion-full')
  const shortDesc = document.getElementById('abstract-descripcion')
  const sectionPdf = document.getElementById('section-pdf')

  const scrollContainer = document.getElementById('video-scroll-container')
  if (scrollContainer) scrollContainer.scrollTop = 0

  if (sectionPdf) sectionPdf.style.display = 'none'
  const container = document.getElementById('pdf-container')
  if (container) container.innerHTML = ''
  const sectionEmbed = document.getElementById('section-embed')
  if (sectionEmbed) sectionEmbed.style.display = 'none'
  const embedContainer = document.getElementById('embed-container')
  if (embedContainer) embedContainer.innerHTML = ''

  if (fullDesc) fullDesc.style.display = 'none'
  if (shortDesc) shortDesc.style.display = 'block'
  if (expandBtn) {
    expandBtn.textContent = tr(I18N.readMore)
    expandBtn.style.display = proyecto?.descripcionFull ? 'inline-block' : 'none'
  }

  // Open-in-YouTube button — only visible for projects that declare a youtubeLink
  const ytBtn = document.getElementById('open-youtube')
  if (ytBtn) {
    if (proyecto?.youtubeLink) {
      ytBtn.href = proyecto.youtubeLink
      ytBtn.classList.add('is-visible')
    } else {
      ytBtn.removeAttribute('href')
      ytBtn.classList.remove('is-visible')
    }
  }

  // Visit-the-site button — only visible for projects that declare a visitLink
  const siteBtn = document.getElementById('open-site')
  if (siteBtn) {
    if (proyecto?.visitLink) {
      siteBtn.href = proyecto.visitLink
      siteBtn.classList.add('is-visible')
    } else {
      siteBtn.removeAttribute('href')
      siteBtn.classList.remove('is-visible')
    }
  }

  document.getElementById('abstract-titulo').textContent = proyecto?.nombre || nombreIcosphere
  const subtituloEl = document.getElementById('abstract-subtitulo')
  if (subtituloEl) {
    const sub = tr(proyecto?.subtitulo)
    subtituloEl.textContent = sub
    subtituloEl.style.display = sub ? 'block' : 'none'
  }
  document.getElementById('abstract-meta').textContent = `${proyecto?.año||''} / ${tr(proyecto?.cliente)} / ${tr(proyecto?.tipo)}`
  if (shortDesc) shortDesc.textContent = tr(proyecto?.descripcion)
  if (fullDesc) fullDesc.textContent = tr(proyecto?.descripcionFull)
  document.getElementById('abstract-autores').textContent = proyecto?.autores || ''

  // Remember which project is on screen so we can re-render on lang change
  currentProyectoKey = nombreIcosphere
  currentProyectoCustom = nombreCustom || null

  const manualBtn = document.getElementById('abstract-manual')
  if (manualBtn) manualBtn.style.display = 'none'

  if (particles) particles.visible = false
  if (bautiParticlesRef) bautiParticlesRef.visible = false
  if (bichosRef) bichosRef.visible = true
  document.querySelector('nav')?.style.setProperty('display', 'none')
  document.querySelector('.logo-container')?.style.setProperty('display', 'none')
  document.querySelector('.logo-subtitle')?.style.setProperty('display', 'none')
  document.querySelector('.proyectos-grid')?.style.setProperty('display', 'none')

  const videoWrapper = document.getElementById('video-wrapper')
  document.getElementById('youtube-player')?.remove()
  destroy360Viewer()

  if (proyecto?.video360) {
    videoEl.style.display = 'none'
    videoEl.src = ''
    document.getElementById('volume-control')?.style.removeProperty('display')
    document.getElementById('timeline-control')?.classList.add('hidden')
    init360Viewer(proyecto.video360, proyecto?.volumen)
  } else if (proyecto?.youtube) {
    // YouTube embed — uses iframe API for mute/unmute control
    videoEl.style.display = 'none'
    videoEl.src = ''
    document.getElementById('volume-control')?.style.setProperty('display', 'none')

    const ytId = proyecto.youtube
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: ytId,
      controls: '0',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
      enablejsapi: '1',
      hd: '1',
      vq: 'hd2160',
      origin: window.location.origin
    })
    const iframe = document.createElement('iframe')
    iframe.id = 'youtube-player'
    iframe.src = `https://www.youtube.com/embed/${ytId}?${params.toString()}`
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
    iframe.setAttribute('allowfullscreen', '')
    iframe.style.cssText = 'width:100%;aspect-ratio:16/9;border:0;display:block;background:#000;'
    videoWrapper.appendChild(iframe)

    // Once the player is ready, ask it for the highest available quality.
    // YouTube quietly ignores some of these on small viewports, but the
    // attempt costs nothing and helps when bandwidth is good.
    iframe.addEventListener('load', () => {
      const askForQuality = () => {
        const tries = ['hd2160', 'hd1440', 'hd1080', 'hd720']
        tries.forEach(q => ytPostMessage(iframe, 'setPlaybackQuality', [q]))
        ytPostMessage(iframe, 'setPlaybackQualityRange', ['hd1080', 'hd2160'])
      }
      // YouTube needs a moment to wire its message bus
      setTimeout(askForQuality, 600)
      setTimeout(askForQuality, 2000)
    })

    document.getElementById('timeline-control')?.classList.add('hidden')

    currentPlayingVideo = null
    currentYouTube = iframe
    ytMuted = true
    refreshSoundToggle()
  } else {
    videoEl.style.display = ''
    document.getElementById('volume-control')?.style.removeProperty('display')
    document.getElementById('timeline-control')?.classList.remove('hidden')
    videoEl.style.objectFit = proyecto?.videoFit || 'cover'
    videoEl.src = proyecto?.video || ''
    videoEl.loop = true
    const vol = typeof proyecto?.volumen === 'number' ? proyecto.volumen : 0.5
    videoEl.volume = vol
    videoEl.muted = true   // start silent — user enables sound
    videoEl.load()
    videoEl.play().catch(() => {})
    setVolume(vol)
    currentPlayingVideo = videoEl
    currentYouTube = null
    refreshSoundToggle()
    updateTimelineUI()
  }

  overlay.classList.add('visible')

  if (proyecto?.manual) loadManual(proyecto.manual, proyecto.nombre)
  if (proyecto?.embed) loadEmbed(proyecto.embed, proyecto.nombre)

  isAnimating = true
  animPhase = 3
  targetPosition = new THREE.Vector3(0, 0, cameraStartZ)
  controls.enabled = false
}

function hideVideo() {
  if (isExiting) return
  isExiting = true

  const overlay = document.getElementById('video-overlay')
  const videoEl = document.getElementById('video-player')
  const sectionPdf = document.getElementById('section-pdf')

  overlay.style.transition = 'opacity 0.6s ease'
  overlay.style.opacity = '0'
  spawnTunnelExitParticles()

  setTimeout(() => {
    overlay.classList.remove('visible')
    overlay.style.opacity = ''
    overlay.style.transition = ''
    videoEl.pause()
    videoEl.src = ''
    videoEl.style.display = ''
    document.getElementById('youtube-player')?.remove()
    destroy360Viewer()
    document.getElementById('volume-control')?.style.removeProperty('display')
    if (sectionPdf) sectionPdf.style.display = 'none'
    const container = document.getElementById('pdf-container')
    if (container) container.innerHTML = ''
    const sectionEmbed = document.getElementById('section-embed')
    if (sectionEmbed) sectionEmbed.style.display = 'none'
    const embedContainer = document.getElementById('embed-container')
    if (embedContainer) embedContainer.innerHTML = ''
    isVideoMode = false
    isExiting = false
    currentProyectoKey = null
    currentProyectoCustom = null
    currentPlayingVideo = null
    currentYouTube = null
    ytMuted = true
    document.body.classList.remove('is-video')
    document.getElementById('open-youtube')?.classList.remove('is-visible')
    document.getElementById('open-site')?.classList.remove('is-visible')
    refreshSoundToggle()
    updateMusic()
    if (particles) particles.visible = true
    if (bautiParticlesRef) bautiParticlesRef.visible = true
    document.querySelector('nav')?.style.removeProperty('display')
    document.querySelector('.logo-container')?.style.removeProperty('display')
    document.querySelector('.logo-subtitle')?.style.removeProperty('display')
    document.querySelector('.proyectos-grid')?.style.removeProperty('display')
    startFrameTransition(-1)
    controls.enabled = true
    hoveredNombre = null
  }, 800)
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

let pendingNombreCustom = null
let currentProyectoKey = null
let currentProyectoCustom = null

// ── BACKGROUND MUSIC state ────────────────────────────
let musicEnabled = false
let currentInfoTarget = null  // 'about' | 'vision' | 'contact' | null
function shouldPlayMusic() {
  if (!musicEnabled) return false
  if (isVideoMode) return false
  return true   // Home + every info section (About / Vision / Contact)
}
// Smooth volume fade so play/pause transitions don't click or stutter
let musicFadeRaf = null
let musicTargetVol = 0.4
function fadeMusic(targetVol, duration, done) {
  cancelAnimationFrame(musicFadeRaf)
  const bgMusic = document.getElementById('bg-music')
  if (!bgMusic) return
  const startVol = bgMusic.volume
  const startTime = performance.now()
  const tick = () => {
    const t = Math.min(1, (performance.now() - startTime) / duration)
    bgMusic.volume = startVol + (targetVol - startVol) * t
    if (t < 1) {
      musicFadeRaf = requestAnimationFrame(tick)
    } else if (done) {
      done()
    }
  }
  tick()
}

function updateMusic() {
  const bgMusic = document.getElementById('bg-music')
  if (!bgMusic) return
  if (shouldPlayMusic()) {
    if (bgMusic.paused) {
      bgMusic.volume = 0
      bgMusic.play().catch(() => {})
    }
    fadeMusic(musicTargetVol, 350)
  } else {
    fadeMusic(0, 250, () => { try { bgMusic.pause() } catch (e) {} })
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

// Cargar flor
const loader = new GLTFLoader()
loader.load('/FLOR-1.glb', (gltf) => {
  window.__loaderDone?.('flor')
  const positions = []
  const SAMPLE = 20
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      const pos = child.geometry.attributes.position
      for (let i = 0; i < pos.count; i += SAMPLE) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    }
  })

  const loaderBauti = new GLTFLoader()
  loaderBauti.load('/bauti.glb', (gltfBauti) => {
    window.__loaderDone?.('bauti')
    const bautiPositions = []
    gltfBauti.scene.traverse((child) => {
      if (child.isMesh) {
        const pos = child.geometry.attributes.position
        for (let i = 0; i < pos.count; i += 8) bautiPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
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
    bautiParticles.position.sub(bautiCenter)
    bautiParticles.scale.set(2,2,2)
    bautiParticles.position.y -= 1.3
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
    } else if (!isVideoMode) {
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

// Helper unificado: arranca el viaje a un proyecto
function iniciarProyecto(nombre, nombreCustom, conAnimacionCompleta = true) {
  if (isAnimating || isVideoMode || isInfoMode) return
  if (hoveredNombre === nombre && conAnimacionCompleta === false) return // ya está en hover

  cancelProgress()
  clearTimeout(hoverTimer)
  hoveredNombre = nombre
  pendingNombreCustom = nombreCustom

  const savedView = savedViews[nombre]
  if (!savedView) return

  entryPoint = savedView.position.clone()
  targetPosition = savedView.target.clone()
  targetNombre = nombre
  isAnimating = true
  animPhase = 1
  controls.enabled = false

  // Click → animación más rápida (400ms en vez de 1000ms al hover)
  // Hover → comportamiento original (1000ms)
  const delay = conAnimacionCompleta ? 400 : 1000

  hoverTimer = setTimeout(() => {
    if (hoveredNombre === nombre) {
      isAnimating = false
      animPhase = 0
      startProgress(nombre)
    }
  }, delay)
}

// ── PROJECT CARDS — hover plays preview, click starts trip ──────────
document.querySelectorAll('.proyecto-card').forEach((card) => {
  const previewVideo = card.querySelector('.card-preview')
  const videoSrc = card.dataset.video

  // HOVER → load + play preview (or show static poster if no video)
  card.addEventListener('mouseenter', () => {
    if (isVideoMode || isInfoMode) return
    const poster = card.dataset.poster
    if (previewVideo && poster && !previewVideo.poster) {
      previewVideo.poster = poster
    }
    if (previewVideo && videoSrc && !previewVideo.src) {
      previewVideo.src = videoSrc
    }
    if (previewVideo && videoSrc) {
      const startAt = parseFloat(card.dataset.previewStart || '0')
      const seek = () => { try { previewVideo.currentTime = startAt } catch (e) {} }
      if (previewVideo.readyState >= 1) seek()
      else previewVideo.addEventListener('loadedmetadata', seek, { once: true })
      previewVideo.play().catch(() => {})
    }
    card.classList.add('is-hovering')
  })

  card.addEventListener('mouseleave', () => {
    if (previewVideo) {
      previewVideo.pause()
    }
    card.classList.remove('is-hovering')
  })

  // CLICK → start the trip with full animation
  card.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (isAnimating || isVideoMode || isInfoMode) return

    const nombre = card.dataset.nombre
    const nombreCustom = card.dataset.custom
    if (!nombre) return

    const savedView = savedViews[nombre]
    if (!savedView) return

    // Stop preview before starting trip
    if (previewVideo) previewVideo.pause()
    card.classList.remove('is-hovering')

    cancelProgress()
    clearTimeout(hoverTimer)

    hoveredNombre = nombre
    pendingNombreCustom = nombreCustom
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
  })
})
// Scroll video overlay: cerrar al fondo
const scrollContainer = document.getElementById('video-scroll-container')
if (scrollContainer) {
  let bottomWheelAccum = 0
  let bottomTimer = null
  scrollContainer.addEventListener('wheel', (e) => {
    if (!isVideoMode || isExiting) return
    if (e.deltaY <= 0) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer
    const atBottom = scrollTop + clientHeight >= scrollHeight - 3
    if (atBottom) {
      bottomWheelAccum += e.deltaY
      clearTimeout(bottomTimer)
      bottomTimer = setTimeout(() => { bottomWheelAccum = 0 }, 600)
      if (bottomWheelAccum > 180) { bottomWheelAccum = 0; hideVideo() }
    } else { bottomWheelAccum = 0 }
  }, { passive: true })
}

// ── INFO OVERLAY (About/Vision/Contact) ─────────────
function showInfo(target) {
  if (isVideoMode) return

  // Already inside info overlay — just scroll to the requested section
  if (isInfoMode) {
    const scrollEl = document.getElementById('info-scroll-container')
    if (scrollEl) {
      if (target === 'about') {
        scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (target === 'vision') {
        document.getElementById('info-vision')?.scrollIntoView({ behavior: 'smooth' })
      } else if (target === 'contact') {
        document.getElementById('info-contact')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    currentInfoTarget = target
    updateMusic()
    return
  }

  isInfoMode = true
  currentInfoTarget = target
  updateMusic()

  const overlay = document.getElementById('info-overlay')
  const scrollEl = document.getElementById('info-scroll-container')

  // Ocultar home UI
  document.querySelector('.logo-container')?.style.setProperty('display', 'none')
  document.querySelector('.logo-subtitle')?.style.setProperty('display', 'none')
  document.querySelector('.proyectos-grid')?.style.setProperty('display', 'none')
  if (particles) particles.visible = false
  if (bautiParticlesRef) bautiParticlesRef.visible = false
  if (bichosRef) bichosRef.visible = true

  overlay.classList.add('visible')
  document.body.classList.add('info-active')

  // Scroll a la sección correspondiente
  setTimeout(() => {
    if (scrollEl) {
      if (target === 'about') scrollEl.scrollTop = 0
      else if (target === 'vision') {
        const el = document.getElementById('info-vision')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }
      else if (target === 'contact') {
        const el = document.getElementById('info-contact')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, 50)
}

function hideInfo() {
  if (!isInfoMode) return
  const overlay = document.getElementById('info-overlay')
  overlay.classList.remove('visible')
  document.body.classList.remove('info-active')
  isInfoMode = false
  currentInfoTarget = null
  updateMusic()

  // Mostrar home
  setTimeout(() => {
    document.querySelector('.logo-container')?.style.removeProperty('display')
    document.querySelector('.logo-subtitle')?.style.removeProperty('display')
    document.querySelector('.proyectos-grid')?.style.removeProperty('display')
    if (particles) particles.visible = true
    if (bautiParticlesRef) bautiParticlesRef.visible = true
  }, 400)
}

// Nav — click abre overlay o va al home
document.querySelectorAll('nav a[data-overlay]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    const target = link.dataset.overlay
    if (target === 'home') {
      hideInfo()
      if (isVideoMode && !isExiting) hideVideo()
    } else {
      if (isVideoMode && !isExiting) hideVideo()
      showInfo(target)
    }
  })
})

// Scroll arriba del info overlay cierra
const infoScroll = document.getElementById('info-scroll-container')
if (infoScroll) {
  let topWheelAccum = 0
  let topTimer = null
  infoScroll.addEventListener('wheel', (e) => {
    if (!isInfoMode) return
    if (infoScroll.scrollTop <= 2 && e.deltaY < 0) {
      topWheelAccum += Math.abs(e.deltaY)
      clearTimeout(topTimer)
      topTimer = setTimeout(() => { topWheelAccum = 0 }, 600)
      if (topWheelAccum > 180) { topWheelAccum = 0; hideInfo() }
    } else { topWheelAccum = 0 }
  }, { passive: true })
}

// ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isInfoMode) { hideInfo(); return }
    if (isVideoMode && !isExiting) { hideVideo(); return }
  }
  if ((e.key === 'g' || e.key === 'G') && hoveredNombre) {
    savedViews[hoveredNombre] = { position: camera.position.clone(), target: controls.target.clone() }
    console.log(`✅ Vista guardada para ${hoveredNombre}:`, savedViews[hoveredNombre])
  }
})

function animate() {
  requestAnimationFrame(animate)
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
        showVideo(targetNombre, pendingNombreCustom)
        pendingNombreCustom = null
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
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  cursorCanvas.width = window.innerWidth
  cursorCanvas.height = window.innerHeight
})

// ── 360° VIDEO VIEWER ────────────────────────────────
let v360 = null

function init360Viewer(videoSrc, volume) {
  destroy360Viewer()
  const wrapper = document.getElementById('video-wrapper')
  if (!wrapper) return

  const container = document.createElement('div')
  container.id = 'video360-container'
  container.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;background:#000;cursor:grab;overflow:hidden;box-shadow:0 0 80px rgba(0,0,0,0.9);'
  wrapper.appendChild(container)

  const hint = document.createElement('div')
  hint.textContent = tr(I18N.drag360)
  hint.style.cssText = 'position:absolute;bottom:14px;left:14px;font-size:10px;letter-spacing:0.2em;color:rgba(255,255,255,0.7);font-family:Helvetica,sans-serif;pointer-events:none;z-index:2;mix-blend-mode:difference;'
  container.appendChild(hint)

  const video = document.createElement('video')
  video.src = videoSrc
  video.crossOrigin = 'anonymous'
  video.loop = true
  video.playsInline = true
  video.muted = true   // start silent — user enables sound
  const vol = typeof volume === 'number' ? volume : 0.5
  video.volume = vol
  video.style.display = 'none'
  container.appendChild(video)
  currentPlayingVideo = video

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
  cam.position.set(0, 0, 0.01)

  const rend = new THREE.WebGLRenderer({ antialias: true })
  rend.setPixelRatio(window.devicePixelRatio)
  rend.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(rend.domElement)
  rend.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;'

  const tex = new THREE.VideoTexture(video)
  tex.colorSpace = THREE.SRGBColorSpace
  // Top-bottom stereoscopic: sample only top half (left eye) and stretch over sphere
  tex.repeat.set(1, 0.5)
  tex.offset.set(0, 0.5)
  const geo = new THREE.SphereGeometry(500, 60, 40)
  geo.scale(-1, 1, 1) // invert so we see inside
  const mat = new THREE.MeshBasicMaterial({ map: tex })
  const sphere = new THREE.Mesh(geo, mat)
  scene.add(sphere)

  let lon = 0, lat = 0, isDown = false, downX = 0, downY = 0, downLon = 0, downLat = 0

  const onDown = (e) => {
    isDown = true
    container.style.cursor = 'grabbing'
    const p = e.touches ? e.touches[0] : e
    downX = p.clientX; downY = p.clientY
    downLon = lon; downLat = lat
  }
  const onMove = (e) => {
    if (!isDown) return
    const p = e.touches ? e.touches[0] : e
    lon = downLon - (p.clientX - downX) * 0.2
    lat = Math.max(-85, Math.min(85, downLat + (p.clientY - downY) * 0.2))
  }
  const onUp = () => { isDown = false; container.style.cursor = 'grab' }

  container.addEventListener('mousedown', onDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  container.addEventListener('touchstart', onDown, { passive: true })
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onUp)

  let rafId = null
  const animate = () => {
    rafId = requestAnimationFrame(animate)
    const phi = THREE.MathUtils.degToRad(90 - lat)
    const theta = THREE.MathUtils.degToRad(lon)
    const tx = 500 * Math.sin(phi) * Math.cos(theta)
    const ty = 500 * Math.cos(phi)
    const tz = 500 * Math.sin(phi) * Math.sin(theta)
    cam.lookAt(tx, ty, tz)
    rend.render(scene, cam)
  }
  animate()

  const onResize = () => {
    if (!container.clientWidth) return
    cam.aspect = container.clientWidth / container.clientHeight
    cam.updateProjectionMatrix()
    rend.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // Retry on transient load failures (cold R2 edge, CORS preflight, etc.)
  let retryCount = 0
  const tryPlay = () => video.play().catch(() => {})
  video.addEventListener('error', () => {
    if (retryCount >= 2) return
    retryCount++
    const wait = 600 * retryCount
    setTimeout(() => {
      try {
        video.src = videoSrc + (videoSrc.includes('?') ? '&' : '?') + 'r=' + retryCount
        video.load()
        tryPlay()
      } catch (e) {}
    }, wait)
  })
  // Also retry once if metadata never arrives within 4s
  let metaTimer = setTimeout(() => {
    if (video.readyState < 1) {
      video.dispatchEvent(new Event('error'))
    }
  }, 4000)
  video.addEventListener('loadedmetadata', () => clearTimeout(metaTimer), { once: true })

  tryPlay()
  refreshSoundToggle()

  v360 = {
    container, video, scene, cam, rend, tex, geo, mat, sphere, rafId,
    onDown, onMove, onUp, onResize
  }
}

function destroy360Viewer() {
  if (!v360) return
  cancelAnimationFrame(v360.rafId)
  window.removeEventListener('mousemove', v360.onMove)
  window.removeEventListener('mouseup', v360.onUp)
  window.removeEventListener('touchmove', v360.onMove)
  window.removeEventListener('touchend', v360.onUp)
  window.removeEventListener('resize', v360.onResize)
  try { v360.video.pause(); v360.video.src = ''; v360.video.load() } catch(e) {}
  v360.tex.dispose()
  v360.geo.dispose()
  v360.mat.dispose()
  v360.rend.dispose()
  v360.container.remove()
  v360 = null
}

// ── MANUAL ────────────────────────────────────────────
function loadManual(manual, nombre) {
  const sectionPdf = document.getElementById('section-pdf')
  const container = document.getElementById('pdf-container')
  const loading = document.getElementById('pdf-loading')
  const pdfTitulo = document.getElementById('pdf-titulo')

  if (!manual?.carpeta || !manual?.frames) {
    if (sectionPdf) sectionPdf.style.display = 'none'
    return
  }

  if (sectionPdf) sectionPdf.style.display = 'flex'
  if (pdfTitulo) pdfTitulo.textContent = nombre
  if (container) container.innerHTML = ''
  if (loading) { loading.textContent = tr(I18N.loading); loading.classList.remove('hidden') }

  let loadedCount = 0
  let failedCount = 0

  const exts = ['webp', 'WEBP', 'jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG']

  function tryLoadImage(img, wrapper, carpeta, numStr, extIndex) {
    if (extIndex >= exts.length) {
      wrapper.style.display = 'none'
      failedCount++
      if (failedCount + loadedCount === manual.frames && loading) loading.classList.add('hidden')
      return
    }
    img.onerror = () => tryLoadImage(img, wrapper, carpeta, numStr, extIndex + 1)
    img.src = `${carpeta}${numStr}.${exts[extIndex]}`
  }

  for (let i = 1; i <= manual.frames; i++) {
    const numStr = String(i).padStart(2, '0')

    const wrapper = document.createElement('div')
    wrapper.className = 'pdf-page-wrapper'
    const img = document.createElement('img')
    img.className = 'pdf-page-img'
    img.loading = 'lazy'
    img.alt = `Page ${i}`
    img.onload = () => {
      loadedCount++
      if (loading) loading.classList.add('hidden')
    }
    tryLoadImage(img, wrapper, manual.carpeta, numStr, 0)
    wrapper.appendChild(img)
    container.appendChild(wrapper)
  }
}

// ── EMBED ─────────────────────────────────────────────
function loadEmbed(url, nombre) {
  const sectionEmbed = document.getElementById('section-embed')
  const container = document.getElementById('embed-container')
  const titulo = document.getElementById('embed-titulo')
  const openLink = document.getElementById('embed-open')
  if (!sectionEmbed || !container) return

  sectionEmbed.style.display = 'flex'
  if (titulo) titulo.textContent = nombre || ''
  if (openLink) openLink.href = url
  container.innerHTML = ''

  const iframe = document.createElement('iframe')
  iframe.src = url
  iframe.id = 'embed-iframe'
  iframe.setAttribute('allow', 'autoplay; fullscreen; clipboard-write; encrypted-media')
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  container.appendChild(iframe)

  // Detect if the site refused to be embedded (X-Frame-Options / CSP).
  // If the iframe never fires onload within a short window, swap in a CTA.
  let loaded = false
  iframe.addEventListener('load', () => { loaded = true })

  setTimeout(() => {
    if (loaded) return
    // Most likely framing was blocked by the target site
    container.innerHTML = ''
    const fallback = document.createElement('a')
    fallback.href = url
    fallback.target = '_blank'
    fallback.rel = 'noopener'
    fallback.id = 'embed-fallback'
    const lang = (window.getLang && window.getLang()) || 'es'
    const headline = lang === 'en'
      ? "This site can't be embedded here."
      : 'Este sitio no permite ser incrustado.'
    const action = lang === 'en' ? 'OPEN SITE ↗' : 'ABRIR SITIO ↗'
    fallback.innerHTML = `
      <div class="embed-fallback-inner">
        <span class="embed-fallback-domain">${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        <p class="embed-fallback-text">${headline}</p>
        <span class="embed-fallback-cta">${action}</span>
      </div>
    `
    container.appendChild(fallback)
  }, 3500)
}

// ── VOLUMEN ──────────────────────────────────────────
let volumeValue = 0.5

function setVolume(v) {
  volumeValue = Math.max(0, Math.min(1, v))
  const pct = volumeValue * 100
  const fill = document.getElementById('volume-fill')
  const thumb = document.getElementById('volume-thumb')
  if (fill) fill.style.width = pct + '%'
  if (thumb) thumb.style.left = pct + '%'
  const videoEl = document.getElementById('video-player')
  if (videoEl) videoEl.volume = volumeValue
  // Also adjust the active 360 video if any
  if (currentPlayingVideo && currentPlayingVideo !== videoEl) {
    currentPlayingVideo.volume = volumeValue
  }
}

const volumeControl = document.getElementById('volume-control')
const volumeTrack = document.getElementById('volume-track')
if (volumeControl && volumeTrack) {
  let dragging = false
  const updateFromEvent = (e) => {
    const rect = volumeTrack.getBoundingClientRect()
    setVolume((e.clientX - rect.left) / rect.width)
  }
  volumeTrack.addEventListener('mousedown', (e) => { dragging=true; updateFromEvent(e) })
  window.addEventListener('mousemove', (e) => { if (dragging) updateFromEvent(e) })
  window.addEventListener('mouseup', () => { dragging=false })
  setVolume(0.5)
}

// ── CURSOR ──────────────────────────────────────────
const cursorCanvas = document.getElementById('cursor-canvas')
const ctx = cursorCanvas.getContext('2d')
cursorCanvas.width = window.innerWidth
cursorCanvas.height = window.innerHeight

const cursorParticles = []
let mouseX = window.innerWidth / 2
let mouseY = window.innerHeight / 2
const CURSOR_RADIUS = 5

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY
  for (let i = 0; i < 4; i++) {
    cursorParticles.push({
      x: mouseX+(Math.random()-0.5)*10, y: mouseY+(Math.random()-0.5)*10,
      vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5-0.6,
      size: 2.5+Math.random()*3, alpha: 0.7+Math.random()*0.3,
      decay: 0.012+Math.random()*0.018,
      r: isInfoMode ? 255 : 68,
      g: isInfoMode ? 255 : 136,
      b: isInfoMode ? 255 : 255
    })
  }
})

function animateCursor() {
  requestAnimationFrame(animateCursor)
  ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)

  // Colores adaptados según modo (info = blanco, home/video = azul)
  const cr = isInfoMode ? 255 : 68
  const cg = isInfoMode ? 255 : 136
  const cb = isInfoMode ? 255 : 255

  const glowGrad = ctx.createRadialGradient(mouseX,mouseY,0,mouseX,mouseY,CURSOR_RADIUS*4)
  glowGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.25)`)
  glowGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
  ctx.beginPath(); ctx.arc(mouseX,mouseY,CURSOR_RADIUS*4,0,Math.PI*2)
  ctx.fillStyle=glowGrad; ctx.fill()

  ctx.beginPath(); ctx.arc(mouseX,mouseY,CURSOR_RADIUS,0,Math.PI*2)
  ctx.fillStyle=`rgba(${cr},${cg},${cb},0.9)`; ctx.fill()

  for (let i = cursorParticles.length-1; i >= 0; i--) {
    const p = cursorParticles[i]
    p.x+=p.vx; p.y+=p.vy; p.alpha-=p.decay; p.size*=0.97
    if (p.alpha<=0) { cursorParticles.splice(i,1); continue }
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2)
    ctx.fillStyle=`rgba(${p.r},${p.g},${p.b},${p.alpha})`; ctx.fill()
  }

  for (let i = tunnelExitParticles.length-1; i >= 0; i--) {
    const p = tunnelExitParticles[i]
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.96; p.vy*=0.96; p.alpha-=p.decay; p.size*=0.98
    if (p.alpha<=0) { tunnelExitParticles.splice(i,1); continue }
    const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*2.5)
    g.addColorStop(0,`rgba(${p.r},${p.g},${p.b},${p.alpha})`)
    g.addColorStop(1,`rgba(${p.r},${p.g},${p.b},0)`)
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.5,0,Math.PI*2)
    ctx.fillStyle=g; ctx.fill()
  }
}

// ── LOGO SCRAMBLE ANIMATION ─────────────────────────
;(() => {
  const el = document.getElementById('logo-text')
  if (!el) return

  const FINAL = 'BAUSQUI'
  const GLYPHS = '▓░▒█◆◇○●▼▲►◄+×*#@$%&§¶∆Ωπ∞01234567890ABCDEFXYZ'
  const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

  // scramble TO the final word over `duration` ms
  function scrambleTo(target, duration = 1200) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        // each character locks in at progress = i / target.length
        let out = ''
        for (let i = 0; i < target.length; i++) {
          const charProgress = i / target.length
          if (t > charProgress + 0.15) out += target[i]
          else out += randGlyph()
        }
        el.textContent = out
        if (t < 1) requestAnimationFrame(tick)
        else { el.textContent = target; resolve() }
      }
      requestAnimationFrame(tick)
    })
  }

  // scramble FROM the final word into garbage
  function scrambleAway(duration = 600) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        let out = ''
        for (let i = 0; i < FINAL.length; i++) {
          if (Math.random() < t) out += randGlyph()
          else out += FINAL[i]
        }
        el.textContent = out
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  // hold a fully scrambled state for a moment
  function holdScrambled(duration = 800) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        let out = ''
        for (let i = 0; i < FINAL.length; i++) out += randGlyph()
        el.textContent = out
        if (now - start < duration) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  async function loop() {
    while (true) {
      await scrambleTo(FINAL, 1200)        // assemble: garbage → BAUSQUI
      await new Promise(r => setTimeout(r, 3500))  // hold the name visible
      await scrambleAway(500)              // glitch out
      await holdScrambled(700)             // chaos
    }
  }
  loop()
})()

animateCursor()

// ── i18n: re-render open project + hints when language changes ──
window.addEventListener('langchange', () => {
  // Re-render abstract texts if a project is currently open
  if (isVideoMode && currentProyectoKey) {
    const proyecto = getProyectoData(currentProyectoKey, currentProyectoCustom)
    if (proyecto) {
      const titulo = document.getElementById('abstract-titulo')
      const subtituloEl = document.getElementById('abstract-subtitulo')
      const meta = document.getElementById('abstract-meta')
      const shortDesc = document.getElementById('abstract-descripcion')
      const fullDesc = document.getElementById('abstract-descripcion-full')
      const expandBtn = document.getElementById('abstract-expand')

      if (titulo) titulo.textContent = proyecto?.nombre || currentProyectoKey
      if (subtituloEl) {
        const sub = tr(proyecto?.subtitulo)
        subtituloEl.textContent = sub
        subtituloEl.style.display = sub ? 'block' : 'none'
      }
      if (meta) meta.textContent = `${proyecto?.año||''} / ${tr(proyecto?.cliente)} / ${tr(proyecto?.tipo)}`
      if (shortDesc) shortDesc.textContent = tr(proyecto?.descripcion)
      if (fullDesc) fullDesc.textContent = tr(proyecto?.descripcionFull)

      if (expandBtn) {
        const showingFull = fullDesc && fullDesc.style.display !== 'none'
        expandBtn.textContent = showingFull ? tr(I18N.readLess) : tr(I18N.readMore)
      }
    }
  }

  // Re-render 360 drag hint if visible
  if (v360 && v360.container) {
    const hint = v360.container.querySelector('div')
    if (hint) hint.textContent = tr(I18N.drag360)
  }

  // Re-render loading label if visible
  const loading = document.getElementById('pdf-loading')
  if (loading && !loading.classList.contains('hidden')) {
    loading.textContent = tr(I18N.loading)
  }

  // Refresh sound toggle label
  refreshSoundToggle()
})

// ── SOUND TOGGLE ───────────────────────────────────────
// ── TIMELINE / VIDEO SCRUBBER ───────────────────────
const timelineControl  = document.getElementById('timeline-control')
const timelineTrack    = document.getElementById('timeline-track')
const timelineFill     = document.getElementById('timeline-fill')
const timelineThumb    = document.getElementById('timeline-thumb')
const timelineCurrent  = document.getElementById('timeline-current')
const timelineDuration = document.getElementById('timeline-duration')

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r < 10 ? '0' : ''}${r}`
}

function updateTimelineUI() {
  const v = document.getElementById('video-player')
  if (!v) return
  const dur = v.duration || 0
  const cur = v.currentTime || 0
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0
  if (timelineFill)     timelineFill.style.width = pct + '%'
  if (timelineThumb)    timelineThumb.style.left = pct + '%'
  if (timelineCurrent)  timelineCurrent.textContent = formatTime(cur)
  if (timelineDuration) timelineDuration.textContent = formatTime(dur)
}

function refreshPlayBtn() {
  const v = document.getElementById('video-player')
  const btn = document.getElementById('timeline-play')
  if (!v || !btn) return
  const playing = !v.paused && !v.ended
  btn.textContent = playing ? '❚❚' : '▶'
  btn.classList.toggle('is-playing', playing)
}

;(() => {
  const v = document.getElementById('video-player')
  if (!v) return
  v.addEventListener('timeupdate', updateTimelineUI)
  v.addEventListener('loadedmetadata', updateTimelineUI)
  v.addEventListener('durationchange', updateTimelineUI)
  v.addEventListener('play',  refreshPlayBtn)
  v.addEventListener('pause', refreshPlayBtn)
  v.addEventListener('ended', refreshPlayBtn)
})()

document.getElementById('timeline-play')?.addEventListener('click', (e) => {
  e.stopPropagation()
  const v = document.getElementById('video-player')
  if (!v) return
  if (v.paused) {
    v.play().catch(() => {})
  } else {
    v.pause()
  }
})

if (timelineTrack) {
  let dragging = false
  let wasPlaying = false
  const seek = (e) => {
    const v = document.getElementById('video-player')
    if (!v || !v.duration) return
    const rect = timelineTrack.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = ratio * v.duration
    updateTimelineUI()
  }
  timelineTrack.addEventListener('mousedown', (e) => {
    const v = document.getElementById('video-player')
    if (!v) return
    dragging = true
    wasPlaying = !v.paused
    v.pause()
    seek(e)
  })
  window.addEventListener('mousemove', (e) => { if (dragging) seek(e) })
  window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    const v = document.getElementById('video-player')
    if (wasPlaying) v?.play().catch(() => {})
  })
}

// ── BACK TO TOP ─────────────────────────────────────
document.getElementById('back-top')?.addEventListener('click', (e) => {
  e.stopPropagation()
  const scroller = document.getElementById('video-scroll-container')
  if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
})

// ── BACK TO HOME (mobile) ───────────────────────────
document.getElementById('back-home')?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (isVideoMode && !isExiting) hideVideo()
})

document.getElementById('sound-toggle')?.addEventListener('click', (e) => {
  e.stopPropagation()

  // YouTube path — control via postMessage
  if (currentYouTube) {
    ytMuted = !ytMuted
    if (ytMuted) {
      ytPostMessage(currentYouTube, 'mute')
    } else {
      ytPostMessage(currentYouTube, 'unMute')
      ytPostMessage(currentYouTube, 'setVolume', [60])
      ytPostMessage(currentYouTube, 'playVideo')
    }
    refreshSoundToggle()
    return
  }

  // Native video path
  if (!currentPlayingVideo) return
  currentPlayingVideo.muted = !currentPlayingVideo.muted
  if (!currentPlayingVideo.muted && currentPlayingVideo.volume === 0) {
    currentPlayingVideo.volume = 0.5
    setVolume?.(0.5)
  }
  currentPlayingVideo.play?.().catch(() => {})
  refreshSoundToggle()
})

// ── BACKGROUND MUSIC + WAVEFORM VISUALIZER ─────────────
;(() => {
  const bgMusic = document.getElementById('bg-music')
  const musicBtn = document.getElementById('music-toggle')
  const canvas   = document.getElementById('music-viz')
  if (!bgMusic || !musicBtn || !canvas) return

  bgMusic.volume = 0.4
  musicTargetVol = 0.4

  // Belt-and-suspenders looping. Some browsers ignore the native `loop`
  // attribute when MediaElementSource is connected to a Web Audio graph.
  bgMusic.loop = true
  bgMusic.addEventListener('ended', () => {
    try {
      bgMusic.currentTime = 0
      bgMusic.play().catch(() => {})
    } catch (e) {}
  })
  // Some browsers fire `pause` near the end instead of `ended`. Re-poke it.
  bgMusic.addEventListener('timeupdate', () => {
    if (bgMusic.duration && bgMusic.currentTime > bgMusic.duration - 0.25) {
      // Safe wrap a hair before the end avoids the silent gap
      bgMusic.currentTime = 0
    }
  })

  // Mark loader progress when music has enough data
  if (bgMusic.readyState >= 3) {
    window.__loaderDone?.('music')
  } else {
    bgMusic.addEventListener('canplaythrough', () => window.__loaderDone?.('music'), { once: true })
    bgMusic.addEventListener('loadeddata',     () => window.__loaderDone?.('music'), { once: true })
  }

  // Mark loader progress for the About background video
  const bgVid = document.querySelector('.sw-bg-video')
  if (bgVid) {
    if (bgVid.readyState >= 2) {
      window.__loaderDone?.('bgvideo')
    } else {
      bgVid.addEventListener('loadeddata', () => window.__loaderDone?.('bgvideo'), { once: true })
      bgVid.addEventListener('canplay',    () => window.__loaderDone?.('bgvideo'), { once: true })
    }
  } else {
    window.__loaderDone?.('bgvideo')
  }

  // Crisp canvas on retina
  const CSS_W = 84, CSS_H = 22
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  canvas.width  = CSS_W * dpr
  canvas.height = CSS_H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const BARS = 18
  const GAP  = 2
  const BAR_W = (CSS_W - GAP * (BARS - 1)) / BARS

  // Smoothed bar heights for graceful falloff when paused
  const heights = new Array(BARS).fill(0)

  let audioCtx = null
  let analyser = null
  let dataArray = null

  function ensureAudioGraph() {
    if (audioCtx) return
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaElementSource(bgMusic)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64                  // 32 frequency bins
      analyser.smoothingTimeConstant = 0.75
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      src.connect(analyser)
      analyser.connect(audioCtx.destination)
    } catch (e) {
      console.warn('Audio analyser unavailable', e)
    }
  }

  function drawViz() {
    requestAnimationFrame(drawViz)
    ctx.clearRect(0, 0, CSS_W, CSS_H)

    const playing = musicEnabled && !bgMusic.paused
    const targets = new Array(BARS).fill(0)

    if (playing && analyser) {
      analyser.getByteFrequencyData(dataArray)
      // Pull lower-mid bins (audible musical range), skipping the very bottom
      const start = 1
      for (let i = 0; i < BARS; i++) {
        const idx = Math.min(start + i, dataArray.length - 1)
        targets[i] = (dataArray[idx] / 255)
      }
    } else if (musicEnabled) {
      // Idle wiggle while loading / waiting
      const t = performance.now() / 600
      for (let i = 0; i < BARS; i++) {
        targets[i] = 0.08 + 0.06 * Math.sin(t + i * 0.5)
      }
    }
    // else: bars decay to 0

    // Smooth toward target
    for (let i = 0; i < BARS; i++) {
      heights[i] += (targets[i] - heights[i]) * 0.25
    }

    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(1.5, heights[i] * CSS_H)
      const x = i * (BAR_W + GAP)
      const y = (CSS_H - h) / 2
      ctx.fillRect(x, y, BAR_W, h)
    }
  }
  drawViz()

  // Music starts enabled by default — try to autoplay
  musicEnabled = true
  musicBtn.classList.add('is-on')

  const tryStart = () => {
    ensureAudioGraph()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
    bgMusic.play().catch(() => {})
  }
  tryStart()

  // If the browser blocked autoplay, retry on first user gesture
  const onFirstGesture = () => {
    tryStart()
    if (!bgMusic.paused) {
      window.removeEventListener('pointerdown', onFirstGesture, true)
      window.removeEventListener('keydown', onFirstGesture, true)
      window.removeEventListener('touchstart', onFirstGesture, true)
    }
  }
  window.addEventListener('pointerdown', onFirstGesture, true)
  window.addEventListener('keydown', onFirstGesture, true)
  window.addEventListener('touchstart', onFirstGesture, true)

  musicBtn.addEventListener('click', () => {
    ensureAudioGraph()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()

    musicEnabled = !musicEnabled
    musicBtn.classList.toggle('is-on', musicEnabled)
    updateMusic()
  })

  // Update music state when scrolling between info sections
  const sections = ['info-about', 'info-vision', 'info-contact']
    .map(id => document.getElementById(id))
    .filter(Boolean)

  if (sections.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      let best = null
      let bestRatio = 0
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio
          best = e.target.id
        }
      })
      if (best) {
        let next = currentInfoTarget
        if (best === 'info-about') next = 'about'
        else if (best === 'info-vision') next = 'vision'
        else if (best === 'info-contact') next = 'contact'
        // Only react when the active section actually changes — avoids
        // rapid play/pause flicker as multiple thresholds trip during scroll
        if (next !== currentInfoTarget) {
          currentInfoTarget = next
          if (isInfoMode) updateMusic()
        }
      }
    }, { threshold: [0.55] })

    sections.forEach(s => obs.observe(s))
  }
})()