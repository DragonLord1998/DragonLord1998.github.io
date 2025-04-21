// main.js
import { createScene } from './scene.js';

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

// --- UI Elements ---
const enterARButton = document.getElementById('enterAR');
const exitARButton = document.getElementById('exitAR');
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');
const scaleContainer = document.getElementById('scaleContainer');
const arStatus = document.getElementById('arStatus');
const fpsCounter = document.getElementById('fpsCounter');

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
        // Update FPS counter
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${engine.getFps().toFixed()}`;
        }
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
                    referenceSpaceType: 'local-floor'
                },
                optionalFeatures: true,
                xrOptions: {
                    optionalFeatures: ['plane-detection'],
                    requiredFeatures: [] // Consider adding 'hit-test' if needed
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
                arStatus.textContent = "Plane detection not available";
            } else {
                console.log("Plane detection enabled.");
                
                // --- Visual feedback for detected planes ---
                const planeMaterial = new BABYLON.StandardMaterial("planeMaterial", sceneData.scene);
                planeMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1.0);
                planeMaterial.alpha = 0.3;
                
                // Track detected planes for cleanup
                const planeMarkers = new Map();
                
                // --- Plane Detection Logic ---
                planeDetector.onPlaneAddedObservable.add((plane) => {
                    // Create a simple visualization for the plane
                    const minDimension = 0.5; // minimum size to display
                    if (plane.polygonDefinition.length >= 3) {
                        // Create a helper mesh to visualize the plane
                        const planeMesh = BABYLON.MeshBuilder.CreateDisc("planeHelper", {
                            radius: 0.4,
                            tessellation: 24
                        }, sceneData.scene);
                        
                        planeMesh.material = planeMaterial;
                        planeMesh.position.copyFrom(plane.center);
                        planeMesh.rotationQuaternion = BABYLON.Quaternion.FromUnitVectorsToRef(
                            BABYLON.Vector3.Up(), plane.normal, new BABYLON.Quaternion()
                        );
                        
                        // Store reference to clean up later
                        planeMarkers.set(plane.id, planeMesh);
                        
                        // Check if horizontal and anchor if not already anchored
                        if (!anchoredPlaneId && Math.abs(plane.normal.y) > 0.9) {
                            console.log(`Horizontal plane ${plane.id} detected at y=${plane.center.y}`);
                            
                            // Use the plane center as anchor point
                            rootNode.position.copyFrom(plane.center);
                            // Give slight elevation to avoid z-fighting
                            rootNode.position.y += 0.01;
                            
                            anchoredPlaneId = plane.id;
                            arStatus.textContent = "Surface found! Use slider to adjust size.";
                            
                            // Make visual feedback for this plane more prominent
                            planeMesh.material.diffuseColor = new BABYLON.Color3(0.2, 1.0, 0.2);
                            
                            // Enable scaling - show prominent slider
                            scaleContainer.style.display = 'block';
                        }
                    }
                });

                planeDetector.onPlaneUpdatedObservable.add((plane) => {
                    // Update the visualization if plane moves/changes
                    if (planeMarkers.has(plane.id)) {
                        const planeMesh = planeMarkers.get(plane.id);
                        planeMesh.position.copyFrom(plane.center);
                    }
                    
                    // If this is our anchored plane, update the root node position
                    if (plane.id === anchoredPlaneId) {
                        rootNode.position.copyFrom(plane.center);
                        rootNode.position.y += 0.01; // Maintain slight elevation
                    }
                });

                planeDetector.onPlaneRemovedObservable.add((plane) => {
                    // Clean up visualization mesh
                    if (planeMarkers.has(plane.id)) {
                        planeMarkers.get(plane.id).dispose();
                        planeMarkers.delete(plane.id);
                    }
                    
                    // If anchored plane is removed
                    if (plane.id === anchoredPlaneId) {
                        console.log(`Anchored plane ${plane.id} removed. Looking for new surface...`);
                        anchoredPlaneId = null;
                        arStatus.textContent = "Surface lost. Please scan another surface.";
                        
                        // Hide root node temporarily
                        rootNode.position.y = -1000;
                    }
                });
                
                // Clean up on session end
                xrHelper.baseExperience.onStateChangedObservable.add((state) => {
                    if (state === BABYLON.WebXRState.NOT_IN_XR) {
                        // Remove all plane visualizations
                        planeMarkers.forEach((mesh) => mesh.dispose());
                        planeMarkers.clear();
                    }
                });
            }

            // --- AR Enter/Exit Logic ---
            xrHelper.baseExperience.onStateChangedObservable.add((state) => {
                if (state === BABYLON.WebXRState.IN_XR) {
                    console.log("Entered AR");
                    enterARButton.style.display = 'none';
                    exitARButton.style.display = 'block';
                    arStatus.style.display = 'block';
                    arStatus.textContent = "Searching for surface...";

                    // Completely hide skybox and any non-AR elements
                    if (skyboxMesh) {
                        skyboxMesh.setEnabled(false);
                        skyboxMesh.visibility = 0;
                    }

                    // Hide root node temporarily until we find a plane
                    rootNode.position.set(0, -1000, 0);
                    // Reset anchor state
                    anchoredPlaneId = null;

                } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
                    console.log("Exited AR");
                    enterARButton.style.display = 'block';
                    exitARButton.style.display = 'none';
                    arStatus.style.display = 'none';
                    scaleContainer.style.display = 'none';

                    // Restore skybox and reset position
                    if (skyboxMesh) {
                        skyboxMesh.setEnabled(true);
                        skyboxMesh.visibility = 1;
                    }
                    
                    // Reset root node scale and position
                    if (rootNode) {
                        rootNode.scaling.setAll(1);
                        rootNode.position.set(0, 0, 0);
                        rootNode.rotationQuaternion = null;
                    }
                    
                    scaleSlider.value = 1;
                    scaleValue.textContent = "1.0";
                    anchoredPlaneId = null;
                }
            });

            enterARButton.onclick = () => {
                console.log("Enter AR button clicked (may rely on default XR UI)");
            };

            exitARButton.onclick = async () => {
                await xrHelper.baseExperience.exitXRAsync();
            };

            // --- Scale Slider Logic ---
            scaleSlider.oninput = () => {
                const scaleValue = parseFloat(scaleSlider.value);
                document.getElementById('scaleValue').textContent = scaleValue.toFixed(1);
                
                if (rootNode) {
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