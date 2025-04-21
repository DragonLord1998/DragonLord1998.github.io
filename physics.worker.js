// Physics worker: Sun->Asteroid gravity ONLY

// Constants (G must match the value used for initial velocity calculation in scene.js)
const G = 0.1; // Gravitational constant (scaled)
const SUN_REPULSION_DISTANCE_SQ = 1.5 * 1.5; // Squared distance threshold (e.g., 1.5 units)
const SUN_REPULSION_STRENGTH = 0.05; // How strong the push is
let bodies = []; // Array to hold { id, mass, position: {x,y,z}, velocity: {x,y,z} }
let sun = null;

// Basic Vector operations (can be replaced with a library if needed)
const vec3 = {
    create: (x = 0, y = 0, z = 0) => ({ x, y, z }),
    subtract: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
    lengthSq: (v) => v.x * v.x + v.y * v.y + v.z * v.z,
    length: (v) => Math.sqrt(vec3.lengthSq(v)),
    normalize: (v) => {
        const len = vec3.length(v);
        return len > 0 ? vec3.scale(v, 1 / len) : vec3.create();
    }
};

self.onmessage = function(e) {
    const { type, payload } = e.data;

    if (type === 'init') {
        bodies = payload.bodies; // Asteroids
        sun = payload.sun;
        bodies.forEach(b => b.force = vec3.create());
        // console.log('Physics worker initialized with', bodies.length, 'asteroids (Sun gravity only)');
    } else if (type === 'tick') {
        const dt = payload.dt;
        // No longer receiving currentPlanets
        if (!sun || bodies.length === 0 || !dt) return;

        // 1. Reset forces for this tick
        bodies.forEach(body => {
            body.force = vec3.create();
        });

        // 2. Calculate forces acting ON asteroids
        // 2a. Sun's gravity on each asteroid (including repulsion)
        bodies.forEach(body => {
            const toSun = vec3.subtract(sun.position, body.position);
            const distSq = vec3.lengthSq(toSun);
            const safeDistSq = Math.max(distSq, 0.1);

            // Gravitational Force (Attractive)
            const gravForceMag = G * sun.mass * body.mass / safeDistSq;
            const gravForceDir = vec3.normalize(toSun);
            body.force = vec3.add(body.force, vec3.scale(gravForceDir, gravForceMag));

            // Repulsive Force (if too close)
            if (distSq < SUN_REPULSION_DISTANCE_SQ) {
                const repulsionMag = SUN_REPULSION_STRENGTH * body.mass * (SUN_REPULSION_DISTANCE_SQ / distSq);
                body.force = vec3.add(body.force, vec3.scale(gravForceDir, -repulsionMag));
            }
        });

        // 2b. Planets' gravity on each asteroid - REMOVED

        // 2c. Asteroid-Asteroid gravity - REMOVED

        // 3. Update asteroid velocities and positions using calculated forces
        bodies.forEach(body => {
            const acceleration = vec3.scale(body.force, 1 / body.mass);
            body.velocity = vec3.add(body.velocity, vec3.scale(acceleration, dt));
            body.position = vec3.add(body.position, vec3.scale(body.velocity, dt));
        });

        // Post updated asteroid states back to main thread
        self.postMessage({
            type: 'update',
            payload: {
                bodies: bodies.map(b => ({ id: b.id, position: b.position, velocity: b.velocity }))
            }
        });
    }
};
