// ── i18n helper for project data ─────────────────────
export function getLang() {
  return (typeof window !== 'undefined' && window.getLang) ? window.getLang() : 'es'
}
export function tr(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  const lang = getLang()
  return val[lang] ?? val.es ?? val.en ?? ''
}
export const I18N = {
  readMore:    { es: 'LEER MÁS',  en: 'READ MORE' },
  readLess:    { es: 'LEER MENOS', en: 'READ LESS' },
  loading:     { es: 'CARGANDO MANUAL...', en: 'LOADING MANUAL...' },
  drag360:     { es: '↻ ARRASTRÁ PARA EXPLORAR', en: '↻ DRAG TO LOOK AROUND' },
  soundOn:     { es: '● ACTIVAR SONIDO', en: '● ENABLE SOUND' },
  soundOff:    { es: '● SILENCIAR',      en: '● MUTE' }
}
