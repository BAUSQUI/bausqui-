// Single source of truth for project data.
// `proyectos` and `proyectosExtra` are kept verbatim from the original main.js;
// PROJECTS below is the normalized list (one entry per project card) keyed by id.

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
    nombre: 'PRIMITIVO',
    video: '/videos/primitivo.webm',
    año: '2024 - 2026 ',
    cliente: { es: 'AUSQUI/CABA', en: 'AUSQUI/CABA' },
    tipo: { es: 'IDENTIDAD', en: 'BRANDING' },
    descripcion: {
      es: 'Diseño de sistema de identidad completo: logo, tipografía, sistema de afiches, piezas digitales, tapa de disco y materiales promocionales. La tipografía, tallada como en piedra, traduce esa idea de lo primitivo, mientras los elementos gráficos sostienen la frecuencia tecnológica del proyecto. La identidad no quedó en el plano gráfico. Se diseñó también la puesta en vivo y los visuales que la acompañan, desarrollados en Blender, TouchDesigner y Resolume Arena. Cada show es una extensión coherente del lenguaje visual: el mismo concepto, ahora vibrando con la música en tiempo real.',
      en: 'Complete identity system design: logo, custom typography, poster system, digital pieces, album cover and promotional materials. The typography, carved as if in stone, translates the primitive idea, while the graphic elements hold the technological frequency of the project. The identity did not stay on the graphic plane. The live show and accompanying visuals were also designed, developed in Blender, TouchDesigner and Resolume Arena. Each show is a coherent extension of the visual language: the same concept, now vibrating with the music in real time.'
    },
    descripcionFull: null,
    manual: { carpeta: '/pdf/primitivo/', frames: 8 },
    volumen: 0.5, autores: 'Bautista Ausqui'
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

export function getProyectoData(icosphereKey, nombreCustom) {
  if (nombreCustom && proyectosExtra[nombreCustom]) return proyectosExtra[nombreCustom]
  return proyectos[icosphereKey]
}

// One entry per project card. `card` is the card's data-custom value,
// `flower.icosphere` its data-nombre (anchor for the flower's savedViews),
// `thumbs` the frames extracted into public/thumbs/<folder>/01.jpg … 0N.jpg.
const PROJECT_INDEX = [
  { id: 'soma',        card: 'SOMA',         icosphere: 'Icosphere002', thumbs: { folder: 'SOMA',           count: 6 } },
  { id: 'mutante',     card: 'MUTANTE',      icosphere: 'Icosphere003', thumbs: { folder: 'mutante',        count: 6 } },
  { id: 'primitivo',   card: 'PRIMITIVO',    icosphere: 'Icosphere005', thumbs: { folder: 'primitivo',      count: 6 } },
  { id: 'papota',      card: 'PAPOTA',       icosphere: 'Icosphere004', thumbs: { folder: 'papotta',        count: 6 } },
  { id: 'dualidad',    card: 'IMMERSIVE',    icosphere: 'Icosphere003', thumbs: { folder: 'PortfolioVideo', count: 6 } },
  { id: 'ghost',       card: 'GHOST PERROS', icosphere: 'Icosphere001', thumbs: { folder: 'ghost',          count: 6 } },
  { id: 'poseido',     card: 'POSEIDO',      icosphere: 'Icosphere002', thumbs: { folder: null,             count: 0 } },
  { id: 'tahadis',     card: 'TAHADIS',      icosphere: 'Icosphere004', thumbs: { folder: 'TAHADIS',        count: 6 } },
  { id: 'tiempo-real', card: 'TIEMPO REAL',  icosphere: 'Icosphere001', thumbs: { folder: 'tiempo_real',    count: 6 } },
]

export const PROJECTS = PROJECT_INDEX.map(p => ({
  id: p.id,
  card: p.card,
  data: getProyectoData(p.icosphere, p.card),
  thumbs: p.thumbs,
  flower: { icosphere: p.icosphere },
}))

const byId = new Map(PROJECTS.map(p => [p.id, p]))
const byCard = new Map(PROJECTS.map(p => [p.card, p]))

export function getProject(id) { return byId.get(id) || null }

// Resolve a .proyecto-card element to its project entry
export function projectFromCard(card) {
  return byCard.get(card?.dataset?.custom) || null
}
