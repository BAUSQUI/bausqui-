# HANDOFF — BAUSQUI tornado home

State as of 2026-10-08. The full spec and the hard rules live in `CLAUDE.md` (read its
"Ink rendering rules" and "Sound" sections before touching the tornado or the audio).

## How to run

```
npm install
npm run dev          # http://localhost:5173/?exp=tornado
npm run build        # → dist/
npm run preview      # serves dist/
```

- `?exp=tornado` / `?exp=flower` picks the home. `src/config.js` defaults to `'tornado'`
  (the live home on bausqui.com).
- `?mute=1` (or `navigator.webdriver`): the media guard; sound never starts. Use it for tests.
- Dev only (stripped from production builds): lil-gui panel, RC buffer selector,
  `?debug=ink` (ink style test page), `?exp=rc-test` (RC standalone).

## What's built

Code lives in `src/experiences/tornado/` (home) and `src/experiences/ink/` (ink strokes +
particles, shared with `?debug=ink`).

| Piece | Files |
|---|---|
| Tornado layout, rescue / hover, works list, chevron hint, nav cards | `TornadoExperience.js`, `tornadoLayout.js`, `workHover.js`, `homeLayout.js/.css` |
| Radiance cascades lighting (cursor light at its minimum by default) | `rc/RadianceCascades.js`, `TornadoLighting.js`, `rc/*.glsl` |
| Drawn-ink tornado (ribbon strokes, 12fps boil, halftone, no warping) | `inkTornado.js`, `inkNoise.js`, `ink/inkStrokes.js`, `ink/inkParticles.js` |
| Inner lights (pulses + flashes, calm while loading) | `innerLights.js` |
| Click transition: impact → explode → project → reassemble | `clickTransition.js` |
| Eye-of-the-storm project background | `inkEye.js` |
| Sound: 3 looping stems, hover calming, project ducking (**values locked**) | `tornadoAudio.js`, `src/ui/music.js` |
| Loader = the tornado assembling, real progress, no gate | inline script in `index.html`, `src/style.css` |
| Media guard | `src/ui/mediaGuard.js` |

The flower experience is untouched and still selectable.

## Open items

- Checkpoint 6 leftovers: RC quality tiers; spotlight fallback when float render targets are
  unsupported (today the tornado renders unlit with a console warning).
- Bundle is one ~845 kB JS chunk (Vite warns above 500 kB). Fine for now; code-splitting the
  flower vs. tornado experiences would cut it.

## Assets / deploy

- No file in the repo is over 50 MB. Largest: `public/AUSQUI_GRIS_1.webm` (49 MB),
  `public/videos/tiempo_real.webm` (40 MB), `public/videos/SOMA.webm` (23 MB).
- `public/` totals ~206 MB (Vercel Hobby limit ~250 MB per deploy; see `DEPLOY.md`).
- `node_modules` and `dist` are git-ignored.

## Working rules (from the owner)

- Never commit or push without explicit approval (pushing deploys bausqui.com).
- Audio values (levels, fades, durations, ducking, routing) are locked.
- Ink rules: no warping/blur/gradients/smudges; strokes are discrete ribbons; the boil is the
  only stepped thing.
- Stop after each change so it can be tested; keep `CLAUDE.md` current.
