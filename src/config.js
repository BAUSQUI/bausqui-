// Which home experience to mount. `?exp=flower` / `?exp=tornado` overrides it for testing.
export const EXPERIENCE = 'tornado'

export function getExperienceName() {
  const fromUrl = new URLSearchParams(window.location.search).get('exp')
  return fromUrl || EXPERIENCE
}
