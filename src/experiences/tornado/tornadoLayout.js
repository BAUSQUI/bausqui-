// Funnel-helix layout for the tornado.
// Pure math: no scene objects, so the same transforms drive rendering now and
// raycasting.

export const DEFAULT_PARAMS = {
  count: 48,          // number of thumbnail planes
  baseRadius: 0.45,   // funnel radius at the bottom
  topRadius: 3.0,     // funnel radius at the top
  height: 6.0,        // funnel height
  turns: 3,           // helix turns from bottom to top
  strands: 3,         // interleaved helices, so the planes fill the funnel's volume
  spinSpeed: 1.0,     // angular speed, rad/s
  motionSpeed: 1.2,   // shared clock for surface and works
  turbulence: 1.0,    // bounded bending, radial gusts and vertical lift
  planeWidth: 0.9,    // thumbnail width in world units (16:9)
  saturation: 0,      // 0 = grayscale, 1 = original color
  attraction: 0.65,   // exponential capture rate toward the vortex
  captureSpread: 2.2, // starting distance outside the funnel, in world units
  axisSway: 1.0,      // the funnel axis bends and sways slowly, like a snake
  breathe: 0.07,      // the radius breathes in and out
}

const TAU = Math.PI * 2
const FUNNEL_CURVE = 1.6     // >1 flares the funnel toward the top

// The funnel's live axis at height h (0 bottom .. 1 top) and clock (time × motionSpeed):
// a slow snake-like sway, stronger higher up. Shared by the works, the inner lights,
// and (when the tornado is rebuilt from drawn strokes) the ink strokes, so everything
// bends together.
export function axisOffset(h, clock, p) {
  const a = Math.pow(Math.max(h, 0), 1.3) * p.axisSway
  return [
    a * (0.55 * Math.sin(h * 2.3 - clock * 0.31) + 0.25 * Math.sin(h * 4.7 + clock * 0.53)),
    a * (0.4 * Math.cos(h * 2.0 - clock * 0.27) + 0.2 * Math.sin(h * 5.3 - clock * 0.41)),
  ]
}
// Radius breathing (multiplier), mirrored in the shell's vertex shader
export function breath(h, clock, p) {
  return 1 + p.breathe * Math.sin(clock * 0.7 - h * 3.0)
}

// Deterministic per-slot noise so a rebuild keeps the same arrangement
function hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Static properties of each slot along the helix (bottom → top)
export function createSlots(count, turns, strands = 1) {
  const slots = []
  for (let i = 0; i < count; i++) {
    const t = Math.min(1, Math.max(0, (i + 0.5) / count + (hash(i, 1) - 0.5) * 0.6 / count))
    slots.push({
      index: i,
      t,
      theta0: t * turns * TAU + (i % strands) * TAU / strands + (hash(i, 2) - 0.5) * 0.35,
      phase: hash(i, 3) * TAU,
      roll: (hash(i, 4) - 0.5) * 0.3,
    })
  }
  return slots
}

// Writes the slot's world transform at `time` into `out` = { position, rotation, scale } (THREE objects)
export function slotTransform(slot, time, p, out) {
  const { t } = slot
  // Bounded height-dependent twist, pulse and anisotropy echo tornado.glsl.
  // Keep one mean angular speed so the arrangement never unwinds indefinitely.
  const clock = time * p.motionSpeed
  const gust = Math.pow(Math.abs(Math.sin(clock)), 30)
  const captureTime = Math.max(0, time - (slot.phase / TAU) * 2.5)
  const remaining = Math.exp(-captureTime * p.attraction)
  const theta = slot.theta0 + clock * p.spinSpeed + (1 - remaining) * TAU * 0.65
    + p.turbulence * 0.38 * Math.sin(t * 8 - clock * 1.8 + slot.phase * 0.2)
  const radius = (p.baseRadius + (p.topRadius - p.baseRadius) * Math.pow(t, FUNNEL_CURVE))
    * (1 + p.turbulence * (0.12 * Math.sin(clock * 2.2 - t * 13 + slot.phase) + 0.12 * gust))
    * breath(t, clock, p)
    + p.captureSpread * remaining
  const [ax, az] = axisOffset(t, clock, p)
  const y = (t - 0.5) * p.height + p.turbulence * 0.30 * Math.sin(clock * 2.0 + slot.phase)
    + remaining * Math.sin(slot.phase) * 0.7

  out.position.set(
    radius * Math.cos(theta) + ax,
    y,
    radius * Math.sin(theta) + az,
  )
  // Face outward from the funnel axis, leaning back as the funnel opens
  out.rotation.set(
    -0.12 - 0.3 * t + p.turbulence * 0.16 * Math.sin(clock * 2 + slot.phase),
    Math.PI / 2 - theta,
    slot.roll + p.turbulence * 0.22 * Math.sin(clock * 2.4 + slot.phase), 'YXZ',
  )
  out.scale.set(p.planeWidth, p.planeWidth * 9 / 16, 1)
}
