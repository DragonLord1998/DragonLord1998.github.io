// main.js
import { createScene } from './scene.js';

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

// --- UI Elements ---
const enterARButton = document.getElementById('enterAR');
const exitARButton = document.getElementById('exitAR');
const scaleSlider = document.getElementById('scaleSlider'); // Get the slider

let sceneData = null; // To hold { scene, isoCam, root, skybox }
let xrHelper = null;
let rootNode = null; // Reference to the scene's root node
let skyboxMesh = null; // Reference to the skybox mesh
let planeDetector = null; // Reference to plane detection feature
let anchoredPlaneId = null; // ID of the plane we are anchored to

const main = async () => {
    sceneData = await createScene(engine, canvas);
    rootNode = sceneData.root; // Store root node reference
    skyboxMesh = sceneData.skybox; // Store skybox reference

    engine.runRenderLoop(() => {
        sceneData.scene.render();
    });

    window.addEventListener('resize', () => {
        engine.resize();
        // Adjust ortho camera on resize if needed
        if (sceneData.isoCam.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
            const ratio = engine.getRenderWidth() / engine.getRenderHeight();
            const size = sceneData.isoCam.orthoTop; // Use existing size
            sceneData.isoCam.orthoLeft = -size * ratio;
            sceneData.isoCam.orthoRight = size * ratio;
        }
    });

    // --- AR Setup ---
    const setupAR = async () => {
        try {
            // Request plane detection feature
            xrHelper = await sceneData.scene.createDefaultXRExperienceAsync({
                uiOptions: {
                    sessionMode: 'immersive-ar',
                    referenceSpaceType: 'local-floor' // Use local-floor for plane detection
                },
                optionalFeatures: true,
                // Explicitly request plane detection
                xrOptions: {
                    optionalFeatures: ['plane-detection']
                }
            });

            if (!xrHelper.baseExperience) {
                console.error("AR not supported");
                enterARButton.disabled = true;
                return;
            }

            // Get the plane detection feature
            planeDetector = xrHelper.featuresManager.getEnabledFeature(BABYLON.WebXRPlaneDetector.Name);

            if (!planeDetector) {
                console.warn("Plane detection feature not available or enabled.");
            } else {
                console.log("Plane detection enabled.");
                // --- Plane Detection Logic ---
                planeDetector.onPlaneAddedObservable.add((plane) => {
                    // Check if we already anchored and if the plane is horizontal
                    if (!anchoredPlaneId && plane.polygonDefinition.length > 0 && Math.abs(plane.normal.y) > 0.9) { // Check if mostly horizontal
                        console.log(`Horizontal plane ${plane.id} detected at y=${plane.position.y}`);
                        // Anchor the root node to this plane's position
                        // Note: plane.position is often (0,0,0) and transform is in worldMatrix
                        // We use the center of the polygon projected onto the world matrix position
                        plane.computeWorldMatrix(true); // Ensure matrix is up to date
                        const planePosition = plane.position.clone(); // Get position from matrix

                        // Adjust position slightly if needed (e.g., lift slightly above surface)
                        // planePosition.y += 0.01;

                        rootNode.position.copyFrom(planePosition);
                        // Optional: Align rotation (might make solar system tilt)
                        // rootNode.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(plane.worldMatrix);

                        anchoredPlaneId = plane.id; // Mark that we've anchored
                        console.log(`Anchored solar system to plane ${anchoredPlaneId}`);

                        // Optional: Disable slider interaction if anchored?
                        // scaleSlider.disabled = true;
                    }
                });

                // Optional: Handle plane updates if needed (e.g., if plane position changes)
                planeDetector.onPlaneUpdatedObservable.add((plane) => {
                    if (plane.id === anchoredPlaneId) {
                        // Re-anchor if the plane significantly moves (optional)
                        // console.log(`Anchored plane ${plane.id} updated.`);
                        // plane.computeWorldMatrix(true);
                        // rootNode.position.copyFrom(plane.position);
                    }
                });

                // Optional: Handle plane removal
                planeDetector.onPlaneRemovedObservable.add((plane) => {
                    if (plane.id === anchoredPlaneId) {
                        console.log(`Anchored plane ${plane.id} removed. Unanchoring.`);
                        anchoredPlaneId = null; // Allow anchoring to a new plane
                        // Optionally reset position or hide until new anchor found
                        // rootNode.position.set(0, -1000, 0); // Move out of view
                        // scaleSlider.disabled = false;
                    }
                });
            }

            // --- AR Enter/Exit Logic ---
            xrHelper.baseExperience.onStateChangedObservable.add((state) => {
                if (state === BABYLON.WebXRState.IN_XR) {
                    console.log("Entered AR");
                    enterARButton.style.display = 'none';
                    exitARButton.style.display = 'block';
                    scaleSlider.style.display = 'block'; // Show slider

                    // Hide skybox in AR
                    if (skyboxMesh) {
                        skyboxMesh.setEnabled(false);
                    }

                    // Don't immediately position relative to camera, wait for plane detection
                    rootNode.position.set(0, -1000, 0); // Initially hide below floor

                } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
                    console.log("Exited AR");
                    enterARButton.style.display = 'block';
                    exitARButton.style.display = 'none';
                    scaleSlider.style.display = 'none'; // Hide slider

                    // Show skybox when not in AR
                    if (skyboxMesh) {
                        skyboxMesh.setEnabled(true);
                    }
                    // Reset root node scale and position if modified
                    if (rootNode) {
                        rootNode.scaling.setAll(1); // Reset scale
                        rootNode.position.set(0, 0, 0); // Reset position
                        rootNode.rotationQuaternion = null; // Reset rotation
                    }
                    scaleSlider.value = 1; // Reset slider value
                    anchoredPlaneId = null; // Reset anchor state
                    // scaleSlider.disabled = false;
                }
            });

            enterARButton.onclick = () => {
                // xrHelper handles session start via its own UI or programmatically
                // If using default UI, this button might just enable it or be redundant
                // If starting programmatically: xrHelper.baseExperience.enterXRAsync(...)
                console.log("Enter AR button clicked (may rely on default XR UI)");
            };

            exitARButton.onclick = async () => {
                await xrHelper.baseExperience.exitXRAsync();
            };

            // --- Scale Slider Logic ---
            scaleSlider.oninput = () => {
                // Allow scaling even when anchored
                if (xrHelper && xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR && rootNode) {
                    const scaleValue = parseFloat(scaleSlider.value);
                    rootNode.scaling.setAll(scaleValue);
                }
            };

        } catch (e) {
            console.error("Error setting up AR:", e);
            enterARButton.disabled = true;
            enterARButton.textContent = "AR Error";
        }
    };

    // Initialize AR setup after scene is created
    if (navigator.xr) {
        setupAR();
    } else {
        console.warn("WebXR not supported in this browser.");
        enterARButton.disabled = true;
        enterARButton.textContent = "AR N/A";
    }
};

main().catch(console.error);