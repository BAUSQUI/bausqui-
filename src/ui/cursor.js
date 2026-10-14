// ── CURSOR ──────────────────────────────────────────
// The only custom cursor: a small solid white dot on the cursor canvas. Black and white,
// no trail. (The old radial exit burst is gone: closing a project returns through the
// tornado reassembly.)
// Hidden until the mouse first moves, and while it is outside the window.
// Touch devices: no cursor at all (never rendered, no animation loop).
import { IS_TOUCH } from './touch.js'

let cursorCanvas = null
let ctx = null
let started = false
let mouseX = 0
let mouseY = 0
let visible = false
const DOT_RADIUS = 3   // 6px dot

export function resizeCursor() {
  if (!cursorCanvas) return
  cursorCanvas.width = window.innerWidth
  cursorCanvas.height = window.innerHeight
}

export function initCursor() {
  if (started || IS_TOUCH) return   // one cursor system, one animation loop; none on touch
  started = true
  cursorCanvas = document.getElementById('cursor-canvas')
  ctx = cursorCanvas.getContext('2d')
  resizeCursor()

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
    visible = true
  })
  document.documentElement.addEventListener('mouseleave', () => { visible = false })

  animateCursor()
}

function animateCursor() {
  requestAnimationFrame(animateCursor)
  ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)

  if (visible) {
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, DOT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
}
