// ── PROJECT CARDS — hover plays preview, click asks the experience to open it ──
import { state } from '../state.js'
import { projectFromCard } from '../data/projects.js'

// onSelect(project) runs the active experience's transition; it returns false
// when the selection is ignored (e.g. a trip is already running).
export function initCards(onSelect) {
  document.querySelectorAll('.proyecto-card').forEach((card) => {
    const previewVideo = card.querySelector('.card-preview')
    const videoSrc = card.dataset.video

    // HOVER → load + play preview (or show static poster if no video)
    card.addEventListener('mouseenter', () => {
      if (state.isVideoMode || state.isInfoMode) return
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

    // CLICK → start the experience's transition into the project
    card.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (state.isVideoMode || state.isInfoMode) return

      const project = projectFromCard(card)
      if (!project) return

      if (!onSelect(project)) return

      // Stop preview once the trip has started
      if (previewVideo) previewVideo.pause()
      card.classList.remove('is-hovering')
    })
  })
}
