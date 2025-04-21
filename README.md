# Babylon.js Solar System Simulation

A simple solar system simulation built with Babylon.js.

## Features

*   Displays the Sun and major planets of our solar system.
*   Includes a basic asteroid belt between Mars and Jupiter.
*   Simple orbital physics calculated in a Web Worker (Sun's gravity only).
*   A controllable spaceship (W/S: forward/back, A/D: yaw, R/F: up/down).
*   Isometric camera view.
*   Milky Way skybox background.
*   Basic WebXR AR support:
    *   Enter/Exit AR buttons.
    *   Ability to scale the scene in AR using a slider.
    *   Skybox is hidden in AR mode.

## Running

1.  Serve the files using a local web server.
2.  Open the `index.html` file in a WebXR-compatible browser.

## Files

*   `index.html`: Main HTML structure, includes UI elements and canvas.
*   `main.js`: Initializes Babylon.js engine, scene, handles AR setup and UI interactions.
*   `scene.js`: Defines and creates all 3D objects (sun, planets, asteroids, ship, skybox), sets up materials, lighting, camera, and basic controls. Initializes physics data.
*   `physics.worker.js`: Web Worker script that handles gravitational calculations (currently only Sun -> other bodies) and updates positions/velocities.
*   Texture files (`*.jpg`, `*.png`): Images used for planet surfaces, bump maps, specular maps, and the skybox.
