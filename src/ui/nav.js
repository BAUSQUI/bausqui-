// Nav cards (About / Vision / Contact / Home) and the ESC shortcut.
import { state } from '../state.js'
import { showInfo, hideInfo } from './infoOverlay.js'
import { hideVideo } from './projectOverlay.js'

export function initNav() {
  // Nav — click abre overlay o va al home
  document.querySelectorAll('nav a[data-overlay]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const target = link.dataset.overlay
      if (target === 'home') {
        hideInfo()
        if (state.isVideoMode && !state.isExiting) hideVideo()
      } else {
        if (state.isVideoMode && !state.isExiting) hideVideo()
        showInfo(target)
      }
    })
  })

  // ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.isInfoMode) { hideInfo(); return }
      if (state.isVideoMode && !state.isExiting) { hideVideo(); return }
    }
  })
}
