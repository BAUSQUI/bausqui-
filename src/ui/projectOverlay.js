// Project overlay: video (native / 360° / YouTube) + abstract + brand manual + embed.
// Behavior unchanged from the original main.js. The active experience is told when the
// overlay opens/closes through hooks.onOverlay('project', open).
import { state } from '../state.js'
import { tr, I18N } from '../i18n.js'
import { getProject } from '../data/projects.js'
import { playback, refreshSoundToggle, ytPostMessage, setVolume, updateTimelineUI } from './playback.js'
import { init360Viewer, destroy360Viewer, refresh360Hint } from './viewer360.js'
import { updateMusic } from './music.js'

let hooks = { onOverlay() {} }
let currentProjectId = null

export function showVideo(id) {
  state.isVideoMode = true
  document.body.classList.add('is-video')
  updateMusic()
  const proyecto = getProject(id)?.data
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

  document.getElementById('abstract-titulo').textContent = proyecto?.nombre || id
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
  currentProjectId = id

  const manualBtn = document.getElementById('abstract-manual')
  if (manualBtn) manualBtn.style.display = 'none'

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

    playback.currentPlayingVideo = null
    playback.currentYouTube = iframe
    playback.ytMuted = true
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
    playback.currentPlayingVideo = videoEl
    playback.currentYouTube = null
    refreshSoundToggle()
    updateTimelineUI()
  }

  overlay.classList.add('visible')

  if (proyecto?.manual) loadManual(proyecto.manual, proyecto.nombre)
  if (proyecto?.embed) loadEmbed(proyecto.embed, proyecto.nombre)

  // The active experience hides itself behind the overlay (the flower also glides its camera home)
  hooks.onOverlay('project', true)
}

export function hideVideo() {
  if (state.isExiting) return
  state.isExiting = true

  const overlay = document.getElementById('video-overlay')
  const videoEl = document.getElementById('video-player')
  const sectionPdf = document.getElementById('section-pdf')

  overlay.style.transition = 'opacity 0.6s ease'
  overlay.style.opacity = '0'

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
    state.isVideoMode = false
    state.isExiting = false
    currentProjectId = null
    playback.currentPlayingVideo = null
    playback.currentYouTube = null
    playback.ytMuted = true
    document.body.classList.remove('is-video')
    document.getElementById('open-youtube')?.classList.remove('is-visible')
    document.getElementById('open-site')?.classList.remove('is-visible')
    refreshSoundToggle()
    updateMusic()
    document.querySelector('nav')?.style.removeProperty('display')
    document.querySelector('.logo-container')?.style.removeProperty('display')
    document.querySelector('.logo-subtitle')?.style.removeProperty('display')
    document.querySelector('.proyectos-grid')?.style.removeProperty('display')
    hooks.onOverlay('project', false)
  }, 800)
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

export function initProjectOverlay(overlayHooks) {
  hooks = overlayHooks

  // Scroll video overlay: cerrar al fondo
  const scrollContainer = document.getElementById('video-scroll-container')
  if (scrollContainer) {
    let bottomWheelAccum = 0
    let bottomTimer = null
    scrollContainer.addEventListener('wheel', (e) => {
      if (!state.isVideoMode || state.isExiting) return
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

  // ── i18n: re-render open project + hints when language changes ──
  window.addEventListener('langchange', () => {
    // Re-render abstract texts if a project is currently open
    if (state.isVideoMode && currentProjectId) {
      const proyecto = getProject(currentProjectId)?.data
      if (proyecto) {
        const titulo = document.getElementById('abstract-titulo')
        const subtituloEl = document.getElementById('abstract-subtitulo')
        const meta = document.getElementById('abstract-meta')
        const shortDesc = document.getElementById('abstract-descripcion')
        const fullDesc = document.getElementById('abstract-descripcion-full')
        const expandBtn = document.getElementById('abstract-expand')

        if (titulo) titulo.textContent = proyecto?.nombre || currentProjectId
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
    refresh360Hint()

    // Re-render loading label if visible
    const loading = document.getElementById('pdf-loading')
    if (loading && !loading.classList.contains('hidden')) {
      loading.textContent = tr(I18N.loading)
    }

    // Refresh sound toggle label
    refreshSoundToggle()
  })

  // ── BACK TO TOP ─────────────────────────────────────
  document.getElementById('back-top')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const scroller = document.getElementById('video-scroll-container')
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
  })

  // ── BACK TO HOME (mobile) ───────────────────────────
  document.getElementById('back-home')?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (state.isVideoMode && !state.isExiting) hideVideo()
  })
}
