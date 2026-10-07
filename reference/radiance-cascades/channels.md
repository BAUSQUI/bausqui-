# Radiance Cascades (Shadertoy mtlBzX, fad) — channel bindings

Derived from what each pass reads in its code.
Filter and wrap settings are inferred from how each channel is sampled (marked "inferred").

## Pass order (per Shadertoy frame)

Buffer A → Buffer B → Cube A → Image

## Bindings

| Pass     | iChannel0        | iChannel1        | iChannel2 | Output                     |
|----------|------------------|------------------|-----------|----------------------------|
| Buffer A | Buffer A (self)  | —                | Keyboard  | 2D, float RGBA             |
| Buffer B | Buffer A         | Buffer B (self)  | Keyboard  | 2D, float RGBA             |
| Cube A   | Cube A (self)    | Buffer B         | Keyboard  | Cubemap, float RGBA        |
| Image    | Cube A           | Buffer B         | Keyboard  | Screen                     |

The `common.glsl` tab is prepended to every pass. It declares `iChannel2` (keyboard)
and defines `cubemapFetch`, `cascadeFetch`, `sampleDrawing` and `sdDrawing`.

## What each channel carries

**Buffer A (smoothed mouse).** Only texels (0,0), (1,0) and (2,0) are meaningful: they hold
the mouse history A, B and C (xy = position, zw = click state). All reads use `texelFetch`,
so filtering is irrelevant. When there is no mouse, it falls back to an autonomous
Lissajous path, flagged with `z = MAGIC`.

**Buffer B (drawing).** Full-screen 2D texture.
- `r` = signed distance to the drawn strokes, in pixels.
- `gba` = emissivity (RGB).

It accumulates over frames by reading itself through `iChannel1`. It is sampled with
`texture()` inside `sampleDrawing()`, so it needs **linear** filtering (inferred) and
**clamp** wrap (inferred).

**Cube A (cascades).** All cascades packed linearly into the 6 faces of one cubemap, as a
memory trick:
- Cascade 0 has spatial resolution `c0_sRes` and 1 direction per texel group.
- Each cascade n > 0 has spatial resolution `c0_sRes >> n` and
  `cn_dRes = c_dRes << 2*(n-1)` directions.
- The offset of each cascade is defined in `cascadeFetch()` (`common.glsl`).

The cubemap is read via `cubemapFetch()`, which samples at exact texel centers. Bilinear
interpolation between probes is done **manually in code** (the S0..S3 mixes), so the cubemap
itself can use nearest filtering (inferred).

It reads itself through `iChannel0` to merge cascade n with cascade n+1. Because this is a
single pass per frame, merging propagates one cascade per frame, which causes the temporal lag.

**Keyboard (iChannel2).** Row 2 holds the toggle state. `KEY_SPACE` (32) switches emissive vs
non-emissive brush, and `KEY_1` (49) switches to a temporary light. **Drop it in the port.**

## Uniforms used

iResolution, iTime, iTimeDelta, iFrame, iMouse

## Port notes (see CLAUDE.md)

- Buffer A is replaced by lazy-brush smoothing in JS (cursor light).
- Buffer B is replaced by scene masks plus jump flood (JFA), packed as `r = sd`, `gba = emissive`.
- Cube A is replaced by one 2D render target per cascade, computed top to bottom in a
  single frame, so there is no temporal lag.
- Keyboard is dropped.
