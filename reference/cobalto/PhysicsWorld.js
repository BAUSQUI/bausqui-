import * as CANNON from 'cannon-es'

export class PhysicsWorld {
  constructor(capsules, sharedState) {
    this.capsules    = capsules
    this.sharedState = sharedState
    this.bodies      = []

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) })
    this.world.broadphase    = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep    = false
    this.world.solver.iterations = 20

    const gelMaterial = new CANNON.Material('gel')
    const gelContact  = new CANNON.ContactMaterial(gelMaterial, gelMaterial, {
      restitution:                  0.05,
      friction:                     0.8,
      contactEquationStiffness:     1e6,
      contactEquationRelaxation:    8,
      frictionEquationStiffness:    1e6,
      frictionEquationRelaxation:   8,
    })
    this.world.addContactMaterial(gelContact)
    this.world.defaultMaterial = gelMaterial

    if (!sharedState.radii) sharedState.radii = new Float32Array(capsules.length)
    capsules.forEach((c, i) => { sharedState.radii[i] = c._scale * 1.0 })

    // Cada esfera tiene su propia dirección y velocidad de drift
    this.driftAngles = capsules.map(() => Math.random() * Math.PI * 2)
    this.driftSpeeds = capsules.map(() => 0.4 + Math.random() * 0.6)

    this._initBodies(gelMaterial)
  }

  _initBodies(gelMaterial) {
    this.capsules.forEach((capsule, i) => {
      const pos    = capsule.group.position
      const radius = capsule._scale * 1.0

      const body = new CANNON.Body({
        mass:     1.0 + radius * 0.5,
        material: gelMaterial,
        shape:    new CANNON.Sphere(radius * 0.88),
        position: new CANNON.Vec3(pos.x, 0, pos.z),
        linearDamping:  0.6,   // menos damping que antes — se mueven más libre
        angularDamping: 1.0,
      })

      // Velocidad inicial en la dirección de drift
      const angle = this.driftAngles[i]
      const speed = this.driftSpeeds[i]
      body.velocity.set(
        Math.cos(angle) * speed,
        0,
        Math.sin(angle) * speed,
      )

      this.world.addBody(body)
      this.bodies.push(body)
    })

    this.world.addEventListener('beginContact', e => this._onContact(e.bodyA, e.bodyB))
  }

  _onContact(bodyA, bodyB) {
    const idxA = this.bodies.indexOf(bodyA)
    const idxB = this.bodies.indexOf(bodyB)
    if (idxA < 0 || idxB < 0) return

    const gsap = window.__gsap
    if (!gsap) return

    ;[idxA, idxB].forEach(idx => {
      const cap = this.capsules[idx]
      const dx  = this.bodies[idx === idxA ? idxB : idxA].position.x - this.bodies[idx].position.x
      const dz  = this.bodies[idx === idxA ? idxB : idxA].position.z - this.bodies[idx].position.z
      const len = Math.sqrt(dx*dx + dz*dz) || 1
      const sx  = 1 - Math.abs(dx/len) * 0.15
      const sz  = 1 - Math.abs(dz/len) * 0.15
      gsap.to(cap.group.scale, {
        x: sx, z: sz, duration: 0.1, ease: 'power2.out',
        onComplete: () => gsap.to(cap.group.scale, {
          x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)',
        })
      })
    })
  }

  applyHoverImpulse(index, strength = 1.2) {
    const body  = this.bodies[index]
    if (!body) return
    const angle = Math.random() * Math.PI * 2
    body.applyImpulse(
      new CANNON.Vec3(Math.cos(angle)*strength, 0, Math.sin(angle)*strength),
      body.position
    )
    this.bodies.forEach((other, i) => {
      if (i === index) return
      const dx   = other.position.x - body.position.x
      const dz   = other.position.z - body.position.z
      const dist = Math.sqrt(dx*dx + dz*dz)
      if (dist < 12 && dist > 0) {
        const force = Math.exp(-dist/6) * strength * 0.35
        other.applyImpulse(
          new CANNON.Vec3((dx/dist)*force, 0, (dz/dist)*force),
          other.position
        )
      }
    })
  }

  resetBody(index, position) {
    const body = this.bodies[index]
    if (!body) return
    body.position.set(position.x, 0, position.z)
    body.velocity.set(0, 0, 0)
    body.angularVelocity.set(0, 0, 0)
    body.force.set(0, 0, 0)
  }

  _applyDriftAndBounds() {
    const BOUND = 30  // borde del campo

    this.bodies.forEach((body, i) => {
      const angle = this.driftAngles[i]
      const speed = this.driftSpeeds[i]

      // Fuerza de drift — empuje constante suave en la dirección propia
      const driftStrength = 0.08
      body.applyForce(
        new CANNON.Vec3(
          Math.cos(angle) * driftStrength * speed,
          0,
          Math.sin(angle) * driftStrength * speed,
        ),
        body.position
      )

      // Velocidad máxima — evita que aceleren infinito
      const vel  = body.velocity
      const vlen = Math.sqrt(vel.x*vel.x + vel.z*vel.z)
      const vmax = 1.8 * speed
      if (vlen > vmax) {
        body.velocity.x = (vel.x / vlen) * vmax
        body.velocity.z = (vel.z / vlen) * vmax
      }

      // Rebote en los bordes — cuando llegan al borde rebotan suavemente
      const x = body.position.x
      const z = body.position.z

      if (Math.abs(x) > BOUND) {
        // Invertir componente X del drift y aplicar impulso de retorno
        this.driftAngles[i] = Math.PI - angle
        body.applyImpulse(
          new CANNON.Vec3(-Math.sign(x) * 1.5 * speed, 0, 0),
          body.position
        )
        // Empujar de vuelta dentro del campo
        body.position.x = Math.sign(x) * BOUND
      }

      if (Math.abs(z) > BOUND * 0.8) {
        this.driftAngles[i] = -angle
        body.applyImpulse(
          new CANNON.Vec3(0, 0, -Math.sign(z) * 1.5 * speed),
          body.position
        )
        body.position.z = Math.sign(z) * BOUND * 0.8
      }

      // Cambio de dirección suave y aleatorio — las esferas no van siempre recto
      if (Math.random() < 0.002) {
        this.driftAngles[i] += (Math.random() - 0.5) * 0.8
      }
    })
  }

  update(dt) {
    this._applyDriftAndBounds()
    this.world.fixedStep(1/60, dt)

    this.bodies.forEach((body, i) => {
      const capsule = this.capsules[i]
      capsule.group.position.x         = body.position.x
      capsule.group.position.z         = body.position.z
      this.sharedState.positions[i].x  = body.position.x
      this.sharedState.positions[i].y  = body.position.z
      this.sharedState.velocities[i]   = Math.min(body.velocity.length(), 5.0)
    })
  }
}