// Touch devices (CLAUDE.md "Mobile behavior"): detected by input, never by screen width.
// `?touch=1` forces it (testing on a desktop).
export const IS_TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
  new URLSearchParams(window.location.search).get('touch') === '1'
