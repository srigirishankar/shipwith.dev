// Three.js scene setup for shipwith.dev
// Wrapped for easy calling from Rust/WASM

let scene, camera, renderer, controls;
let components = [];
let connections = [];
let particles = [];
let isInitialized = false;
let isExploded = false;

// Component definitions with colors and positions
// pos = assembled (compact 3D), exploded = architecture diagram (flat 2D)
const COMPONENTS = [
    { id: 'user', name: 'User', color: '#4CAF50',
      pos: { x: 0, y: 0.5, z: 4 },
      exploded: { x: 0, y: 6, z: 0 } },
    { id: 'browser', name: 'Browser', color: '#2196F3',
      pos: { x: 0, y: 0, z: 2 },
      exploded: { x: 0, y: 3.5, z: 0 } },
    { id: 'workers', name: 'CF Workers', color: '#F6821F',
      pos: { x: -1.2, y: 0, z: 0 },
      exploded: { x: -3.5, y: 1, z: 0 } },
    { id: 'pages', name: 'CF Pages', color: '#F6821F',
      pos: { x: 1.2, y: 0, z: 0 },
      exploded: { x: 3.5, y: 1, z: 0 } },
    { id: 'wasm', name: 'Rust/WASM', color: '#F6821F',
      pos: { x: -1.2, y: 0, z: -2 },
      exploded: { x: 3.5, y: -1.5, z: 0 } },
    { id: 'threejs', name: 'Three.js', color: '#333333',
      pos: { x: 1.2, y: 0, z: -2 },
      exploded: { x: 3.5, y: -4, z: 0 } },
    { id: 'kv', name: 'CF KV', color: '#9C27B0',
      pos: { x: -1.2, y: 0, z: -4 },
      exploded: { x: -5, y: -1.5, z: 0 } },
    { id: 'd1', name: 'CF D1', color: '#9C27B0',
      pos: { x: 1.2, y: 0, z: -4 },
      exploded: { x: -2, y: -1.5, z: 0 } },
];

// Connection definitions (from -> to with labels)
const CONNECTIONS = [
    { from: 'user', to: 'browser', label: 'HTTP', color: '#4CAF50' },
    { from: 'browser', to: 'pages', label: 'Static', color: '#2196F3' },
    { from: 'browser', to: 'workers', label: 'API', color: '#2196F3' },
    { from: 'pages', to: 'wasm', label: 'WASM', color: '#F6821F' },
    { from: 'wasm', to: 'threejs', label: 'Render', color: '#F6821F' },
    { from: 'workers', to: 'kv', label: 'Cache', color: '#9C27B0' },
    { from: 'workers', to: 'd1', label: 'SQL', color: '#9C27B0' },
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
        basePosition: { ...comp.pos },
        explodedPosition: { ...comp.exploded }
    };

    return mesh;
}

// Get component mesh by ID
function getComponentById(id) {
    return components.find(c => c.userData.id === id);
}

// Get component base position by ID
function getBasePositionById(id) {
    const comp = COMPONENTS.find(c => c.id === id);
    return comp ? comp.pos : null;
}

// Create a curved connection line between two components
function createConnection(connDef) {
    const fromPos = getBasePositionById(connDef.from);
    const toPos = getBasePositionById(connDef.to);
    if (!fromPos || !toPos) return null;

    // Create curve with control point for nice arc
    const start = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);
    const end = new THREE.Vector3(toPos.x, toPos.y, toPos.z);

    // Control point: midpoint + offset for curve
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.8; // Lift the curve up
    mid.x += (end.x - start.x) * 0.2; // Slight horizontal offset

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
        color: connDef.color,
        transparent: true,
        opacity: 0.6,
        linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
        from: connDef.from,
        to: connDef.to,
        label: connDef.label,
        curve: curve,
        baseFromPos: { ...fromPos },
        baseToPos: { ...toPos }
    };

    return line;
}

// Create flowing particle for a connection
function createParticle(connection) {
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const particle = new THREE.Mesh(geometry, material);

    // Random starting position along curve
    particle.userData = {
        connection: connection,
        progress: Math.random(), // 0 to 1 along curve
        speed: 0.003 + Math.random() * 0.002 // Varying speeds
    };

    return particle;
}

// Update connection curve based on current component positions
function updateConnectionCurve(connection) {
    const fromComp = getComponentById(connection.userData.from);
    const toComp = getComponentById(connection.userData.to);
    if (!fromComp || !toComp) return;

    const start = fromComp.position.clone();
    const end = toComp.position.clone();

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.8 * (isExploded ? 2 : 1);
    mid.x += (end.x - start.x) * 0.2;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(32);

    connection.geometry.setFromPoints(points);
    connection.userData.curve = curve;
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

    // Create all connections
    CONNECTIONS.forEach(connDef => {
        const line = createConnection(connDef);
        if (line) {
            scene.add(line);
            connections.push(line);

            // Add 2-3 particles per connection
            const numParticles = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numParticles; i++) {
                const particle = createParticle(line);
                scene.add(particle);
                particles.push(particle);
            }
        }
    });
    console.log(`Added ${connections.length} connections with ${particles.length} particles`);

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

    // Update connection curves to follow component positions
    connections.forEach(conn => {
        updateConnectionCurve(conn);
    });

    // Animate particles along their curves
    particles.forEach(particle => {
        const conn = particle.userData.connection;
        const curve = conn.userData.curve;
        if (!curve) return;

        // Move particle along curve
        particle.userData.progress += particle.userData.speed;
        if (particle.userData.progress > 1) {
            particle.userData.progress = 0;
        }

        // Get position on curve
        const pos = curve.getPoint(particle.userData.progress);
        particle.position.copy(pos);
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

// Explode animation - arrange as architecture diagram
function explodeComponents() {
    if (isExploded) return;
    isExploded = true;

    const duration = 1000;
    const startTime = Date.now();

    // Store starting positions
    const startPositions = components.map(mesh => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    }));

    // Use explicit exploded positions for architecture diagram layout
    const targetPositions = components.map(mesh => mesh.userData.explodedPosition);

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

    // Camera: front view to see flat diagram
    animateCamera({ x: 0, y: 1, z: 16 });
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
