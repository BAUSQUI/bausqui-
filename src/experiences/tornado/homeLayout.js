import './homeLayout.css'

// Tornado home: a 100vh hero (the fixed canvas shows through it) followed by the
// works list, which scrolls up over the tornado on a solid background.
// The existing project cards become the list rows, so their IDs and overlay routing
// stay intact. `onHeroVisibility(visible)` reports whether at least 10% of the hero
// is on screen, so the experience can pause its update loop and RC passes.
export function mountTornadoHome(renderer, { onHeroVisibility } = {}) {
  document.body.classList.add('tornado-home')
  renderer.domElement.classList.add('tornado-canvas')

  const hero = document.createElement('section')
  hero.className = 'tornado-hero'
  // Scroll hint: three stacked chevrons, no text (no data-es/en, so the language toggle
  // never writes into it)
  const hint = document.createElement('button')
  hint.type = 'button'
  hint.className = 'tornado-scroll-hint'
  hint.setAttribute('aria-label', 'Ver trabajos')
  const chevron = '<svg viewBox="0 0 14 8" aria-hidden="true"><path d="M1 1l6 6 6-6"/></svg>'
  hint.innerHTML = chevron.repeat(3)
  hero.append(hint)

  const list = document.querySelector('.proyectos-grid')
  list.before(hero)
  const onHint = () => list.scrollIntoView({ behavior: 'smooth' })
  hint.addEventListener('click', onHint)
  // The chevrons fade out once the user starts scrolling (and come back at the top).
  // Mobile: once the list reaches the fixed logo + nav, they get a solid bar behind them
  // (homeLayout.css), sized to the header's bottom edge.
  const header = [document.querySelector('.logo-container'), document.querySelector('.nav-grid')]
  const onScroll = () => {
    hint.classList.toggle('is-scrolled', window.scrollY > 8)
    const headerBottom = Math.max(0, ...header.map(el => el?.getBoundingClientRect().bottom ?? 0)) + 10
    document.body.style.setProperty('--home-header-h', `${Math.round(headerBottom)}px`)
    document.body.classList.toggle('is-list-under-header', list.getBoundingClientRect().top < headerBottom)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // Pause the tornado when less than 10% of the hero is visible
  const observer = new IntersectionObserver(([entry]) => {
    onHeroVisibility?.(entry.intersectionRatio >= 0.1)
  }, { threshold: [0, 0.1, 0.2] })
  observer.observe(hero)

  const cleanups = []
  document.querySelectorAll('.proyecto-card').forEach(card => {
    const oldRole = card.getAttribute('role')
    const oldTabIndex = card.getAttribute('tabindex')
    card.dataset.layout = 'row'
    card.setAttribute('role', 'button')
    card.tabIndex = 0
    const action = card.querySelector('.card-details')
    const originalAction = action?.innerHTML
    if (action) {
      // The arrow is an inline SVG (a unicode ↗ turns into a blue emoji on iOS); the language
      // toggle only rewrites the text span next to it
      const en = window.getLang?.() === 'en'
      action.innerHTML = `<span data-es="Ver proyecto" data-en="View work">${en ? 'View work' : 'Ver proyecto'}</span> <svg class="icon icon-arrow" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 8L8 2M3.5 2H8v4.5"/></svg>`
    }
    const onKey = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      card.click()
    }
    card.addEventListener('keydown', onKey)
    cleanups.push(() => {
      delete card.dataset.layout
      card.removeEventListener('keydown', onKey)
      if (oldRole === null) card.removeAttribute('role')
      else card.setAttribute('role', oldRole)
      if (oldTabIndex === null) card.removeAttribute('tabindex')
      else card.setAttribute('tabindex', oldTabIndex)
      if (action) action.innerHTML = originalAction
    })
  })
  return {
    hero,
    dispose() {
      observer.disconnect()
      hint.removeEventListener('click', onHint)
      window.removeEventListener('scroll', onScroll)
      document.body.classList.remove('is-list-under-header')
      document.body.style.removeProperty('--home-header-h')
      cleanups.forEach(cleanup => cleanup())
      hero.remove()
      document.body.classList.remove('tornado-home')
      renderer.domElement.classList.remove('tornado-canvas')
    },
  }
}
