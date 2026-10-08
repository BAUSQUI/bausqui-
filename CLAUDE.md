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
    Background.js           ← COBALTO landing background: gyroid FBM + error-carry dither
  tornado/
    tornado.glsl            ← raymarched tornado: height twist, x×1.4 stretch, fbm erosion, gusts
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
  (desaturate in the shader with a `uSaturation` uniform, default 0). Thumbnails are crisp and
  never warped; color returns only on the hovered work. This matches the About section, which
  stays exactly as it is.
- **Readable at first glance, lit from within.** The tornado has its own base light (an RC
  ambient): works clearly visible but dimmer than a hovered work. On top of that, two sources
  add light: **the cursor** and **3–5 lights inside the funnel** that drift along the axis,
  pulse out of phase and occasionally flash (lightning in a storm cloud). Their light leaks out
  between the swirl's strokes as rays and brightens the works near a lit zone. Hovering a work
  dims the inner lights to ~40%.
- **The swirl is drawn ink** in the Spider-Man: Across the Spider-Verse FX language:
  hand-drawn effects animation, graphic and crisp, like ink on paper. See "Ink rendering
  rules" (hard rules) and "Ink style" below; references in `reference/style/`.
- **The swirl wraps the works.** The back half of the funnel renders behind the works, the
  front half in front of them (sorted with the works' depth). The works show through the gaps
  between the front strokes. Gusts (smooth noise) make the front strokes denser or sparser,
  never a translucent veil. Hovering a work cuts a ragged hole in the front strokes around it
  (~1.5× the work, growing in ~300ms and closing the same way).
- **Smooth, continuous motion.** Tornado transforms update every frame from a dt-based clock
  (speed independent of frame rate). Do not quantize or step the motion: it reads as lag.
  The one stepped thing is the ink's boil (approved): the stroke DRAWINGS are redrawn in
  discrete states (on twos, ~12/s, toggle + rate control), never the movement.
- **Cursor light follows with lag.** Port the lazy-brush smoothing from `buffer-a.glsl` to JS
  (`RADIUS`, `FRICTION`, frame-rate independent easing). No buffer pass needed for this.
  **Default (keep):** a subtle light, not a spotlight: intensity = `CURSOR_LIGHT_MIN` (1), the
  minimum of the panel's range. It is off until the pointer enters, then fades in over 400ms
  up to that value (never above it); on leave it holds its position and fades out.
- **Content.** Each project contributes several frames (thumbnails from `public/thumbs/`), so
  9 projects × 6 frames ≈ 54 planes. Every plane maps back to its project id.

### Ink rendering rules (hard rules: never regress)

A previous version warped/advected the rendered ink with noise and a fluid sim. It read as
Photoshop's "Liquify" (smeared, stretched, melted) and was removed entirely. Never go back.

**FORBIDDEN**
- Warping, displacing or advecting the rendered image or its pixels.
- Stretched or smeared textures, blur, motion blur.
- Soft gradients and smudges.
- Any shape that looks melted.

**REQUIRED (Spider-Verse FX language)**
- Each stroke is a DISCRETE DRAWN OBJECT: a ribbon mesh or SDF stroke along a helical path,
  with a width profile (tapered start and end, thick-thin like brush pressure).
- Ink texture (grain, dry-brush breakup) lives in the stroke's own UV space, so it travels
  WITH the stroke and never smears.
- Silhouettes are designed shapes: crescents, commas, teardrops, speed lines, hooks. Edges are
  hard, with an alpha threshold; the only edge breakup comes from dry brush.
- Mid-tones use halftone dots or hatching lines. Never gradients.
- Fast motion uses drawn speed lines and smear frames (drawn multiples of a stroke), never
  motion blur.
- Noise or the fluid sim may only move stroke control points and positions. They never touch
  pixels.
- "Boil": the stroke SHAPES are redrawn in discrete states every 2–3 frames (new noise seed for
  the edges), like hand-drawn animation on twos. The motion and rotation of the tornado stay
  smooth at 60 fps; only the drawing boils. There is a toggle and a boil-rate control.
- Particles in the same style: crisp grain specks (1–2px, hard edges) plus occasional "Kirby
  dot" clusters (small groups of round dots). They flow in a spiral toward the funnel and
  dissolve into the strokes, respawning at the screen edges. Positions move smoothly; only the
  dot shapes boil. Some pass in front of the thumbnails and some behind; the cursor light makes
  nearby ones brighter (bigger, fuller dots, never a glow).
- Style test page: `?debug=ink` (dev only), isolated strokes + particles, no tornado. Judge
  any ink change there first.

### Ink style (from `reference/style/`, keep it)

- **Flat tones only.** Strokes are flat white; the background is the site's #050505. No
  gradients, shading, gloss or glow (anti-aliasing only). Mid-tones (far strokes, depth) are
  halftone dots or hatching in the stroke's own UV space, never a gray fill. The GIF is 89%
  dark, 8% white, under 3% in between.
- **Stroke shape.** Long tapered slivers (blades, commas) aligned with the flow, ~10–30× longer
  than wide, widest near one end or the middle and tapering to needle points. Wide strokes
  split at their tips into 2–3 prongs, like a dry brush running out.
- **Edges.** Hard and crisp, never blurred, but irregular: small notches, chips and sawtooth
  serrations along the length (more on the trailing side). The dry brush is in the outline,
  not in a texture.
- **Texture.** Solid white inside strokes; no grain, paper or pooling. A few black sliver gaps
  inside wide strokes, and sparse white specks near strokes (splatter).
- **Motion.** Strokes travel along the swirl's paths and their drawings "boil": redrawn at
  ~12/s (the GIF animates on twos at 25 fps), so tips appear and vanish while the composition
  holds. No smearing; fast strokes get speed lines and drawn multiples.
- **Composition.** Strokes follow the swirl concentrically, with lots of black between them
  (gaps at least as wide as strokes). Depth comes from weight and density, not tone: thick
  dense strokes in front, thin sparse dashes on the far side.
- **Light is drawn too** (the manga reference): a strong light becomes a flat white flare with
  a ragged, spiky edge, cut by black rays; strokes over it turn black, ink against the light.
- **Stroke variety.** Three scales mixed: a few large heavy masses of ink that dominate the
  shape, medium strokes, and many fine threads and filaments. Within each stroke the width
  varies along its length (tapering at both start and end), and the ink load varies: some
  strokes dense and wet, others dry and broken. Some strokes split into several filaments and
  occasionally fling small flecks outward, tangentially. No two neighbouring strokes share the
  same width, length or speed.
- **Tornado motion.** A voluminous mass rotating in depth, not strokes sliding sideways.
  "Volume" means form and motion, never shading.
  - Strokes follow helical paths around the funnel, rising as they rotate; curved, never
    straight bands.
  - Depth reads clearly: front strokes are wider and move one way across the screen; back
    strokes are thinner, dimmer (halftone) and move the opposite way; strokes compress at the
    sides where they turn. That opposite motion is what sells the rotation.
  - Differential rotation: speed changes with height and per layer, so strokes shear against
    each other instead of turning as one rigid block.
  - The funnel axis is alive: it bends and sways slowly like a snake, and the radius
    breathes. Narrow and dense at the bottom, fanning out wide at the top.
  - Occasionally a stroke breaks away from the funnel and is thrown outward before it
    dissipates.

### The rescue interaction

1. **Hover on a thumbnail** (raycast against the current positions): the tornado decelerates to
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
      TornadoExperience.js    scene, continuous dt-based clock, hero-visibility pause, wires the rest
      tornadoLayout.js        helix/funnel math (+ capture entrance, turbulence); the live axis
                              (axisOffset) and radius breathing shared by works, lights, strokes
      inkNoise.js             hash / value noise shared by the ink shaders
      innerLights.js          lights inside the funnel: axis drift, pulses, random flashes
      inkTornado.js           the swirl: ~200 discrete strokes (3 scales) on helical paths around
                              the live axis, moved only by their control points (rise, differential
                              rotation, wobble, collisions with the works); near / far depth per
                              point; thrown strokes with drawn multiples + speed lines; flecks;
                              particles spiralling in. Renders via ink/inkStrokes + inkParticles.
                              (The old warp-based swirl — VortexBackground, FunnelFluid,
                              flungStrokes — was removed for good.)
      debris.js               thin strips inside the funnel: the RC occluders
      TornadoLighting.js      renders albedo (+ depth) / swirl layers / occluders (debris + strokes) /
                              emissive (cursor + inner lights) / hovered work, then runs
                              RadianceCascades; owns the look params, gusts and the light flare
      workHover.js            hover / label / click (replaces the planned rescue.js, see below)
      clickTransition.js      click: impact frames → burst → focus → handoff; reverse on return;
                              input blocking, video preload
      tornadoAudio.js         Web Audio engine: 3 stems (music-port + 2 tornado), calm / duck states, ramps
      inkEye.js               "eye of the storm": the light mode behind an open project (edge ring
                              of strokes + particles, calm zone around the content, scroll link)
      homeLayout.js/.css      100vh hero + works list below, page scroll, hero IntersectionObserver
      rc/
        RadianceCascades.js   render-target management + passes
        LazyLight.js          cursor light with lazy-brush lag (port of buffer-a.glsl)
        shaders/*.glsl
    ink/
      inkStrokes.js           strokes as discrete ribbon meshes along caller-moved control
                              points: designed width profiles (crescent, comma, teardrop, speed
                              line, hook) × brush pressure, hard edges, dry brush + filament splits
                              + halftone in stroke UV, boiled drawing (toggle + rate)
      inkParticles.js         grain specks + Kirby dot clusters spiralling inward, boiling dots
      InkTestExperience.js    `?debug=ink` style test page (dev only)
```

Each experience owns its own exit transition before calling `ctx.openProject(id)`. The flower
keeps its camera trip; the tornado opens the project directly on click (hover already isolates
the work, see "Tornado home" below).

### Tornado home (supersedes parts of Checkpoints 5 and 7)

- **Hero (100vh):** the tornado is centered and fills ~85% of the viewport height. Logo top-left,
  nav top-right, sound bottom-left, ES/EN bottom-right, and bottom-center a scroll hint: three
  small stacked chevrons, no text (`aria-label="Ver trabajos"`), white 1px stroke, ~14px wide, fading
  in one after the other top to bottom in a slow loop (static with reduced motion); click =
  smooth scroll to the works list; they fade out once the page scrolls and are hidden while a
  project or About is open.
- **Hover replaces the Checkpoint 5 rescue** (no detach, elastic squash or full-screen transition):
  raycast the thumbnails at their current positions (closest wins) → the tornado decelerates to a stop → the work is
  shown at full brightness in the composite only (not injected as an emitter), the front
  strokes open around it and the inner lights dim → its title (Helvetica bold, 7vw), category and year pills appear at the screen edge
  opposite the work, linked by a 1px line → 150ms grace on leave, then fade and spin up.
  **Label defaults (keep):** title `clamp(40px, 4vw, 72px)`; always 35px from the screen edge;
  pills at 0.2× the title size (em-based); the connector stops 0.3× the title size short of
  the label.
  Click opens the project through the click transition below. Touch: first tap = hover,
  second tap = open.
- **Click transition (replaces the "thumbnail grows to fill the screen" handoff;
  `clickTransition.js`, all timings in lil-gui):**
  1. Impact (0–80ms): 1–2 drawn impact frames in the composite — a hard two-tone
     silhouette frame, then an inverted one. Capped below white (silhouette ≤ 0.82, inverted
     field ≤ 0.45) and never repeated: photosensitivity. No white fade.
  2. Burst (80–700ms): every stroke's control points fly along the spin and outward
     (InkTornado.burst), thinning and splitting, with drawn multiples + speed lines; particles
     scatter radially and shrink; every other work is flung out, tumbling; inner lights go out.
  3. Focus (300–1000ms): the clicked work flies to a camera-facing pose that covers the view
     and goes to full brightness, in color (the highlight pass).
  4. Handoff (1000–1200ms): the project overlay fades in. The video starts loading at the
     click.
  While the project is open, the "eye of the storm" (below) is behind it. Return: as soon as
  the overlay starts closing (fading out), the same burst runs in reverse (~1s) under it: the
  video gives way to its thumbnail shrinking back into its slot, the eye's ring hands over to
  the tornado's strokes, which are drawn at the edges from the first frame, and strokes and
  particles
  spiral back in and the works return to their slots. Hover, clicks and scroll (wheel / touch /
  keys) are blocked during the explosion and the reassembly. A list-row click explodes only
  if the hero is visible; otherwise, and with `prefers-reduced-motion`, the overlay simply
  fades in and out.
- **Works list:** the existing project cards, restyled as rows, sit below the hero on #050505 and
  scroll up over the fixed canvas. **This list replaces the grid planned in Checkpoint 7.**
  The tornado's update loop and RC passes pause while the hero is <10% visible.
- The page scrolls on the tornado home; the overlays lock it and keep their own scroll.
- The home UI (scroll hint, hover label, connector) is hidden while a project is open.
- **Loader: the tornado assembling itself** (index.html inline tracker + TornadoExperience).
  No separate screen, no cut: the loader is text over the canvas, and the assembled tornado
  becomes the home. (The old blue bokeh / giant-percentage loader was removed.)
  - Load order: the core first (renderer, ink strokes, particles = the first rendered frame);
    until then only the text on #050505. Then thumbnails and the audio stems, each its own
    asset (`__loader.add / done / seal`). Progress = done weight / total weight: REAL, never
    faked; the loader can't complete before the experience seals it.
  - Assembly mapped to the (smoothed) real progress, drawn ink: 0–30% grain + Kirby dots
    spiral in from the screen edges; 30–80% strokes form around the funnel from the bottom
    up; each thumbnail eases into its slot (no overshoot) when its image actually loads; at
    100% the tornado is complete and eases into its normal rotation (the clock is frozen until
    then). This replaces the old intro where the works flew in from outside (captureSpread 0).
  - Calm: slow, soft motion; no lightning flashes, thrown strokes or flecks while assembling.
  - Text centered under the tornado, logo-block small caps: "BAUSQUI — PORTFOLIO" + a small
    % counter; the four corner labels in white / gray.
  - **No gate, no buttons of any kind.** At 100% the counter rests ~0.7s, then the text and
    corner labels fade out, the tornado starts turning and the home UI (logo, nav, hint,
    toggles, list) fades in around it: the user is in, automatically.
  - Audio start (values untouched): at 100% the engine starts right away (resume + fade in).
    If the browser keeps the AudioContext suspended, the first pointerdown / keydown /
    touchend anywhere resumes it (passive: the click isn't consumed; a click on the music
    toggle waits for the toggle so turning it off never blips); meanwhile the toggle's
    waveform pulses slowly. The music toggle is the only way to turn the sound off.
  - Robustness: any asset that fails or takes >8s is marked done with a warning (never stuck).
    Media guard (`?mute=1` / webdriver): the sound never starts (toggle off). Reduced motion:
    no assembly; the loader stays opaque until done, then fades to the finished tornado.
- Nav cards on the tornado home: no fill, no blur, no stroke at rest (only text and pills). On
  hover a 1px white stroke fades in (200ms) around the hovered card only, via a border that is
  always there but transparent at rest (`homeLayout.css`); the title keeps its slide and uses a
  difference blend so it stays legible over ink.
- No cursor-canvas particle bursts anywhere (the old radial exit burst was removed).
- **Icons are inline SVG, never unicode symbols** (`.icon` in `style.css`: `currentColor`
  stroke, ~10px): iOS renders emoji-capable characters such as ↗ and ▶ as color emoji.
  Translated text sits in its own `data-es`/`data-en` span next to the SVG, so the language
  toggle (which rewrites innerHTML) never removes the icon. Plain ←↑→↓, ● and © are safe text.
- Mobile works list: bottom padding clears the fixed sound / language toggles (+ safe area);
  once the list reaches the fixed logo + nav, a solid #050505 bar fades in behind them
  (`body::before`, height = the header's bottom, toggled by `is-list-under-header`).
- **Sound** (`tornadoAudio.js`, Web Audio API, never `<audio>` elements):
  - Three stems, each with its own gain into the master (→ analyser → destination):
    `/music-port.mp3` (the MAIN ambient bed, always playing), `/music-tornado.mp3` (tornado
    layer) and `/music-tornado-details.mp3` (a short tornado loop).
  - Different lengths are intentional: each stem loops on its own length (its own
    AudioBufferSourceNode, `loop = true`); all start at the same AudioContext time. The lengths
    are never checked, warned about or required to match.
  - Starts on the first gesture (pointerdown / keydown / touchend; mousemove doesn't count);
    master fades in over ~1.5s. The bottom-left music toggle (music.js) drives the master and
    its waveform reads the engine's analyser; `<audio id="bg-music">` stays silent on the
    tornado home (the flower keeps it).
  - Home, idle: all three play.
  - The storm calms while a work is hovered (incl. its 150ms leave delay), while
    About/Vision/Contact is open and during the click explosion: both tornado stems fade out
    (~600ms) and only music-port remains; they come back over ~1.2s. No filter.
  - Inside a project: both tornado stems muted; music-port ducks to ~15%, and to 0 while the
    project video's own sound is on. On close everything comes back with the slow fades.
  - Every change is a ramp (setTargetAtTime / linearRampToValueAtTime), never a jump.
  - Hidden tab: the AudioContext is suspended, and resumed when visible.
- **Project overlay background: the "eye of the storm"** (`inkEye.js`). No project video /
  thumbnail behind the overlay: the viewer is inside the tornado, in its calm center.
  - Base #050505. A ring of drawn-ink strokes circulates around the screen edges in the
    tornado's direction (clockwise on screen), same renderer and rules, but calmer: fewer
    (62; ~half on mobile), slower, a flat dimmer white (0.62, ~25–30% under the overlay's
    veil). Denser toward the corners, thinning toward the center. Sparse, faint particles
    and a few Kirby dots orbit slowly.
  - Calm zone: around the overlay content in view (video, controls, text, manual, embed): a
    superellipse (exponent 4, a squarer ellipse) through the content box's corners plus 24px.
    Stroke control points get zero width inside it, fading in across an 18% border band;
    particles vanish there too. Nothing crosses the content. It follows the scroll.
  - Scroll link: scrolling toward the manual turns the storm a little further (0.0006 rad/px).
  - Continuity: on open the ring settles in from outside (the click burst slowing into orbit);
    on close it pulls inward and fades while the tornado reassembles from the edges.
  - Performance: while a project is open the full tornado (works, RC, collisions) is paused;
    only the eye renders (no RC).

---

## Dev & testing rules

- **Media guard** (`src/ui/mediaGuard.js`): with `navigator.webdriver === true` or `?mute=1`,
  no audio at all: no stems engine (no AudioContext, nothing decoded), no background music, and
  the project video's sound toggle stays muted. Test pages with `?mute=1`.
- Never leave a dev server or browser tab of yours running (they replay audio on reload).

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
   (0 in the RC test; the tornado uses it as its base light).
5. **Emissivity**: remove the hue cycling (`getEmissivity`) and use white with a `uLightIntensity`
   uniform.
6. **Composite**: `final = albedo × fluence + emissive`, then the reference tonemap, output
   grayscale. In the tornado, layered back to front: light flare (light above the ambient,
   thresholded flat white with a ragged edge) → back strokes → lit works (`× thumbBrightness`)
   → hovered work → front strokes. Strokes are flat `swirlBrightness` white, black inside the
   flare; they are never lit with gradients. Lit zones make strokes fatter instead (the swirl
   shader reads last frame's cascade 0). Inner-light discs write alpha 0 in the emissive
   buffer, so they're seen only through the light they cast (the cursor disc stays visible).

### Occlusion

If thumbnails are occluders, their interiors render black (rays start inside them). So by default:

- **Thumbnails are receivers, not occluders.**
- Occluders are a separate layer of thin graphic debris swirling inside the tornado (bars, lines,
  small strips). They cast hard shadow streaks through the cursor light.
- The thick bodies of the front strokes are occluders too (`strokeShadows`), so the inner light
  leaks out between them as rays.
- Add a `thumbsOcclude` toggle so I can try the other option.

### Ink swirl (drawn strokes)

- The tornado is built from `experiences/ink` strokes: ~200 discrete strokes on helical paths
  around the live axis (stroke variety + tornado motion above), batched in one mesh.
- Depth split, hover hole, internal lights and collisions are applied per STROKE / per
  fragment of a stroke (positions, widths, which layer it's drawn in), never by warping the
  image: layer 0 = stroke fragments behind a work, 1 = the rest, 2 = near-side stroke bodies
  as RC occluders. Each control point carries its depth around the axis (0 near, 1 far):
  near strokes wider, far ones thinner and halftone.
- Collisions: the works push stroke control points aside and drag them along a little
  (a wake); only control points move.
- Thumbnails stay grayscale and crisp; the composite grades to gray before mixing in the
  hovered work, which renders in color.

---

## Checkpoints (stop and wait for approval after each one)

**0. Read and plan.** Read `reference/` and the current `src/`. Summarize the channel graph, the
cascade memory layout, and your 2D atlas/per-cascade target plan. No code yet.

**1. Refactor, no visual changes.** Do the module split with the flower as the active experience.
- *Done when:* flower, card clicks, camera trip, project overlay, manual scroll, scroll-to-close,
  volume, About/Vision/Contact, cursor and logo scramble all behave exactly as before.

**2. Tornado geometry, no RC.**
- Thumbnail planes on a funnel helix (radius grows with height), grayscale, continuous motion.
- Add lil-gui controls: plane count, base radius, top radius, height, spin speed.
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
- `prefers-reduced-motion`: just a slower spin.

---

## Progress (as of 2026-10-08)

- **0–5 done and approved:** module split (flower intact), tornado geometry, RC standalone
  (`?exp=rc-test`, dev only), integration, rescue interaction.
- **Beyond the original plan (approved):** drawn-ink tornado (Spider-Verse ink rules above,
  `?debug=ink` dev page), inner lights, click transition (explode → handoff → reassemble with
  impact frames), eye-of-the-storm project background, 3-stem sound design (audio values
  locked), loader = the tornado assembling itself (no gate, auto-enter, sound starts at 100% or
  on the first gesture), works list in the page flow, chevron scroll hint, nav cards with
  hover-only stroke.
- **6. Polish — partial:** `?exp=` switch and reduced motion done; touch = tap to light, tap
  again to open. Still open: RC quality tiers, the spotlight fallback when float targets are
  unsupported (today: unlit tornado + a warning).
- **Live home:** `src/config.js` defaults to `'tornado'` (`?exp=flower` still shows the flower).
- Pre-commit checks passed (build, `vite preview` with no console errors on home / About /
  works list / project; lil-gui, buffer selector, `?debug=ink`, `?exp=rc-test` are dev-only
  and absent from `dist/`). See `HANDOFF.md` for the current state and next steps.

---

## Constraints

- Vanilla JS + Vite, as in the current repo. Do not convert to TypeScript.
- Allowed new dependencies: `lil-gui` (debug only, stripped in production) and `gsap`.
  Do not add cannon-es.
- Do not change the look or behavior of the About/Vision/Contact overlay or the project overlay.
- Do not change project texts or data content; only restructure them.
- Edit with targeted changes. Do not rewrite files unrelated to the current checkpoint.
