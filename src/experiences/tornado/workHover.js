// Hover on a work inside the tornado (replaces the Checkpoint 5 rescue flow):
// - raycast against the thumbnails at their current transforms, closest hit wins;
// - the tornado decelerates to a stop (timeScale) and the work lights up (highlight);
// - its title, category and year appear at the screen edge opposite the work,
//   linked to it by a 1px line;
// - leaving waits 150ms before hiding, then everything fades and the tornado spins up;
// - click opens the project. Touch: first tap lights the work, second tap opens it.
import * as THREE from 'three'
import { getProject } from '../../data/projects.js'

const HIDE_DELAY = 150      // ms, avoids flicker between neighbouring thumbnails
const STOP_RATE = 4         // 1/s: timeScale eases to 0 in ~0.8s (and back)
const HIGHLIGHT_RATE = 9    // 1/s: fade of the lit work
const HOLE_TIME = 0.3       // s: the swirl's veil clears around the work (and closes back)
const MIN_TOP = 150         // px: keep the label clear of the logo / nav block
const MIN_BOTTOM = 90       // px: and of the sound / language toggles
const LINK_GAP = 0.3        // connector stops this far from the label, × the title size

export class WorkHover {
  constructor({ camera, canvas, hero, getMeshes, onOpen }) {
    this.camera = camera
    this.canvas = canvas
    this.hero = hero
    this.getMeshes = getMeshes
    this.onOpen = onOpen

    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.pointer = null           // { x, y } in CSS px, last known
    this.pointerType = 'mouse'
    this.hovered = null           // mesh currently hovered (label shown)
    this.highlightMesh = null     // mesh being lit (kept while fading out)
    this.hideTimer = null
    this.timeScale = 1
    this.highlight = 0
    this.holeProgress = 0         // 0..1 linear; `hole` is its eased value
    this.hole = 0
    this.enabled = true

    this.buildDom()

    this.onPointerMove = (e) => {
      this.pointerType = e.pointerType || 'mouse'
      this.pointer = { x: e.clientX, y: e.clientY }
    }
    // Mouse out of the window: no stale pointer, so works drifting under its last
    // position don't keep popping the label
    this.onLeave = () => { this.pointer = null; this.setHovered(null) }
    this.onClick = (e) => this.handleClick(e)
    document.documentElement.addEventListener('mouseleave', this.onLeave)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerdown', this.onPointerMove)
    canvas.addEventListener('click', this.onClick)
  }

  buildDom() {
    this.label = document.createElement('div')
    this.label.className = 'tornado-label'
    this.label.setAttribute('aria-hidden', 'true')
    this.title = document.createElement('div')
    this.title.className = 'tornado-label-title'
    const tags = document.createElement('div')
    tags.className = 'tornado-label-tags'
    this.tag = document.createElement('span')
    this.tag.className = 'card-tag'
    this.year = document.createElement('span')
    this.year.className = 'card-year'
    tags.append(this.tag, this.year)
    this.label.append(this.title, tags)

    const svgNS = 'http://www.w3.org/2000/svg'
    this.link = document.createElementNS(svgNS, 'svg')
    this.link.setAttribute('class', 'tornado-link')
    this.link.setAttribute('aria-hidden', 'true')
    this.line = document.createElementNS(svgNS, 'line')
    this.link.append(this.line)
    document.body.append(this.link, this.label)
  }

  // Closest thumbnail under (x, y), or null. Only when the pointer is over the
  // tornado itself (not the logo, nav, list or any overlay).
  pick(x, y) {
    const el = document.elementFromPoint(x, y)
    if (el !== this.canvas && el !== this.hero) return null
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    // Intersections come sorted by distance: the first is the one nearest the camera
    const hits = this.raycaster.intersectObjects(this.getMeshes(), false)
    return hits.length ? hits[0].object : null
  }

