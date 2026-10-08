# Checkpoint 4 — tornado lighting integration

Open the local Vite URL with `?exp=tornado`. The default home remains `flower`.
Checkpoint 3's isolated scene remains available in development at `?exp=rc-test`.

The tornado home uses a dedicated upper canvas and a full-width project index below.
Rows reuse the original project routing and bilingual labels, accept click/tap and
Enter/Space, and avoid downloading hover videos. The index scrolls on shorter screens;
mobile rows have 48px minimum tap targets. The camera frames the settled vortex at a
larger scale, with incoming works allowed to enter from outside the hero area.

- Thumbnail colors feed the albedo target, with a depth buffer for correct overlaps.
- Thirty-six thin strips inside the funnel feed the occluder mask.
- Thumbnails and strips move continuously on the same dt-based clock (no frame stepping).
- The lazy cursor light, JFA and radiance cascades update every rendered frame.
- Ambient is zero and output is grayscale by default.
- The gyroid FBM and error-carry dithering from `reference/cobalto/background.js`
  now wrap a rippling tapered surface behind the works. This backdrop is composited
  separately so it remains visible without acting as an RC light source or blocker.
- Works begin outside the funnel and spiral inward with staggered exponential capture,
  then remain in orbit. Use Cobalto vortex / Replay attraction to see the entrance again.
- Pattern brightness, dither size, attraction speed, and starting spread are adjustable.
  Eight distributed work positions influence surface ripples; the original floor's
  22-sphere displacement is adapted rather than copied as a horizontal ground plane.
- Motion now references `reference/tornado/tornado.glsl`: height-dependent twist,
  an elliptical rotating cross-section, traveling gyroid perturbations, and the
  reference's narrow `pow(abs(sin(time)), 30)` pulses. The Cobalto pattern travels
  with the surface. Works have faster orbits, bounded radial gusts, lift and tumbling;
  Motion speed and Turbulence control their shared motion with the surface.
- The development GUI includes all debug buffers and a thumbnails-block-light toggle,
  off by default. Turning it on intentionally darkens thumbnail interiors.
- Opening an overlay clears the tornado and suspends its RC passes until returning home.
- Devices without supported float render targets retain the unlit geometry preview;
  the spotlight fallback and quality tiers belong to Checkpoint 6.

## Review

Use Buffer = final, then move the cursor over the funnel. Works should emerge from
darkness while thin debris casts moving shadow streaks. Buffer = albedo should show
the thumbnail images; occluders should show only strips unless the toggle is enabled.
Set ambient, light intensity, and pattern brightness to zero to see a black final frame. Try resizing and
opening/closing project and information overlays. Existing project cards still open
their projects directly; the thumbnail rescue interaction is Checkpoint 5.

Stop for user review before Checkpoint 5. No commits or pushes until authorized.
