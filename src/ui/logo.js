// ── LOGO SCRAMBLE ANIMATION ─────────────────────────
export function initLogo() {
  const el = document.getElementById('logo-text')
  if (!el) return

  const FINAL = 'BAUSQUI'
  const GLYPHS = '▓░▒█◆◇○●▼▲►◄+×*#@$%&§¶∆Ωπ∞01234567890ABCDEFXYZ'
  const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

  // scramble TO the final word over `duration` ms
  function scrambleTo(target, duration = 1200) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        // each character locks in at progress = i / target.length
        let out = ''
        for (let i = 0; i < target.length; i++) {
          const charProgress = i / target.length
          if (t > charProgress + 0.15) out += target[i]
          else out += randGlyph()
        }
        el.textContent = out
        if (t < 1) requestAnimationFrame(tick)
        else { el.textContent = target; resolve() }
      }
      requestAnimationFrame(tick)
    })
  }

  // scramble FROM the final word into garbage
  function scrambleAway(duration = 600) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        let out = ''
        for (let i = 0; i < FINAL.length; i++) {
          if (Math.random() < t) out += randGlyph()
          else out += FINAL[i]
        }
        el.textContent = out
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  // hold a fully scrambled state for a moment
  function holdScrambled(duration = 800) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = (now) => {
        let out = ''
        for (let i = 0; i < FINAL.length; i++) out += randGlyph()
        el.textContent = out
        if (now - start < duration) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  async function loop() {
    while (true) {
      await scrambleTo(FINAL, 1200)        // assemble: garbage → BAUSQUI
      await new Promise(r => setTimeout(r, 3500))  // hold the name visible
      await scrambleAway(500)              // glitch out
      await holdScrambled(700)             // chaos
    }
  }
  loop()
}
