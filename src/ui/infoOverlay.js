// About / Vision / Contact overlay. Behavior unchanged from the original main.js.
// The active experience is told when it opens/closes through hooks.onOverlay('info', open).
import { state } from '../state.js'
import { updateMusic } from './music.js'

let hooks = { onOverlay() {} }

// ── INFO OVERLAY (About/Vision/Contact) ─────────────
export function showInfo(target) {
  if (state.isVideoMode) return

  // Already inside info overlay — just scroll to the requested section
  if (state.isInfoMode) {
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
    state.currentInfoTarget = target
    updateMusic()
    return
  }

  state.isInfoMode = true
  state.currentInfoTarget = target
  updateMusic()

  // Lazy-load the About background video on first open (kept out of the
  // initial page load — it's decorative and heavy)
  const bgVid = document.querySelector('.sw-bg-video')
  if (bgVid && !bgVid.src && bgVid.dataset.src) {
    bgVid.src = bgVid.dataset.src
    bgVid.load()
  }
  bgVid?.play().catch(() => {})

  const overlay = document.getElementById('info-overlay')
  const scrollEl = document.getElementById('info-scroll-container')

  // Ocultar home UI
  document.querySelector('.logo-container')?.style.setProperty('display', 'none')
  document.querySelector('.logo-subtitle')?.style.setProperty('display', 'none')
  document.querySelector('.proyectos-grid')?.style.setProperty('display', 'none')
  hooks.onOverlay('info', true)

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

export function hideInfo() {
  if (!state.isInfoMode) return
  const overlay = document.getElementById('info-overlay')
  overlay.classList.remove('visible')
  document.body.classList.remove('info-active')
  state.isInfoMode = false
  state.currentInfoTarget = null
  updateMusic()

  // Mostrar home
  setTimeout(() => {
    document.querySelector('.logo-container')?.style.removeProperty('display')
    document.querySelector('.logo-subtitle')?.style.removeProperty('display')
    document.querySelector('.proyectos-grid')?.style.removeProperty('display')
    hooks.onOverlay('info', false)
  }, 400)
}

export function initInfoOverlay(overlayHooks) {
  hooks = overlayHooks

  // Scroll arriba del info overlay cierra
  const infoScroll = document.getElementById('info-scroll-container')
  if (infoScroll) {
    let topWheelAccum = 0
    let topTimer = null
    infoScroll.addEventListener('wheel', (e) => {
      if (!state.isInfoMode) return
      if (infoScroll.scrollTop <= 2 && e.deltaY < 0) {
        topWheelAccum += Math.abs(e.deltaY)
        clearTimeout(topTimer)
        topTimer = setTimeout(() => { topWheelAccum = 0 }, 600)
        if (topWheelAccum > 180) { topWheelAccum = 0; hideInfo() }
      } else { topWheelAccum = 0 }
    }, { passive: true })
  }
}
