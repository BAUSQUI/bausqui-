# BAUSQUI — Tornado Experience (Claude Code plan)

## Context

BAUSQUI is my portfolio (Vite + vanilla JS + Three.js). The current home is a particle flower
over a 3D body scan; clicking a project card triggers a camera trip and opens a project overlay
(video + abstract + brand manual frames scrolling below). About / Vision / Contact live in an
info overlay.

We are replacing the flower with a new home experience: a **tornado of my works**, lit with
2D radiance cascades (the same shader used in my COBALTO landing). The flower must NOT be
deleted: the site should be able to switch between experiences in the future.

Work through the checkpoints below in order. **Stop after each checkpoint, summarize what you
did and how to test it, and wait for my approval before continuing.**

---

## Prerequisites (already set up manually before running this)

```
reference/
  radiance-cascades/        ← Shadertoy mtlBzX (fad), copied tab by tab
    common.glsl
    buffer-a.glsl
    buffer-b.glsl
    cube-a.glsl
    image.glsl
    channels.md
  cobalto/
    PhysicsWorld.js         ← only for the squash + elastic recovery feel
public/
  thumbs/<video-name>/01.jpg … 06.jpg   ← frames extracted from each project video
```

`channels.md` (Shadertoy bindings):

| Pass     | iChannel0          | iChannel1          | iChannel2 |
|----------|--------------------|--------------------|-----------|
| Buffer A | Buffer A (self)    | —                  | keyboard  |
| Buffer B | Buffer A           | Buffer B (self)    | keyboard  |
| Cube A   | Cube A (self)      | Buffer B           | keyboard  |
| Image    | Cube A             | Buffer B           | keyboard  |

---

## Creative direction

- **Black and white only.** Black background, white light, grayscale thumbnails
  (desaturate in the shader with a `uSaturation` uniform, default 0, so color can return later).
  This matches the About section, which stays exactly as it is.
- **Darkness by default.** The tornado sits mostly in shadow. **The cursor is the light
  source.** Works only become visible where the cursor's light reaches: the mouse is
  "rescuing" them from the dark.
- **Cursor light follows with lag.** Port the lazy-brush smoothing from `buffer-a.glsl` to JS
  (`RADIUS`, `FRICTION`, frame-rate independent easing). No buffer pass needed for this.
- **Lowframe.** Tornado transforms advance in quantized steps (~12 fps, configurable). The cursor
  light and the RC lighting run at full frame rate. That contrast is the graphic look.
- **Content.** Each project contributes several frames (thumbnails from `public/thumbs/`), so
  9 projects × 6 frames ≈ 54 planes. Every plane maps back to its project id.

### The rescue interaction

1. **Hover on a thumbnail** (raycast against the *stepped* positions): the tornado decelerates to
   a stop (~0.8s ease-out).
2. The hovered thumbnail becomes **emissive**, detaches from the funnel, moves toward the camera
   and scales up.
3. A label appears next to it, using the existing card style (`.card-tag` pill, year, title).
4. On arrival, apply a squash + elastic recovery (feel taken from `PhysicsWorld._onContact`:
   ~15% squash, `elastic.out(1, 0.4)`). Use gsap only; do NOT port cannon-es.
5. **Click**: the rescued thumbnail scales to fill the screen, then hand off to the existing
   project overlay (video + manual).
6. **Mouse leaves**: the thumbnail returns to its slot and the tornado spins back up.

---

## Architecture

Today `src/main.js` is a monolith (flower, overlays, cursor, volume, logo scramble, project data).
Split it like this:

```
src/
  main.js                     boot: read config, mount UI, mount experience
  config.js                   export const EXPERIENCE = 'tornado'   // or 'flower'
                              URL param ?exp=flower overrides it (for testing)
  data/projects.js            single source of truth: merge `proyectos` + `proyectosExtra`
                              into one list keyed by id. Each project gets:
                              thumbs: { folder, count },
                              flower: { icosphere } (for the flower's savedViews)
  ui/
    projectOverlay.js         showVideo / hideVideo / loadManual / volume (unchanged behavior)
    infoOverlay.js            About / Vision / Contact (unchanged)
    cursor.js                 custom cursor canvas + exit particles
    logo.js                   BAUSQUI scramble
    nav.js
  experiences/
    Experience.js             interface: init(ctx), update(dt), resize(w,h), dispose(),
                              and calls ctx.openProject(id) when a project is selected
    flower/                   existing flower code, moved as-is
    tornado/
      TornadoExperience.js
      tornadoLayout.js        helix/funnel math + lowframe stepping
      rescue.js               hover / extract / release / click logic
      rc/
        RadianceCascades.js   render-target management + passes
        shaders/*.glsl
```

