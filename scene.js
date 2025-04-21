// scene.js
export async function createScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    const root = new BABYLON.TransformNode('root', scene);
    new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), scene);

    // Add Skybox
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.Texture("8k_stars_milky_way.jpg", scene, true, false);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    // --- Physics Constants (for asteroids) ---
    const G = 0.1;
    const sunMass = 1000;

    // Sun
    const sun = BABYLON.MeshBuilder.CreateSphere('sun', { diameter: 2 }, scene);
    const sunMat = new BABYLON.StandardMaterial('sunMat', scene);
    sunMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
    sun.material = sunMat;
    sun.parent = root;
    const sunData = { id: 'sun', mass: sunMass, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };

    // Planets (Kinematic Orbits) - Increased distances, removed mass
    const planetsData = [
      { name: 'mercury', diameter: 0.4, distance: 10, speed: 0.005, angle: 0, diffuse: '8k_mercury.jpg' },
      { name: 'venus',   diameter: 0.9, distance: 16, speed: 0.004, angle: 0, diffuse: '8k_venus_surface.jpg' },
      { name: 'earth',   diameter: 1,   distance: 22, speed: 0.003, angle: 0, diffuse: 'earth_day.jpg', bump: 'earth_height_map.png', specular: '2k_earth_specular_map.png' },
      { name: 'mars',    diameter: 0.7, distance: 28, speed: 0.002, angle: 0, diffuse: '8k_mars.jpg' },
      { name: 'jupiter', diameter: 2.2, distance: 34, speed: 0.0015, angle: 0, diffuse: '8k_jupiter.jpg' },
      { name: 'saturn',  diameter: 1.9, distance: 42, speed: 0.0012, angle: 0, diffuse: '8k_saturn.jpg' },
      { name: 'uranus',  diameter: 1.5, distance: 50, speed: 0.0009, angle: 0, diffuse: '2k_uranus.jpg' },
      { name: 'neptune', diameter: 1.5, distance: 58, speed: 0.0007, angle: 0, diffuse: '2k_neptune.jpg' }
    ];

    // --- Texture Loading ---
    const textureLoadPromises = [];

    // Create planet meshes and store references
    const planets = planetsData.map(p => {
        const mesh = BABYLON.MeshBuilder.CreateSphere(p.name, { diameter: p.diameter }, scene);
        const mat = new BABYLON.StandardMaterial(p.name + 'Mat', scene);

        // Wrap texture loading in promises
        if (p.diffuse) {
            const diffuseTexture = new BABYLON.Texture(`./${p.diffuse}`, scene);
            mat.diffuseTexture = diffuseTexture;
            textureLoadPromises.push(new Promise(resolve => diffuseTexture.onLoadObservable.addOnce(resolve)));
        }
        if (p.bump) {
            const bumpTexture = new BABYLON.Texture(`./${p.bump}`, scene);
            mat.bumpTexture = bumpTexture;
            textureLoadPromises.push(new Promise(resolve => bumpTexture.onLoadObservable.addOnce(resolve)));
        }
        if (p.specular) {
            const specularTexture = new BABYLON.Texture(`./${p.specular}`, scene);
            mat.specularTexture = specularTexture;
            textureLoadPromises.push(new Promise(resolve => specularTexture.onLoadObservable.addOnce(resolve)));
        }

        mesh.material = mat;
        mesh.position.x = p.distance;
        mesh.parent = root;
        return { ...p, mesh };
    });

    // --- Wait for Planet Textures ---
    await Promise.all(textureLoadPromises);
    console.log("Planet textures loaded.");

    // --- Asteroids (Generate AFTER planet textures are loaded) ---
    const asteroidCount = 500;
    const asteroidBeltMinRadius = 35;
    const asteroidBeltMaxRadius = 41;
    const asteroidBeltHeight = 1.0;

    const vec3Length = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const vec3Normalize = (v) => {
        const len = vec3Length(v);
        return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 0 };
    };
    const vec3Scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });

    const asteroidMat = new BABYLON.StandardMaterial("asteroidMat", scene);
    asteroidMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    asteroidMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    const asteroidMeshes = {};
    const asteroidPhysicsData = [];
    const INITIAL_SPEED_BOOST_FACTOR = 1.01;

    for (let i = 0; i < asteroidCount; i++) {
        const id = `asteroid_${i}`;
        const radius = asteroidBeltMinRadius + Math.random() * (asteroidBeltMaxRadius - asteroidBeltMinRadius);
        const angle = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * asteroidBeltHeight;
        const size = 0.05 + Math.random() * 0.1;

        const mesh = BABYLON.MeshBuilder.CreateIcoSphere(id, { radius: size, subdivisions: 2 }, scene);
        mesh.material = asteroidMat;
        const initialPosition = { x: Math.cos(angle) * radius, y: height, z: Math.sin(angle) * radius };
        mesh.position = new BABYLON.Vector3(initialPosition.x, initialPosition.y, initialPosition.z);
        mesh.parent = root;
        asteroidMeshes[id] = mesh;

        const rVec = { x: initialPosition.x, y: 0, z: initialPosition.z };
        const rMag = vec3Length(rVec);
        let initialVelocity = { x: 0, y: 0, z: 0 };
        if (rMag > 0.01) {
             const orbitalSpeedMag = Math.sqrt(G * sunMass / rMag) * INITIAL_SPEED_BOOST_FACTOR;
             const tangentDir = vec3Normalize({ x: -rVec.z, y: 0, z: rVec.x });
             initialVelocity = vec3Scale(tangentDir, orbitalSpeedMag);
        }

        const mass = size * size * size * 5;

        asteroidPhysicsData.push({
            id: id,
            mass: mass,
            position: initialPosition,
            velocity: initialVelocity
        });
    }

    // --- Physics Worker Setup (Initialize AFTER planet textures and asteroid data are ready) ---
    let physicsWorker = null;
    if (window.Worker) {
        physicsWorker = new Worker('physics.worker.js');

        physicsWorker.postMessage({
            type: 'init',
            payload: {
                bodies: asteroidPhysicsData,
                sun: sunData
            }
        });

        physicsWorker.onmessage = function(e) {
            const { type, payload } = e.data;
            if (type === 'update') {
                payload.bodies.forEach(bodyUpdate => {
                    const mesh = asteroidMeshes[bodyUpdate.id];
                    if (mesh) {
                        mesh.position.x = bodyUpdate.position.x;
                        mesh.position.y = bodyUpdate.position.y;
                        mesh.position.z = bodyUpdate.position.z;
                        const pData = asteroidPhysicsData.find(p => p.id === bodyUpdate.id);
                        if(pData) pData.velocity = bodyUpdate.velocity;
                    }
                });
            }
        };

        physicsWorker.onerror = function(error) {
            console.error('Physics Worker Error:', error.message, error);
        };

    } else {
        console.error('Web Workers not supported in this browser.');
    }

    // --- Ship ---
    const ship = BABYLON.MeshBuilder.CreateBox('ship', { height: 0.5, width: 0.5, depth: 1 }, scene);
    ship.material = new BABYLON.StandardMaterial('shipMat', scene);
    ship.material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    ship.position = new BABYLON.Vector3(0, 0, -10);
    ship.parent = root;
    const nose = BABYLON.MeshBuilder.CreateCylinder('noseCone', { diameterTop: 0, diameterBottom: 0.3, height: 0.7, tessellation: 16 }, scene);
    nose.rotation.x = Math.PI/2;
    nose.position = new BABYLON.Vector3(0, 0, 0.85);
    nose.parent = ship;
    const wingOpts = { width: 1.5, height: 0.5 };
    const wingL = BABYLON.MeshBuilder.CreatePlane('wingLeft', wingOpts, scene);
    wingL.rotation.x = Math.PI/2;
    wingL.position = new BABYLON.Vector3(-1, 0, 0);
    wingL.material = ship.material;
    wingL.parent = ship;
    const wingR = wingL.clone('wingRight');
    wingR.position.x = 1;

    // --- Controls ---
    const inputMap = {};
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, evt => inputMap[evt.sourceEvent.key.toLowerCase()] = true));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, evt => inputMap[evt.sourceEvent.key.toLowerCase()] = false));

    // --- Game Loop ---
    let lastTime = performance.now();
    scene.registerBeforeRender(() => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000.0;
        lastTime = currentTime;

        // Update Planets (Kinematic)
        planets.forEach(p => {
            p.angle += p.speed;
            p.mesh.position.x = Math.cos(p.angle) * p.distance;
            p.mesh.position.z = Math.sin(p.angle) * p.distance;
            p.mesh.position.y = 0;
        });

        // Send tick to physics worker (for asteroids)
        if (physicsWorker) {
            const stableDeltaTime = Math.min(deltaTime, 0.05);
             physicsWorker.postMessage({
                 type: 'tick',
                 payload: {
                     dt: stableDeltaTime
                 }
             });
        }

        const speed = 0.1, rot = 0.02;
        if (inputMap['w']) ship.translate(BABYLON.Axis.Z, speed, BABYLON.Space.LOCAL);
        if (inputMap['s']) ship.translate(BABYLON.Axis.Z, -speed, BABYLON.Space.LOCAL);
        if (inputMap['a']) ship.rotate(BABYLON.Axis.Y, -rot, BABYLON.Space.LOCAL);
        if (inputMap['d']) ship.rotate(BABYLON.Axis.Y, rot, BABYLON.Space.LOCAL);
        if (inputMap['r']) ship.translate(BABYLON.Axis.Y, speed, BABYLON.Space.LOCAL);
        if (inputMap['f']) ship.translate(BABYLON.Axis.Y, -speed, BABYLON.Space.LOCAL);
    });

    const isoCam = new BABYLON.ArcRotateCamera('isoCam', Math.PI/4, Math.PI/4, 50, BABYLON.Vector3.Zero(), scene);
    isoCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const ratio = engine.getRenderWidth() / engine.getRenderHeight();
    const size = 20;
    isoCam.orthoLeft = -size * ratio;
    isoCam.orthoRight = size * ratio;
    isoCam.orthoTop = size;
    isoCam.orthoBottom = -size;
    isoCam.attachControl(canvas, true);

    return { scene, isoCam, root, skybox };
}