// main.js
import { createScene } from './scene.js';

window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);
    const { scene, isoCam, root } = await createScene(engine, canvas);

    // Create planet meshes
    const earth = BABYLON.MeshBuilder.CreateSphere("earth", { diameter: 2 }, scene);
    const mars = BABYLON.MeshBuilder.CreateSphere("mars", { diameter: 1.5 }, scene);

    const planets = [earth, mars];
    const originalScales = new Map();
    planets.forEach(p => originalScales.set(p, p.scaling.clone()));

    // Create a simple asteroid
    const asteroid = BABYLON.MeshBuilder.CreateSphere("asteroid", { diameter: 1 }, scene);
    asteroid.position = new BABYLON.Vector3(5, 1, 0);
    const asteroidMat = new BABYLON.StandardMaterial("asteroidMat", scene);
    const noiseTex = new BABYLON.NoiseProceduralTexture("noiseTex", 128, scene);
    asteroidMat.diffuseTexture = noiseTex;
    asteroid.material = asteroidMat;

    // Enable physics with CannonJS
    scene.enablePhysics(new BABYLON.Vector3(0, 0, 0), new BABYLON.CannonJSPlugin());

    // Assign physics impostor to sun and store masses
    const sun = BABYLON.MeshBuilder.CreateSphere("sun", { diameter: 5 }, scene);
    sun.physicsImpostor = new BABYLON.PhysicsImpostor(sun, BABYLON.PhysicsImpostor.SphereImpostor, { mass: 1000 }, scene);
    const masses = new Map();
    masses.set(sun, 1000);

    // Assign impostors to your planets and record their masses
    planets.forEach(p => {
        const mass = p.getBoundingInfo().boundingSphere.radius * 5;
        p.physicsImpostor = new BABYLON.PhysicsImpostor(p, BABYLON.PhysicsImpostor.SphereImpostor, { mass }, scene);
        masses.set(p, mass);
    });

    // Spawn a belt of asteroids with small random masses
    const asteroids = [];
    for (let i = 0; i < 50; i++) {
        const diameter = Math.random() * 0.2 + 0.05;
        const a = BABYLON.MeshBuilder.CreateSphere("asteroid" + i, { diameter }, scene);
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 2;
        a.position = new BABYLON.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        const mat = new BABYLON.StandardMaterial("asteroidMat" + i, scene);
        mat.diffuseTexture = new BABYLON.NoiseProceduralTexture("noiseTex" + i, 64, scene);
        a.material = mat;
        const mass = diameter * 0.1;
        a.physicsImpostor = new BABYLON.PhysicsImpostor(a, BABYLON.PhysicsImpostor.SphereImpostor, { mass }, scene);
        masses.set(a, mass);
        asteroids.push(a);
    }

    // N-body gravity setup
    const G = 0.1;
    // Create comets
    const comets = [];
    for (let i = 0; i < 3; i++) {
        const diameter = 0.3;
        const c = BABYLON.MeshBuilder.CreateSphere("comet" + i, { diameter }, scene);
        const angle = Math.random() * Math.PI * 2;
        const radius = 35 + Math.random() * 10;
        c.position = new BABYLON.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        const mat = new BABYLON.StandardMaterial("cometMat" + i, scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        c.material = mat;
        const massC = 0.5;
        c.physicsImpostor = new BABYLON.PhysicsImpostor(c, BABYLON.PhysicsImpostor.SphereImpostor, { mass: massC }, scene);
        masses.set(c, massC);
        comets.push(c);
    }
    // Combine all bodies
    const bodies = [sun, ...planets, ...asteroids, ...comets];
    // Assign initial orbital velocities to prevent infall
    bodies.forEach(body => {
        if (body === sun) return;
        const dir = body.position.subtract(sun.position);
        const dist = dir.length();
        const tangent = new BABYLON.Vector3(-dir.z, 0, dir.x).normalize();
        const speed = Math.sqrt(G * masses.get(sun) / dist);
        body.physicsImpostor.setLinearVelocity(tangent.scale(speed));
    });
    // Apply pairwise gravitational forces each frame
    scene.onBeforeRenderObservable.add(() => {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const bi = bodies[i], bj = bodies[j];
                const dir = bi.position.subtract(bj.position);
                const dist = dir.length();
                if (dist === 0) continue;
                const forceMag = G * masses.get(bi) * masses.get(bj) / (dist * dist);
                const force = dir.normalize().scale(forceMag);
                bi.physicsImpostor.applyForce(force, bi.getAbsolutePosition());
                bj.physicsImpostor.applyForce(force.negate(), bj.getAbsolutePosition());
            }
        }
    });

    // UI buttons
    const enterAR = document.getElementById('enterAR');
    const exitAR = document.getElementById('exitAR');
    let xrHelper = null;

    // Disable AR if not secure or unsupported
    if (!window.isSecureContext) {
        enterAR.disabled = true;
        enterAR.textContent = 'AR requires HTTPS';
    } else if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then(supported => {
            if (!supported) {
                enterAR.disabled = true;
                enterAR.textContent = 'AR not supported';
            }
        });
    }

    // Enter AR
    enterAR.addEventListener('click', async () => {
        try {
            xrHelper = await scene.createDefaultXRExperienceAsync({
                uiOptions: { sessionMode: 'immersive-ar' },
                optionalFeatures: true
            });
            const hitTest = xrHelper.baseExperience.featuresManager.enableFeature(
                BABYLON.WebXRHitTest, 'latest', {
                    offsetRay: new BABYLON.Ray(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, -1)),
                    preferredTrackableTypes: [BABYLON.XRHitTestTrackableType.Plane]
                }
            );
            hitTest.onHitTestResultObservable.add(results => {
                if (results.length) {
                    const m = results[0].transformationMatrix;
                    root.position.set(m.m[12], m.m[13], m.m[14]);
                    hitTest.detach();
                }
            });

            // Shrink planets in AR
            planets.forEach(p => p.scaling = originalScales.get(p).scale(0.1));

            enterAR.style.display = 'none';
            exitAR.style.display = 'block';
        } catch (e) {
            console.error(e);
            alert('AR not supported or permission denied');
        }
    });

    // Exit AR
    exitAR.addEventListener('click', async () => {
        if (xrHelper) {
            await xrHelper.baseExperience.exitXRAsync();
            xrHelper = null;

            // Restore planet sizes
            planets.forEach(p => p.scaling = originalScales.get(p));

            enterAR.style.display = 'block';
            exitAR.style.display = 'none';
            scene.activeCamera = isoCam;
        }
    });

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());
});