// Media guard (CLAUDE.md "Dev & testing rules"): automated browsers (navigator.webdriver)
// and `?mute=1` get no audio at all — no music, no stems, no unmuted video.
export const audioBlocked = (typeof navigator !== 'undefined' && navigator.webdriver === true)
  || new URLSearchParams(window.location.search).get('mute') === '1'