  setHovered(mesh) {
    if (mesh) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
      if (mesh !== this.hovered) this.show(mesh)
    } else if (this.hovered && !this.hideTimer) {
      this.hideTimer = setTimeout(() => { this.hideTimer = null; this.hide() }, HIDE_DELAY)
    }
  }

  show(mesh) {
    this.hovered = mesh
    this.highlightMesh = mesh
    const project = getProject(mesh.userData.projectId)
    const card = project && document.querySelector(`.proyecto-card[data-custom="${project.card}"]`)
    const cardTag = card?.querySelector('.card-tag')
    this.title.textContent = card?.querySelector('.card-title')?.textContent || project?.data?.nombre || ''
    this.tag.textContent = cardTag?.textContent || ''
    // Keep the language toggle working while the label is up
    if (cardTag?.dataset.es) { this.tag.dataset.es = cardTag.dataset.es; this.tag.dataset.en = cardTag.dataset.en }
    else { delete this.tag.dataset.es; delete this.tag.dataset.en }
    this.year.textContent = card?.querySelector('.card-year')?.textContent || project?.data?.año || ''
    // The label goes to the edge opposite the work; fixed for as long as it's shown
    const screen = this.toScreen(mesh.position)
    this.side = screen.x < window.innerWidth / 2 ? 'right' : 'left'
    this.label.classList.toggle('is-right', this.side === 'right')
    this.label.classList.toggle('is-left', this.side === 'left')
    this.label.classList.add('is-visible')
    this.link.classList.add('is-visible')
    this.place()
  }

  hide() {
    this.hovered = null
    this.label.classList.remove('is-visible')
    this.link.classList.remove('is-visible')
  }

  // Hide now, skipping the 150ms grace. `instant` also drops the lit work without a
  // fade (overlay opened, hero scrolled away) since update() won't run to fade it.
  clear(instant = false) {
    clearTimeout(this.hideTimer)
    this.hideTimer = null
    if (this.hovered) this.hide()
    if (instant) { this.highlight = 0; this.highlightMesh = null; this.holeProgress = 0; this.hole = 0 }
  }

  handleClick(e) {
    if (!this.enabled) return
    if (this.pointerType === 'touch') {
      // First tap lights the work, a second tap on the same work opens it
      const hit = this.pick(e.clientX, e.clientY)
      if (hit && hit === this.hovered) this.open(hit)
      else if (hit) { clearTimeout(this.hideTimer); this.hideTimer = null; this.show(hit) }
      else this.clear()
      return
    }
    if (this.hovered) this.open(this.hovered)
  }

  open(mesh) {
    const id = mesh.userData.projectId
    this.onOpen(id, mesh, this.highlight)
    this.clear(true)
  }

  toScreen(v) {
    const p = v.clone().project(this.camera)
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight }
  }

  // Vertical: aligned with the work, clamped inside the viewport. The line runs from
  // the work's edge nearest the label to the label's inner edge, at the title's middle.
  place() {
    const mesh = this.hovered
    if (!mesh) return
    const W = window.innerWidth, H = window.innerHeight
    const center = this.toScreen(mesh.position)
    const h = this.label.offsetHeight
    const top = Math.min(Math.max(center.y - h / 2, MIN_TOP), Math.max(MIN_TOP, H - h - MIN_BOTTOM))
    this.label.style.transform = `translateY(${top}px)`

    const a = this.toScreen(mesh.localToWorld(new THREE.Vector3(-0.5, 0, 0)))
    const b = this.toScreen(mesh.localToWorld(new THREE.Vector3(0.5, 0, 0)))
    const start = (this.side === 'right') === (a.x > b.x) ? a : b
    const rect = this.label.getBoundingClientRect()
    // The gap scales with the title, like the pills
    const gap = (parseFloat(getComputedStyle(this.title).fontSize) || 48) * LINK_GAP
    const endX = this.side === 'right' ? rect.left - gap : rect.right + gap
    const endY = top + this.title.offsetHeight / 2
    this.line.setAttribute('x1', start.x); this.line.setAttribute('y1', start.y)
    this.line.setAttribute('x2', endX); this.line.setAttribute('y2', endY)
    this.link.setAttribute('viewBox', `0 0 ${W} ${H}`)
  }

  // Call once per rendered frame, after this frame's transforms are applied
  update(dt) {
    if (this.enabled && this.pointer && this.pointerType !== 'touch') {
      this.setHovered(this.pick(this.pointer.x, this.pointer.y))
    }
    const stop = this.hovered ? 0 : 1
    this.timeScale += (stop - this.timeScale) * (1 - Math.exp(-dt * STOP_RATE))
    const lit = this.hovered ? 1 : 0
    this.highlight += (lit - this.highlight) * (1 - Math.exp(-dt * HIGHLIGHT_RATE))
    this.holeProgress = Math.min(1, Math.max(0, this.holeProgress + (this.hovered ? dt : -dt) / HOLE_TIME))
    this.hole = this.holeProgress * this.holeProgress * (3 - 2 * this.holeProgress)
    if (this.highlight < 0.002 && !this.hovered) { this.highlight = 0; this.highlightMesh = null }
    this.place()
  }

  dispose() {
    this.clear(true)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerdown', this.onPointerMove)
    document.documentElement.removeEventListener('mouseleave', this.onLeave)
    this.canvas.removeEventListener('click', this.onClick)
    this.label.remove()
    this.link.remove()
  }
}
