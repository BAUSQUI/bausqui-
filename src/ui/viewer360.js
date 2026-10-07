// ── 360° VIDEO VIEWER ────────────────────────────────
import * as THREE from 'three'
import { tr, I18N } from '../i18n.js'
import { playback, refreshSoundToggle } from './playback.js'

let v360 = null

// Re-render the drag hint when the language changes
export function refresh360Hint() {
  if (v360 && v360.container) {
    const hint = v360.container.querySelector('div')
    if (hint) hint.textContent = tr(I18N.drag360)
  }
}

export function init360Viewer(videoSrc, volume) {
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
  playback.currentPlayingVideo = video

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
  cam.position.set(0, 0, 0.01)

  const rend = new THREE.WebGLRenderer({ antialias: true })
  rend.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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

export function destroy360Viewer() {
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

