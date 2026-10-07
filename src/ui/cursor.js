// ── CURSOR ──────────────────────────────────────────
// Custom cursor canvas (dot + glow + trail) and the exit burst particles.
import { state } from '../state.js'

const tunnelExitParticles = []

export function spawnTunnelExitParticles() {
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

let cursorCanvas = null
let ctx = null
const cursorParticles = []
let mouseX = window.innerWidth / 2
let mouseY = window.innerHeight / 2
const CURSOR_RADIUS = 5

export function resizeCursor() {
  cursorCanvas.width = window.innerWidth
  cursorCanvas.height = window.innerHeight
}

export function initCursor() {
  cursorCanvas = document.getElementById('cursor-canvas')
  ctx = cursorCanvas.getContext('2d')
  cursorCanvas.width = window.innerWidth
  cursorCanvas.height = window.innerHeight

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY
    for (let i = 0; i < 4; i++) {
      cursorParticles.push({
        x: mouseX+(Math.random()-0.5)*10, y: mouseY+(Math.random()-0.5)*10,
        vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5-0.6,
        size: 2.5+Math.random()*3, alpha: 0.7+Math.random()*0.3,
        decay: 0.012+Math.random()*0.018,
        r: state.isInfoMode ? 255 : 68,
        g: state.isInfoMode ? 255 : 136,
        b: state.isInfoMode ? 255 : 255
      })
    }
  })

  animateCursor()
}

function animateCursor() {
  requestAnimationFrame(animateCursor)
  ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)

  // Colores adaptados según modo (info = blanco, home/video = azul)
  const cr = state.isInfoMode ? 255 : 68
  const cg = state.isInfoMode ? 255 : 136
  const cb = state.isInfoMode ? 255 : 255

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
