import * as THREE from 'three'
import { createSlots, slotTransform } from './tornadoLayout.js'

// Thin, deterministic strips inside the funnel. Their projected silhouettes block
// light; the thumbnail planes remain receivers unless thumbsOcclude is enabled.
export function createDebris(geometry, material, count = 36) {
  const group = new THREE.Group()
  for (const slot of createSlots(count, 4, 3)) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.slot = slot
    group.add(mesh)
  }
  return group
}

export function updateDebris(group, time, params) {
  for (const mesh of group.children) {
    const slot = mesh.userData.slot
    slotTransform(slot, time, params, mesh)
    mesh.position.x *= 0.72
    mesh.position.z *= 0.72
    // Bounded twist and wobble echo the tornado reference without unwinding the helix.
    mesh.rotation.z += 0.45 * Math.sin(slot.phase + time * 0.7)
    mesh.scale.set(0.14 + 0.32 * slot.t, 0.018 + 0.012 * slot.t, 1)
  }
}
