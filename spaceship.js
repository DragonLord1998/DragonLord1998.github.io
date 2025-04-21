/**
 * Creates a more detailed, procedurally-influenced spaceship mesh.
 * @param {BABYLON.Scene} scene - The Babylon scene.
 * @param {object} [options] - Optional parameters for customization.
 * @param {number} [options.bodyLength=2.5] - Length of the main ship body.
 * @param {number} [options.bodyWidth=0.8] - Width of the main ship body.
 * @param {number} [options.bodyHeight=0.6] - Height of the main ship body.
 * @param {number} [options.wingSpan=2.0] - Total span of the wings.
 * @param {number} [options.wingDepth=1.0] - Depth (chord) of the wings.
 * @param {number} [options.noseLength=1.0] - Length of the nose cone.
 * @param {number} [options.thrusterCount=2] - Number of thrusters.
 * @param {number} [options.thrusterRadius=0.2] - Radius of the thrusters.
 * @param {boolean} [options.hasTailFin=true] - Whether to add a tail fin.
 * @returns {BABYLON.Mesh} The main ship mesh (root of the spaceship hierarchy).
 */
export function createSpaceship(scene, options = {}) {
    // Default values adjusted for more realistic proportions (relative scale)
    const config = {
        bodyLength: 2.5,    // Longer body
        bodyWidth: 0.8,     // Wider body
        bodyHeight: 0.6,    // Slightly taller body
        wingSpan: 2.0,      // Adjusted wing span relative to body
        wingDepth: 1.0,     // Deeper wings
        noseLength: 1.0,    // Longer nose cone
        thrusterCount: 2,
        thrusterRadius: 0.2, // Slightly larger thrusters
        hasTailFin: true,
        ...options // Override defaults with provided options
    };

    // Ship Body
    const ship = BABYLON.MeshBuilder.CreateBox('ship', {
        height: config.bodyHeight,
        width: config.bodyWidth,
        depth: config.bodyLength
    }, scene);
    ship.material = new BABYLON.StandardMaterial('shipMat', scene);
    ship.material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    ship.position = new BABYLON.Vector3(0, 0, -10); // Initial position

    // Nose cone
    const nose = BABYLON.MeshBuilder.CreateCylinder('noseCone', {
        diameterTop: 0,
        diameterBottom: config.bodyWidth * 0.7, // Adjusted scaling factor
        height: config.noseLength,
        tessellation: 16
    }, scene);
    nose.rotation.x = Math.PI / 2;
    nose.position = new BABYLON.Vector3(0, 0, config.bodyLength / 2 + config.noseLength / 2 - 0.1); // Position relative to body center
    nose.parent = ship;

    // Wings
    const wingOpts = { width: config.wingSpan / 2, height: config.wingDepth, sideOrientation: BABYLON.Mesh.DOUBLESIDE };
    const wingL = BABYLON.MeshBuilder.CreatePlane('wingLeft', wingOpts, scene);
    wingL.rotation.x = Math.PI / 2;
    // Adjust wing position based on new dimensions
    wingL.position = new BABYLON.Vector3(-(config.bodyWidth / 2 + config.wingSpan / 4), 0, -config.bodyLength * 0.2); // Position wings further back
    wingL.material = ship.material;
    wingL.parent = ship;

    const wingR = wingL.clone('wingRight');
    wingR.position.x = (config.bodyWidth / 2 + config.wingSpan / 4);

    // Thrusters
    const thrusterHeight = config.thrusterRadius * 1.5;
    const thrusterSpacing = config.bodyWidth / (config.thrusterCount + 1);
    for (let i = 0; i < config.thrusterCount; i++) {
        const thruster = BABYLON.MeshBuilder.CreateCylinder(`thruster_${i}`, {
            diameter: config.thrusterRadius * 2,
            height: thrusterHeight,
            tessellation: 12
        }, scene);
        thruster.rotation.x = Math.PI / 2;
        const xPos = -config.bodyWidth / 2 + thrusterSpacing * (i + 1);
        // Adjust thruster position based on new dimensions
        thruster.position = new BABYLON.Vector3(xPos, 0, -config.bodyLength / 2 - thrusterHeight / 2 + 0.05);
        thruster.material = new BABYLON.StandardMaterial(`thrusterMat_${i}`, scene);
        thruster.material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4); // Darker grey
        thruster.parent = ship;
    }

    // Tail Fin
    if (config.hasTailFin) {
        const finHeight = config.bodyHeight * 1.5; // Make fin taller relative to body
        const finDepth = config.bodyLength * 0.3; // Make fin shorter relative to body
        const tailFin = BABYLON.MeshBuilder.CreateBox('tailFin', {
            width: 0.08, // Slightly thicker fin
            height: finHeight,
            depth: finDepth
        }, scene);
        // Adjust fin position based on new dimensions
        tailFin.position = new BABYLON.Vector3(0, config.bodyHeight / 2 + finHeight / 2 - 0.05, -config.bodyLength / 2 + finDepth / 2 + 0.1); // Move slightly forward
        tailFin.material = ship.material;
        tailFin.parent = ship;
    }

    return ship;
}
