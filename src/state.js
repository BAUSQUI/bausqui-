// Shared UI state read by overlays, cursor, music, cards and the active experience.
export const state = {
  isVideoMode: false,        // project overlay open
  isInfoMode: false,         // about / vision / contact overlay open
  isExiting: false,          // project overlay is fading out
  currentInfoTarget: null,   // 'about' | 'vision' | 'contact' | null
  musicEnabled: false,
}
