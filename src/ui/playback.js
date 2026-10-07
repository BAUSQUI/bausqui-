// Playback controls for the project overlay: sound toggle, volume slider,
// timeline scrubber + play/pause. Shared by the native player, the 360° viewer
// and YouTube embeds.
import { tr, I18N } from '../i18n.js'

// Track currently audible video element so the sound-toggle controls the right one
export const playback = {
  currentPlayingVideo: null,
  currentYouTube: null,    // YouTube iframe (when active)
  ytMuted: true,           // tracked separately since iframe state isn't readable
}

export function refreshSoundToggle() {
  const btn = document.getElementById('sound-toggle')
  if (!btn) return
  let muted
  if (playback.currentYouTube) {
    muted = playback.ytMuted
  } else {
    muted = !playback.currentPlayingVideo || playback.currentPlayingVideo.muted
  }
  btn.textContent = muted ? tr(I18N.soundOn) : tr(I18N.soundOff)
  btn.classList.toggle('is-on', !muted)
}

export function ytPostMessage(iframe, func, args) {
  if (!iframe || !iframe.contentWindow) return
  iframe.contentWindow.postMessage(JSON.stringify({
    event: 'command',
    func: func,
    args: args || []
  }), '*')
}

// ── VOLUMEN ──────────────────────────────────────────
let volumeValue = 0.5

export function setVolume(v) {
  volumeValue = Math.max(0, Math.min(1, v))
  const pct = volumeValue * 100
  const fill = document.getElementById('volume-fill')
  const thumb = document.getElementById('volume-thumb')
  if (fill) fill.style.width = pct + '%'
  if (thumb) thumb.style.left = pct + '%'
  const videoEl = document.getElementById('video-player')
  if (videoEl) videoEl.volume = volumeValue
  // Also adjust the active 360 video if any
  if (playback.currentPlayingVideo && playback.currentPlayingVideo !== videoEl) {
    playback.currentPlayingVideo.volume = volumeValue
  }
}

export function initVolume() {
  const volumeControl = document.getElementById('volume-control')
  const volumeTrack = document.getElementById('volume-track')
  if (volumeControl && volumeTrack) {
    let dragging = false
    const updateFromEvent = (e) => {
      const rect = volumeTrack.getBoundingClientRect()
      setVolume((e.clientX - rect.left) / rect.width)
    }
    // Pointer events cover mouse + touch + pen with one API
    volumeTrack.addEventListener('pointerdown', (e) => {
      dragging = true
      volumeTrack.setPointerCapture?.(e.pointerId)
      updateFromEvent(e)
    })
    window.addEventListener('pointermove', (e) => { if (dragging) updateFromEvent(e) })
    window.addEventListener('pointerup', () => { dragging = false })
    window.addEventListener('pointercancel', () => { dragging = false })
    setVolume(0.5)
  }
}

// ── TIMELINE / VIDEO SCRUBBER ───────────────────────
function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r < 10 ? '0' : ''}${r}`
}

export function updateTimelineUI() {
  const v = document.getElementById('video-player')
  if (!v) return
  const timelineFill     = document.getElementById('timeline-fill')
  const timelineThumb    = document.getElementById('timeline-thumb')
  const timelineCurrent  = document.getElementById('timeline-current')
  const timelineDuration = document.getElementById('timeline-duration')
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

export function initTimeline() {
  const timelineTrack = document.getElementById('timeline-track')

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
    const endDrag = () => {
      if (!dragging) return
      dragging = false
      const v = document.getElementById('video-player')
      if (wasPlaying) v?.play().catch(() => {})
    }
    timelineTrack.addEventListener('pointerdown', (e) => {
      const v = document.getElementById('video-player')
      if (!v) return
      dragging = true
      timelineTrack.setPointerCapture?.(e.pointerId)
      wasPlaying = !v.paused
      v.pause()
      seek(e)
    })
    window.addEventListener('pointermove', (e) => { if (dragging) seek(e) })
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }
}

// ── SOUND TOGGLE ───────────────────────────────────────
export function initSoundToggle() {
  document.getElementById('sound-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation()

    // YouTube path — control via postMessage
    if (playback.currentYouTube) {
      playback.ytMuted = !playback.ytMuted
      if (playback.ytMuted) {
        ytPostMessage(playback.currentYouTube, 'mute')
      } else {
        ytPostMessage(playback.currentYouTube, 'unMute')
        ytPostMessage(playback.currentYouTube, 'setVolume', [60])
        ytPostMessage(playback.currentYouTube, 'playVideo')
      }
      refreshSoundToggle()
      return
    }

    // Native video path
    const v = playback.currentPlayingVideo
    if (!v) return
    v.muted = !v.muted
    if (!v.muted && v.volume === 0) {
      v.volume = 0.5
      setVolume?.(0.5)
    }
    v.play?.().catch(() => {})
    refreshSoundToggle()
  })
}
