// Lights inside the funnel, near its axis: the tornado lit from within, zone by zone,
// like a storm cloud. Each light drifts up and down the axis and pulses on its own
// phase; every few seconds (randomized) one of them flashes, like lightning.
// They are RC emitters: their light reaches the works and leaks out between the swirl
// bands (front bands are RC occluders). Pure state + math; TornadoLighting draws them.
import * as THREE from 'three'
import { axisOffset } from './tornadoLayout.js'

export const MAX_INNER_LIGHTS = 5
const TAU = Math.PI * 2
const FUNNEL_CURVE = 1.6   // same flare as tornadoLayout / the shell
const HOVER_DIM = 0.4      // the lights drop to 40% while a work is hovered

function hash(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Lightning envelope: fast attack, short decay, a weaker second flicker
function flashEnvelope(age) {
  if (age < 0 || age > 0.6) return 0
  const main = age < 0.03 ? age / 0.03 : Math.exp(-(age - 0.03) / 0.08)
  const echo = age < 0.16 ? 0 : 0.6 * Math.exp(-(age - 0.16) / 0.07)
  return Math.min(1, main + echo)
}

export class InnerLights {
  constructor() {
    this.params = {
      lightCount: 4,
      innerLightIntensity: 4,
      pulseSpeed: 1,
      flashFrequency: 0.2,   // average flashes per second (one every ~5s)
      flashIntensity: 4,     // flash peak, as a multiple of innerLightIntensity
    }
    this.time = 0
    this.flashIn = 2 + Math.random() * 3
    this.lights = Array.from({ length: MAX_INNER_LIGHTS }, (_, i) => ({
      position: new THREE.Vector3(),
      radius: 0,             // world units
      intensity: 0,
      drift: 0.06 + 0.06 * hash(i, 1),
      driftSpeed: 0.13 + 0.12 * hash(i, 2),
      driftPhase: hash(i, 3) * TAU,
      pulseRate: 0.35 + 0.45 * hash(i, 4),
      pulsePhase: hash(i, 5) * TAU,
      wobblePhase: hash(i, 6) * TAU,
      flashAge: Infinity,
    }))
  }

  get count() { return Math.max(0, Math.min(MAX_INNER_LIGHTS, Math.round(this.params.lightCount))) }

  // dt: wall clock (the lights keep breathing when the tornado stops);
  // tornadoTime + params: the funnel's own clock and shape, to follow its axis;
  // hover: 0..1 how strongly a work is hovered
  update(dt, tornadoTime, p, hover = 0) {
    const q = this.params
    const n = this.count
    this.time += dt

    this.flashIn -= dt
    if (this.flashIn <= 0) {
      // No lightning while the loader assembles the tornado (calm)
      if (n > 0 && q.flashFrequency > 0 && !this.calm) this.lights[Math.floor(Math.random() * n)].flashAge = 0
      // Randomized gap around the mean 1/frequency
      this.flashIn = q.flashFrequency > 0 ? (0.35 + 1.3 * Math.random()) / q.flashFrequency : 1
    }

    const clock = tornadoTime * p.motionSpeed
    const dim = 1 - (1 - HOVER_DIM) * hover
    this.lights.forEach((light, i) => {
      light.flashAge += dt
      if (i >= n) { light.intensity = 0; return }
      // Heights spread over the funnel, each drifting slowly along the axis
      const base = 0.14 + 0.66 * (i + 0.5) / n
      const h = THREE.MathUtils.clamp(
        base + light.drift * Math.sin(this.time * light.driftSpeed + light.driftPhase), 0.06, 0.88)
      const funnelR = p.baseRadius + (p.topRadius - p.baseRadius) * Math.pow(h, FUNNEL_CURVE)
      // On the funnel's live axis (shared with the works and the shell), slightly off-center
      const wob = 0.12 * funnelR
      const [ax, az] = axisOffset(h, clock, p)
      light.position.set(
        ax + wob * Math.cos(this.time * 0.3 + light.wobblePhase),
        (h - 0.5) * p.height,
        az + wob * Math.sin(this.time * 0.3 + light.wobblePhase),
      )
      light.radius = 0.08 + 0.04 * funnelR
      const s = 0.5 + 0.5 * Math.sin(this.time * light.pulseRate * q.pulseSpeed * TAU * 0.25 + light.pulsePhase)
      const pulse = 0.1 + 0.9 * s * s * (3 - 2 * s)
      light.intensity = q.innerLightIntensity * (pulse + q.flashIntensity * flashEnvelope(light.flashAge)) * dim
    })
  }
}
