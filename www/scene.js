// Three.js scene setup for shipwith.dev
// Wrapped for easy calling from Rust/WASM

let scene, camera, renderer, controls, cube;
let isInitialized = false;

// Initialize the Three.js scene
window.initScene = function() {
    if (isInitialized) {
        console.log('Scene already initialized');
        return;
    }

    console.log('Initializing Three.js scene...');

    const canvas = document.getElementById('scene');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    console.log('Canvas found:', canvas);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1d1d);

    // Camera - positioned to see the cube
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.z = 5;
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Orbit Controls - allows mouse rotation/zoom
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.enablePan = false;
    console.log('Orbit controls added');

    // Add a simple test object (orange cube) to verify rendering
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshBasicMaterial({
        color: 0xF6821F,
        wireframe: false
    });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    console.log('Cube added to scene');

    // Also add edges for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cube.add(wireframe);

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start animation loop
    isInitialized = true;
    animate();

    console.log('Three.js scene initialized successfully');
};

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);

    // Update orbit controls (for damping)
    if (controls) {
        controls.update();
    }

    // Rotate the test cube
    if (cube) {
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.01;
    }

    renderer.render(scene, camera);
}

// Expose scene objects for later use
window.getScene = function() { return scene; };
window.getCamera = function() { return camera; };
window.getRenderer = function() { return renderer; };

// Button handlers
window.initButtons = function() {
    const btnDeconstruct = document.getElementById('btn-deconstruct');
    const btnReconstruct = document.getElementById('btn-reconstruct');

    if (btnDeconstruct) {
        btnDeconstruct.addEventListener('click', () => {
            console.log('Deconstruct clicked');
            // Placeholder: zoom out to show "deconstructed" view
            if (controls) {
                // Animate camera back
                const targetZ = 12;
                animateCamera(targetZ);
            }
            btnDeconstruct.classList.add('hidden');
            btnReconstruct.classList.remove('hidden');
        });
    }

    if (btnReconstruct) {
        btnReconstruct.addEventListener('click', () => {
            console.log('Reconstruct clicked');
            // Placeholder: zoom back in
            if (controls) {
                const targetZ = 5;
                animateCamera(targetZ);
            }
            btnReconstruct.classList.add('hidden');
            btnDeconstruct.classList.remove('hidden');
        });
    }
};

function animateCamera(targetZ) {
    const startZ = camera.position.z;
    const duration = 800;
    const startTime = Date.now();

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.z = startZ + (targetZ - startZ) * eased;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    step();
}