Each experience owns its own exit transition before calling `ctx.openProject(id)`. The flower
keeps its camera trip; the tornado uses the full-screen thumbnail transition.

---

## Radiance cascades port (key technical notes)

The reference is a **2D screen-space** technique. The tornado is a 3D scene, so the architecture
is: **3D scene → 2D RC post-process**. Do not attempt 3D radiance cascades.

Per frame:

1. **Scene passes**, three outputs (MRT or separate targets):
   - **albedo**: grayscale thumbnails;
   - **occluders**: mask of what blocks light;
   - **emissive**: the cursor light disc at its smoothed position, plus the rescued thumbnail.
2. **SDF**: rasterization gives masks, not distances. Generate the SDF with a **jump flood (JFA)**
   pass at half resolution. Pack it like Buffer B: `r = signed distance`, `gba = emissivity`.
   This replaces Buffer A and Buffer B: no mouse drawing, no keyboard toggles, no `iChannel2`.
3. **Cascades**:
   - The cubemap in the reference is a Shadertoy memory trick. Use **2D render targets**
     instead, and rewrite `cubemapFetch` / `cascadeFetch` addressing for 2D.
   - Use **one render target per cascade**, to avoid reading and writing the same texture.
   - Compute **top cascade down to cascade 0 within the same frame**. The temporal lag in the
     Shadertoy version comes only from Shadertoy's limitations and must not exist here.
   - Use HalfFloat/Float targets with **LINEAR filtering**. Bilinear filtering is load-bearing
     for correctness. Check for WebGL2 + `EXT_color_buffer_float`, and fall back to HalfFloat.
4. **Sky**: remove `integrateSkyRadiance`. The top cascade merges with a uniform `uAmbient`
   (default 0.0, pure black).
5. **Emissivity**: remove the hue cycling (`getEmissivity`) and use white with a `uLightIntensity`
   uniform.
6. **Composite**: `final = albedo × fluence + emissive`, then the reference tonemap, output
   grayscale. This is what makes works visible only where light reaches them.

### Occlusion

If thumbnails are occluders, their interiors render black (rays start inside them). So by default:

- **Thumbnails are receivers, not occluders.**
- Occluders are a separate layer of thin graphic debris swirling inside the tornado (bars, lines,
  small strips, also lowframe). They cast hard shadow streaks through the cursor light.
- Add a `thumbsOcclude` toggle so I can try the other option.

---

## Checkpoints (stop and wait for approval after each one)

**0. Read and plan.** Read `reference/` and the current `src/`. Summarize the channel graph, the
cascade memory layout, and your 2D atlas/per-cascade target plan. No code yet.

**1. Refactor, no visual changes.** Do the module split with the flower as the active experience.
- *Done when:* flower, card clicks, camera trip, project overlay, manual scroll, scroll-to-close,
  volume, About/Vision/Contact, cursor and logo scramble all behave exactly as before.

**2. Tornado geometry, no RC.**
- Thumbnail planes on a funnel helix (radius grows with height), grayscale, lowframe stepping.
- Add lil-gui controls: plane count, base radius, top radius, height, spin speed, step fps.
- *Done when:* `?exp=tornado` shows the tornado and `?exp=flower` still shows the flower.

**3. RC standalone.**
- Port the pipeline with a test scene: static rectangles plus the cursor light with lazy follow.
- Add a debug buffer selector in lil-gui: albedo / occluders / emissive / SDF / cascade n /
  fluence / final.
- *Done when:* light and shadows are stable, with no temporal lag and no smearing.

**4. Integrate.**
- The tornado feeds albedo and the debris feeds occluders; composite as above.
- *Done when:* works are only visible where the cursor light reaches.

**5. Rescue.**
- Implement the full hover / extract / label / elastic / click / release flow described above,
  handing off to the existing project overlay.

**6. Polish.**
- Experience switch via config and `?exp=`.
- Quality tiers: RC resolution scale and cascade count.
- Mobile: tap = rescue, lower resolution, and a simple spotlight fallback if float targets are
  unsupported.
- `prefers-reduced-motion`: no lowframe stepping, slow spin.

---

## Constraints

- Vanilla JS + Vite, as in the current repo. Do not convert to TypeScript.
- Allowed new dependencies: `lil-gui` (debug only, stripped in production) and `gsap`.
  Do not add cannon-es.
- Do not change the look or behavior of the About/Vision/Contact overlay or the project overlay.
- Do not change project texts or data content; only restructure them.
- Edit with targeted changes. Do not rewrite files unrelated to the current checkpoint.
