// Three.js scene setup for shipwith.dev
// Wrapped for easy calling from Rust/WASM

let scene, camera, renderer, controls;
let components = [];
let isInitialized = false;
let isExploded = false;

// Component definitions with colors and positions
const COMPONENTS = [
    { id: 'user', name: 'User', color: '#4CAF50', pos: { x: 0, y: 0.5, z: 4 } },
    { id: 'browser', name: 'Browser', color: '#2196F3', pos: { x: 0, y: 0, z: 2 } },
    { id: 'workers', name: 'CF Workers', color: '#F6821F', pos: { x: -1.2, y: 0, z: 0 } },
    { id: 'pages', name: 'CF Pages', color: '#F6821F', pos: { x: 1.2, y: 0, z: 0 } },
    { id: 'wasm', name: 'Rust/WASM', color: '#F6821F', pos: { x: -1.2, y: 0, z: -2 } },
    { id: 'threejs', name: 'Three.js', color: '#333333', pos: { x: 1.2, y: 0, z: -2 } },
    { id: 'kv', name: 'CF KV', color: '#9C27B0', pos: { x: -1.2, y: 0, z: -4 } },
    { id: 'd1', name: 'CF D1', color: '#9C27B0', pos: { x: 1.2, y: 0, z: -4 } },
];

// Create a canvas texture with label
function createLabelTexture(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Background with rounded corners
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 236, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Handle multi-word names
    const words = name.split(' ');
    if (words.length > 1 && name.length > 10) {
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText(words[0], 128, 115);
        ctx.fillText(words.slice(1).join(' '), 128, 145);
    } else {
        ctx.fillText(name, 128, 128);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Create component mesh
function createComponent(comp) {
    const texture = createLabelTexture(comp.name, comp.color);
    const geometry = new THREE.PlaneGeometry(1.8, 1.8);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(comp.pos.x, comp.pos.y, comp.pos.z);
    mesh.userData = {
        id: comp.id,
        name: comp.name,
        basePosition: { ...comp.pos }
    };

    return mesh;
}

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

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1d1d);

    // Camera - positioned to see all components
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    // Create all components
    COMPONENTS.forEach(comp => {
        const mesh = createComponent(comp);
        scene.add(mesh);
        components.push(mesh);
    });
    console.log(`Added ${components.length} components to scene`);

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

    // Make components face the camera (billboard effect)
    components.forEach(mesh => {
        mesh.lookAt(camera.position);
    });

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
            console.log('Explode clicked');
            explodeComponents();
            btnDeconstruct.classList.add('hidden');
            btnReconstruct.classList.remove('hidden');
        });
    }

    if (btnReconstruct) {
        btnReconstruct.addEventListener('click', () => {
            console.log('Reconstruct clicked');
            reconstructComponents();
            btnReconstruct.classList.add('hidden');
            btnDeconstruct.classList.remove('hidden');
        });
    }
};

// Explode animation - spread components outward
function explodeComponents() {
    if (isExploded) return;
    isExploded = true;

    const duration = 800;
    const spreadFactor = 2.5;
    const startTime = Date.now();

    // Store starting positions
    const startPositions = components.map(mesh => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    }));

    // Calculate target positions (spread from center)
    const targetPositions = components.map(mesh => {
        const base = mesh.userData.basePosition;
        return {
            x: base.x * spreadFactor,
            y: base.y * spreadFactor + (base.z * 0.3), // Add vertical spread
            z: base.z * spreadFactor
        };
    });

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        components.forEach((mesh, i) => {
            mesh.position.x = startPositions[i].x + (targetPositions[i].x - startPositions[i].x) * eased;
            mesh.position.y = startPositions[i].y + (targetPositions[i].y - startPositions[i].y) * eased;
            mesh.position.z = startPositions[i].z + (targetPositions[i].z - startPositions[i].z) * eased;
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    step();

    // Also zoom camera out
    animateCamera({ x: 0, y: 4, z: 18 });
}

// Reconstruct animation - bring components back together
function reconstructComponents() {
    if (!isExploded) return;
    isExploded = false;

    const duration = 800;
    const startTime = Date.now();

    // Store starting positions
    const startPositions = components.map(mesh => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    }));

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        components.forEach((mesh, i) => {
            const base = mesh.userData.basePosition;
            mesh.position.x = startPositions[i].x + (base.x - startPositions[i].x) * eased;
            mesh.position.y = startPositions[i].y + (base.y - startPositions[i].y) * eased;
            mesh.position.z = startPositions[i].z + (base.z - startPositions[i].z) * eased;
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    step();

    // Also zoom camera back in
    animateCamera({ x: 0, y: 2, z: 8 });
}

// Animate camera to target position
function animateCamera(target) {
    const startPos = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    };
    const duration = 800;
    const startTime = Date.now();

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.x = startPos.x + (target.x - startPos.x) * eased;
        camera.position.y = startPos.y + (target.y - startPos.y) * eased;
        camera.position.z = startPos.z + (target.z - startPos.z) * eased;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    step();
}
