# Checkpoint 3 — standalone radiance cascades

Status: user visually reviewed and approved Checkpoint 3 on 2026-10-07.
Checkpoint 4 now connects these passes to the tornado. Do not commit or push.

## Local preview

With Vite running, open its local URL with `?exp=rc-test`.
This mode is development-only and does not initialize music or portfolio UI.
The default experience is still flower; `?exp=tornado` now includes RC lighting.

Move the pointer around the static receivers and thin blockers. The light intentionally
follows with lazy-brush lag; the lighting buffers are all rebuilt within the current frame.
Use the GUI to inspect albedo, occluders, emissive, SDF, cascade n, fluence, and final.
Select a cascade index when viewing cascade n. Disable Move light to freeze the source.

## Pipeline

- Separate albedo, occluder and emissive scene passes.
- Boundary seeds from the combined blocker/emitter mask, then JFA+1 at half CSS resolution.
- Resolve signed distance and nearest-surface emission into RGBA.
- Five independent half-float cascade targets, rendered highest to lowest each frame.
- Direction-major tiles permit hardware bilinear probe interpolation without crossing tiles.
- Cascade 0 is snapped to multiples of 16. Each later cascade has half the spatial
  resolution and four times the directions; its atlas is twice cascade 0's width and height.
- Black ambient default; grayscale albedo times fluence plus emission, reference tonemap.
- Explicit GLSL3 fragment output and distinct top-cascade sampler prevent compilation
  and read/write feedback problems.

## Review checklist

- Inspect every buffer; check for shader/WebGL errors in the console.
- Move the light across both sides of each blocker: shadows should switch immediately,
  without frame-history trails. Lazy pointer motion itself is intentional.
- Freeze the light: lighting should remain stable.
- Resize between landscape and portrait; the emitter should stay circular and follow
  the correct screen coordinates.
- Set intensity and ambient to zero: final output should become black.
- Reopen flower and tornado modes to review their existing behavior.

## Scope

Tornado lighting integration is in ../TornadoLighting.js. Rescue interaction is reserved
for Checkpoint 5. The added tornado reference informs the twisting debris; it does not
replace the supplied radiance-cascades reference.
