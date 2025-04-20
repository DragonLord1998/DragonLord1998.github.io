// scene.js
export async function createScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    // Root for grouping all meshes
    const root = new BABYLON.TransformNode('root', scene);
    // Light
    new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), scene);

    // Add Skybox
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    // Use a single texture for the skybox
    skyboxMaterial.reflectionTexture = new BABYLON.Texture("8k_stars_milky_way.jpg", scene, true, false);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    // Sun
    const sunMass = 1000; // Arbitrary mass for the sun
    const sun = BABYLON.MeshBuilder.CreateSphere('sun', { diameter: 2 }, scene);
    const sunMat = new BABYLON.StandardMaterial('sunMat', scene);
    sunMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
    sun.material = sunMat;
    sun.parent = root;
    // Sun doesn't move in this simple model
    const sunData = { id: 'sun', mass: sunMass, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };

    // Planets
    const planetsData = [
      // Added mass and initial velocity calculation
      // Mass is roughly proportional to diameter^3, adjust as needed
      // Initial velocity is tangential, magnitude derived from old speed (approximate circular orbit)
      { name: 'mercury', diameter: 0.4, distance: 5,  speed: 0.005, angle: 0, mass: 0.06, diffuse: '8k_mercury.jpg' },
      { name: 'venus',   diameter: 0.9, distance: 8,  speed: 0.004, angle: 0, mass: 0.81, diffuse: '8k_venus_surface.jpg' },
      { name: 'earth',   diameter: 1,   distance: 11, speed: 0.003, angle: 0, mass: 1.00, diffuse: 'earth_day.jpg', bump: 'earth_height_map.png', specular: '2k_earth_specular_map.png' },
      { name: 'mars',    diameter: 0.7, distance: 14, speed: 0.002, angle: 0, mass: 0.11, diffuse: '8k_mars.jpg' },
      { name: 'jupiter', diameter: 2.2, distance: 17, speed: 0.0015, angle: 0, mass: 318, diffuse: '8k_jupiter.jpg' },
      { name: 'saturn',  diameter: 1.9, distance: 21, speed: 0.0012, angle: 0, mass: 95, diffuse: '8k_saturn.jpg' },
      { name: 'uranus',  diameter: 1.5, distance: 25, speed: 0.0009, angle: 0, mass: 14, diffuse: '2k_uranus.jpg' },
      { name: 'neptune', diameter: 1.5, distance: 29, speed: 0.0007, angle: 0, mass: 17, diffuse: '2k_neptune.jpg' }
    ];

    // Calculate initial tangential velocity based on old speed (approximation)
    planetsData.forEach(p => {
        const orbitalSpeed = p.speed * p.distance * 100; // Scale factor needed adjustment
        p.initialVelocity = { x: 0, y: 0, z: -orbitalSpeed }; // Assuming initial position is on positive X axis
    });

    const planetMeshes = {}; // Store meshes by name/id
    const planetPhysicsData = planetsData.map(p => {
      const mesh = BABYLON.MeshBuilder.CreateSphere(p.name, { diameter: p.diameter }, scene);
      const mat = new BABYLON.StandardMaterial(p.name + 'Mat', scene);
      if (p.diffuse) mat.diffuseTexture = new BABYLON.Texture(`./${p.diffuse}`, scene);
      if (p.bump) mat.bumpTexture = new BABYLON.Texture(`./${p.bump}`, scene);
      if (p.specular) mat.specularTexture = new BABYLON.Texture(`./${p.specular}`, scene);
      mesh.material = mat;
      mesh.position.x = p.distance; // Initial position
      mesh.parent = root;
      planetMeshes[p.name] = mesh;

      // Data structure for the physics worker
      return {
          id: p.name,
          mass: p.mass,
          position: { x: p.distance, y: 0, z: 0 },
          velocity: p.initialVelocity
      };
    });

    // --- Physics Worker Setup ---
    let physicsWorker = null;
    if (window.Worker) {
        physicsWorker = new Worker('physics.worker.js');

        // Send initial state to worker
        physicsWorker.postMessage({
            type: 'init',
            payload: {
                planets: planetPhysicsData,
                sun: sunData
            }
        });

        // Listen for updates from worker
        physicsWorker.onmessage = function(e) {
            const { type, payload } = e.data;
            if (type === 'update') {
                payload.bodies.forEach(bodyUpdate => {
                    const mesh = planetMeshes[bodyUpdate.id];
                    if (mesh) {
                        mesh.position.x = bodyUpdate.position.x;
                        mesh.position.y = bodyUpdate.position.y;
                        mesh.position.z = bodyUpdate.position.z;
                        // Optionally store updated velocity if needed elsewhere
                        const pData = planetPhysicsData.find(p => p.id === bodyUpdate.id);
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
        // Fallback or error handling needed here
    }

    // --- Ship ---
    const ship = BABYLON.MeshBuilder.CreateBox('ship', { height: 0.5, width: 0.5, depth: 1 }, scene);
    ship.material = new BABYLON.StandardMaterial('shipMat', scene);
    ship.material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    ship.position = new BABYLON.Vector3(0, 0, -10);
    ship.parent = root;
    // Nose cone
    const nose = BABYLON.MeshBuilder.CreateCylinder('noseCone', { diameterTop: 0, diameterBottom: 0.3, height: 0.7, tessellation: 16 }, scene);
    nose.rotation.x = Math.PI/2;
    nose.position = new BABYLON.Vector3(0, 0, 0.85);
    nose.parent = ship;
    // Wings
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
        // Calculate delta time in seconds
        const deltaTime = (currentTime - lastTime) / 1000.0;
        lastTime = currentTime;

        // Send tick to physics worker
        if (physicsWorker) {
            // Limit dt to avoid instability with large frame drops
            const stableDeltaTime = Math.min(deltaTime, 0.05); // e.g., max step of 50ms
             physicsWorker.postMessage({ type: 'tick', payload: { dt: stableDeltaTime } });
        }

        // Ship controls update (remains in main thread)
        const speed = 0.1, rot = 0.02; // Consider scaling speed with deltaTime?
        if (inputMap['w']) ship.translate(BABYLON.Axis.Z, speed, BABYLON.Space.LOCAL);
        if (inputMap['s']) ship.translate(BABYLON.Axis.Z, -speed, BABYLON.Space.LOCAL);
        if (inputMap['a']) ship.rotate(BABYLON.Axis.Y, -rot, BABYLON.Space.LOCAL);
        if (inputMap['d']) ship.rotate(BABYLON.Axis.Y, rot, BABYLON.Space.LOCAL);
        if (inputMap['r']) ship.translate(BABYLON.Axis.Y, speed, BABYLON.Space.LOCAL);
        if (inputMap['f']) ship.translate(BABYLON.Axis.Y, -speed, BABYLON.Space.LOCAL);
    });

    // Isometric camera
    const isoCam = new BABYLON.ArcRotateCamera('isoCam', Math.PI/4, Math.PI/4, 50, BABYLON.Vector3.Zero(), scene);
    isoCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const ratio = engine.getRenderWidth() / engine.getRenderHeight();
    const size = 20;
    isoCam.orthoLeft = -size * ratio;
    isoCam.orthoRight = size * ratio;
    isoCam.orthoTop = size;
    isoCam.orthoBottom = -size;
    isoCam.attachControl(canvas, true);

    return { scene, isoCam, root };
}