// Simple physics simulation worker

// Constants (adjust G for desired simulation speed/scale)
const G = 0.1; // Gravitational constant (scaled)
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
        bodies = payload.planets;
        sun = payload.sun;
        // console.log('Physics worker initialized');
    } else if (type === 'tick') {
        const dt = payload.dt;
        if (!sun || bodies.length === 0 || !dt) return;

        // Update positions based on current velocities
        bodies.forEach(body => {
            body.position = vec3.add(body.position, vec3.scale(body.velocity, dt));
        });

        // Calculate forces and update velocities
        bodies.forEach(body => {
            // Force from Sun
            const toSun = vec3.subtract(sun.position, body.position);
            const distSq = Math.max(vec3.lengthSq(toSun), 0.1); // Avoid division by zero / extreme forces
            const forceMag = G * sun.mass * body.mass / distSq;
            const forceDir = vec3.normalize(toSun);
            const force = vec3.scale(forceDir, forceMag);

            // Calculate acceleration (a = F/m)
            const acceleration = vec3.scale(force, 1 / body.mass);

            // Update velocity (v = v + a * dt)
            body.velocity = vec3.add(body.velocity, vec3.scale(acceleration, dt));
        });

        // Post updated state back to main thread
        self.postMessage({
            type: 'update',
            payload: {
                bodies: bodies.map(b => ({ id: b.id, position: b.position, velocity: b.velocity }))
            }
        });
    }
};
