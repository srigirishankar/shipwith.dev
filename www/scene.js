// Three.js scene setup for shipwith.dev
// Wrapped for easy calling from Rust/WASM

let scene, camera, renderer, controls;
let components = [];
let connections = [];
let particles = [];
let isInitialized = false;
let isExploded = false;
let currentProvider = 'mixed';
let isMixedMode = true;

// Per-component provider selection (only used in mixed mode)
let componentProviders = {
    workers: 'cf',
    pages: 'cf',
    kv: 'cf',
    d1: 'cf'
};

// Swappable component IDs
const SWAPPABLE_COMPONENTS = ['workers', 'pages', 'kv', 'd1'];

// Raycasting for click detection
let raycaster, mouse;

// Touch tracking
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
const TAP_THRESHOLD_MS = 300;
const TAP_MOVE_THRESHOLD = 10;

// Provider-specific metrics (total for hobby app ~100k req/mo)
// Latency = max component latency for that provider (consistent with calculateMixedMetrics)
const PROVIDER_METRICS = {
    cf: { cost: '$0', latency: '20ms', uptime: '99.99%', locations: '300+' },      // max(12,10,5,20)
    gcp: { cost: '$15/mo', latency: '100ms', uptime: '99.95%', locations: '35' },  // max(50,15,20,100)
    aws: { cost: '$45/mo', latency: '50ms', uptime: '99.99%', locations: '400+' }, // max(30,15,10,50)
    azure: { cost: '$70/mo', latency: '100ms', uptime: '99.95%', locations: '60+' } // max(50,15,20,100)
};

// Provider-specific component names (only for swappable services)
const PROVIDER_COMPONENTS = {
    cf: {
        workers: { name: 'CF Workers', color: '#F6821F' },
        pages: { name: 'CF Pages', color: '#F6821F' },
        kv: { name: 'CF KV', color: '#9C27B0' },
        d1: { name: 'CF D1', color: '#9C27B0' }
    },
    gcp: {
        workers: { name: 'Cloud Run', color: '#4285F4' },
        pages: { name: 'Firebase', color: '#FFCA28' },
        kv: { name: 'Firestore', color: '#FFCA28' },
        d1: { name: 'Cloud SQL', color: '#4285F4' }
    },
    aws: {
        workers: { name: 'Lambda@Edge', color: '#FF9900' },
        pages: { name: 'Amplify', color: '#FF9900' },
        kv: { name: 'DynamoDB', color: '#527FFF' },
        d1: { name: 'Aurora', color: '#527FFF' }
    },
    azure: {
        workers: { name: 'Functions', color: '#0078D4' },
        pages: { name: 'Static Apps', color: '#0078D4' },
        kv: { name: 'Cosmos DB', color: '#0078D4' },
        d1: { name: 'Azure SQL', color: '#0078D4' }
    }
};

// Per-component costs in $/month for hobby app (~100k requests)
const COMPONENT_COSTS = {
    workers: { cf: 0, gcp: 0, aws: 0, azure: 0 },
    pages: { cf: 0, gcp: 0, aws: 0, azure: 0 },
    kv: { cf: 0, gcp: 0, aws: 0, azure: 5 },
    d1: { cf: 0, gcp: 15, aws: 45, azure: 65 }
};

// Per-component latency in ms (warm, p50)
const COMPONENT_LATENCY = {
    workers: { cf: 12, gcp: 50, aws: 30, azure: 50 },
    pages: { cf: 10, gcp: 15, aws: 15, azure: 15 },
    kv: { cf: 5, gcp: 20, aws: 10, azure: 20 },
    d1: { cf: 20, gcp: 100, aws: 50, azure: 100 }
};

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

// Component info database with descriptions, docs, and cloud alternatives
const COMPONENT_INFO = {
    user: {
        description: 'You! The person interacting with this visualization.',
        reasons: ['Every architecture starts with a user', 'Understanding user flow is key to good design'],
        docs: null,
        alternatives: null
    },
    browser: {
        description: 'The web browser rendering this visualization using WebGL.',
        reasons: ['Universal access - no install needed', 'Sandboxed security model', 'WebGL for hardware-accelerated 3D'],
        docs: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API',
        alternatives: null
    },
    workers: {
        description: 'Serverless functions running at the edge in 300+ locations worldwide.',
        reasons: ['0ms cold starts', 'Runs within 50ms of 95% of internet users', 'Free tier: 100k requests/day'],
        docs: 'https://developers.cloudflare.com/workers/',
        alternatives: {
            gcp: { name: 'Cloud Run functions', url: 'https://cloud.google.com/functions/docs', description: 'Serverless compute for event-driven functions' },
            aws: { name: 'Lambda@Edge', url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html', description: 'Code at CloudFront edge locations' },
            azure: { name: 'Azure Functions', url: 'https://learn.microsoft.com/en-us/azure/azure-functions/', description: 'Event-driven serverless compute' }
        }
    },
    pages: {
        description: 'Static site hosting with automatic Git deployments and global CDN.',
        reasons: ['Instant global cache invalidation', 'Automatic HTTPS and HTTP/3', 'Preview URLs for every PR'],
        docs: 'https://developers.cloudflare.com/pages/',
        alternatives: {
            gcp: { name: 'Firebase Hosting', url: 'https://firebase.google.com/docs/hosting', description: 'Fast CDN hosting for web apps' },
            aws: { name: 'Amplify Hosting', url: 'https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html', description: 'Git-based CI/CD hosting' },
            azure: { name: 'Static Web Apps', url: 'https://learn.microsoft.com/en-us/azure/static-web-apps/', description: 'Static hosting with serverless APIs' }
        }
    },
    wasm: {
        description: 'This visualization is written in Rust and compiled to WebAssembly.',
        reasons: ['Near-native execution speed', 'Memory safety without garbage collection', 'Small binary size'],
        docs: 'https://rustwasm.github.io/docs/book/',
        alternatives: null
    },
    threejs: {
        description: 'Industry-standard 3D graphics library powering the visualization.',
        reasons: ['Mature ecosystem', 'Hardware-accelerated WebGL', 'Great WASM interop'],
        docs: 'https://threejs.org/docs/',
        alternatives: null
    },
    kv: {
        description: 'Global key-value storage with millisecond reads at the edge.',
        reasons: ['Eventually consistent, perfect for caching', 'Reads from nearest edge location', 'Simple key-value API'],
        docs: 'https://developers.cloudflare.com/kv/',
        alternatives: {
            gcp: { name: 'Firestore', url: 'https://firebase.google.com/docs/firestore', description: 'NoSQL serverless database' },
            aws: { name: 'DynamoDB', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html', description: 'Managed NoSQL key-value store' },
            azure: { name: 'Cosmos DB', url: 'https://learn.microsoft.com/en-us/azure/cosmos-db/', description: 'Globally distributed multi-model database' }
        }
    },
    d1: {
        description: 'SQLite at the edge. Full relational database without managing servers.',
        reasons: ['Familiar SQL interface', 'Automatic replication', 'Generous free tier'],
        docs: 'https://developers.cloudflare.com/d1/',
        alternatives: {
            gcp: { name: 'Cloud SQL', url: 'https://cloud.google.com/sql/docs', description: 'Managed MySQL/PostgreSQL' },
            aws: { name: 'Aurora Serverless', url: 'https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html', description: 'On-demand autoscaling database' },
            azure: { name: 'Azure SQL', url: 'https://learn.microsoft.com/en-us/azure/azure-sql/', description: 'Managed SQL Server in the cloud' }
        }
    }
};

// Create a small text sprite for connection labels
function createLabelSprite(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');

    // Semi-transparent background pill
    ctx.fillStyle = 'rgba(29, 29, 29, 0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 40, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 24);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.8, 0.3, 1);

    return sprite;
}

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

    // Info indicator (small "i" in bottom-right corner)
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(220, 220, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', 220, 221);

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

    // Create label sprite at curve midpoint
    const labelSprite = createLabelSprite(connDef.label, connDef.color);
    const midPoint = curve.getPoint(0.5);
    labelSprite.position.copy(midPoint);
    labelSprite.position.y += 0.25; // Slight offset above the curve

    line.userData = {
        from: connDef.from,
        to: connDef.to,
        label: connDef.label,
        curve: curve,
        baseFromPos: { ...fromPos },
        baseToPos: { ...toPos },
        labelSprite: labelSprite
    };

    return { line, labelSprite };
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

    // Update label sprite position to curve midpoint
    if (connection.userData.labelSprite) {
        const midPoint = curve.getPoint(0.5);
        connection.userData.labelSprite.position.copy(midPoint);
        connection.userData.labelSprite.position.y += 0.25;
    }
}

// Track mouse position for raycasting
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Handle click - raycast to find component
function onClick(event) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(components);

    if (intersects.length > 0) {
        const clickedComponent = intersects[0].object;
        console.log('Clicked component:', clickedComponent.userData.id);
        showInfoPanel(clickedComponent.userData.id);
    }
}

// Touch event handlers for mobile
function onTouchStart(event) {
    if (event.touches.length === 1) {
        touchStartTime = Date.now();
        touchStartPos.x = event.touches[0].clientX;
        touchStartPos.y = event.touches[0].clientY;
        // Update mouse position for potential tap
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        // Update mouse position during drag
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
}

function onTouchEnd(event) {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;

    // Get end position from changedTouches (touches is empty on touchend)
    if (event.changedTouches.length === 1) {
        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const moveDistance = Math.sqrt(
            Math.pow(endX - touchStartPos.x, 2) +
            Math.pow(endY - touchStartPos.y, 2)
        );

        // Detect tap: short duration + minimal movement
        if (touchDuration < TAP_THRESHOLD_MS && moveDistance < TAP_MOVE_THRESHOLD) {
            // Update mouse to final touch position
            mouse.x = (endX / window.innerWidth) * 2 - 1;
            mouse.y = -(endY / window.innerHeight) * 2 + 1;

            // Perform raycast like click
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(components);

            if (intersects.length > 0) {
                const tappedComponent = intersects[0].object;
                console.log('Tapped component:', tappedComponent.userData.id);
                showInfoPanel(tappedComponent.userData.id);
            }
        }
    }
}

// Track current panel component for provider switching
let currentPanelComponentId = null;

// Show info panel for a component
function showInfoPanel(componentId) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    const comp = COMPONENTS.find(c => c.id === componentId);
    const info = COMPONENT_INFO[componentId];
    if (!comp || !info) return;

    currentPanelComponentId = componentId;

    // Get display name based on mode
    const displayName = getComponentDisplayName(componentId);

    // Populate panel
    document.getElementById('panel-title').textContent = displayName;
    document.getElementById('panel-description').textContent = info.description;

    // Show/hide provider selector (only in mixed mode for swappable components)
    const providerSelector = document.getElementById('panel-provider-selector');
    const providerSelect = document.getElementById('panel-provider-select');
    if (providerSelector && providerSelect) {
        if (isMixedMode && SWAPPABLE_COMPONENTS.includes(componentId)) {
            providerSelector.classList.remove('hidden');
            providerSelect.value = componentProviders[componentId];
        } else {
            providerSelector.classList.add('hidden');
        }
    }

    // Populate reasons list
    const reasonsList = document.getElementById('panel-reasons-list');
    reasonsList.innerHTML = '';
    info.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        reasonsList.appendChild(li);
    });

    // Setup docs link - use provider-specific URL if available
    const docsLink = document.getElementById('panel-docs-link');
    let docsUrl = info.docs;

    // Check for provider-specific alternative
    if (currentProvider !== 'cf' && info.alternatives && info.alternatives[currentProvider]) {
        docsUrl = info.alternatives[currentProvider].url;
    }

    if (docsUrl) {
        docsLink.href = docsUrl;
        docsLink.target = '_blank';
        docsLink.rel = 'noopener noreferrer';
        docsLink.style.display = 'inline';
    } else {
        docsLink.style.display = 'none';
    }

    // Show panel
    panel.classList.remove('hidden');
}

// Hide info panel
function hideInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

// Calculate mixed mode totals
function calculateMixedMetrics() {
    let totalCost = 0;
    let maxLatency = 0;

    SWAPPABLE_COMPONENTS.forEach(id => {
        const provider = componentProviders[id];
        totalCost += COMPONENT_COSTS[id]?.[provider] || 0;
        maxLatency = Math.max(maxLatency, COMPONENT_LATENCY[id]?.[provider] || 0);
    });

    return {
        cost: totalCost === 0 ? '$0' : `$${totalCost}/mo`,
        latency: `${maxLatency}ms`,
        uptime: '99.97%', // Weighted average approximation
        locations: 'Varies'
    };
}

// Update cost matrix display
function updateMetrics() {
    // Update mixed row with current calculations
    const mixedMetrics = calculateMixedMetrics();
    const mixedCostEl = document.getElementById('mixed-cost');
    const mixedLatencyEl = document.getElementById('mixed-latency');

    if (mixedCostEl) mixedCostEl.textContent = mixedMetrics.cost;
    if (mixedLatencyEl) mixedLatencyEl.textContent = mixedMetrics.latency;

    // Update row highlighting based on current provider
    const rows = document.querySelectorAll('#cost-matrix-body tr');
    rows.forEach(row => {
        const rowProvider = row.dataset.provider;
        if (rowProvider === currentProvider) {
            row.classList.add('current');
        } else {
            row.classList.remove('current');
        }
    });
}

// Handle provider change - update components and metrics
function onProviderChange(provider) {
    currentProvider = provider;

    if (provider === 'mixed') {
        isMixedMode = true;
        // In mixed mode, use per-component providers
        updateAllComponentTextures();
    } else {
        isMixedMode = false;
        // Reset all component providers to the selected provider
        SWAPPABLE_COMPONENTS.forEach(id => {
            componentProviders[id] = provider;
        });
        // Update all components to use this provider
        updateAllComponentTextures();
    }

    // Update metrics/matrix
    updateMetrics();

    // Close info panel (provider context changed)
    hideInfoPanel();
}

// Update a single component's texture based on its provider
function updateSingleComponentTexture(componentId) {
    const mesh = components.find(m => m.userData.id === componentId);
    if (!mesh) return;

    const provider = componentProviders[componentId];
    const providerComp = PROVIDER_COMPONENTS[provider]?.[componentId];
    if (!providerComp) return;

    // Get display name (with prefix in mixed mode)
    const displayName = getComponentDisplayName(componentId);

    // Regenerate texture
    const newTexture = createLabelTexture(displayName, providerComp.color);
    mesh.material.map = newTexture;
    mesh.material.needsUpdate = true;
    mesh.userData.name = displayName;
}

// Update all swappable component textures
function updateAllComponentTextures() {
    components.forEach(mesh => {
        const id = mesh.userData.id;
        if (SWAPPABLE_COMPONENTS.includes(id)) {
            updateSingleComponentTexture(id);
        }
    });
}

// Get display name for component (with provider prefix in mixed mode)
function getComponentDisplayName(componentId) {
    if (!SWAPPABLE_COMPONENTS.includes(componentId)) {
        // Non-swappable components keep original name
        const comp = COMPONENTS.find(c => c.id === componentId);
        return comp ? comp.name : componentId;
    }

    const provider = isMixedMode ? componentProviders[componentId] : currentProvider;
    const providerComp = PROVIDER_COMPONENTS[provider]?.[componentId];
    if (!providerComp) return componentId;

    if (isMixedMode) {
        // Show prefix in mixed mode: "CF-Workers", "AWS-Lambda"
        const prefixes = { cf: 'CF', gcp: 'GCP', aws: 'AWS', azure: 'Azure' };
        return `${prefixes[provider]}-${providerComp.name}`;
    }
    return providerComp.name;
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

    // Raycaster for click detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create all components
    COMPONENTS.forEach(comp => {
        const mesh = createComponent(comp);
        scene.add(mesh);
        components.push(mesh);
    });
    console.log(`Added ${components.length} components to scene`);

    // Create all connections
    CONNECTIONS.forEach(connDef => {
        const result = createConnection(connDef);
        if (result) {
            const { line, labelSprite } = result;
            scene.add(line);
            scene.add(labelSprite);
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

    // Mouse events for raycasting
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    // Apply initial mixed mode textures
    updateAllComponentTextures();

    // Initialize metrics display
    updateMetrics();

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
    const btnClosePanel = document.getElementById('close-panel');
    const providerSelect = document.getElementById('provider-select');
    const panelProviderSelect = document.getElementById('panel-provider-select');

    if (providerSelect) {
        providerSelect.addEventListener('change', (e) => {
            onProviderChange(e.target.value);
        });
    }

    // Panel provider selector - switch individual component provider
    if (panelProviderSelect) {
        panelProviderSelect.addEventListener('change', (e) => {
            if (currentPanelComponentId && SWAPPABLE_COMPONENTS.includes(currentPanelComponentId)) {
                // Update this component's provider
                componentProviders[currentPanelComponentId] = e.target.value;
                // Update the component's texture
                updateSingleComponentTexture(currentPanelComponentId);
                // Update metrics
                updateMetrics();
                // Update panel title to reflect new name
                document.getElementById('panel-title').textContent = getComponentDisplayName(currentPanelComponentId);
            }
        });
    }

    // Cost matrix row click handlers
    const matrixRows = document.querySelectorAll('#cost-matrix-body tr');
    matrixRows.forEach(row => {
        row.addEventListener('click', () => {
            const provider = row.dataset.provider;
            if (provider && providerSelect) {
                providerSelect.value = provider;
                onProviderChange(provider);
            }
        });
    });

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

    if (btnClosePanel) {
        btnClosePanel.addEventListener('click', () => {
            hideInfoPanel();
        });
    }
};

// Explode animation - arrange as architecture diagram
function explodeComponents() {
    if (isExploded) return;
    isExploded = true;

    // Hide coming-soon panel on desktop during exploded view
    document.getElementById('coming-soon')?.classList.add('scene-exploded');

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

    // Camera: front view to see flat diagram, positioned lower to avoid cost matrix
    animateCamera({ x: 0, y: -0.5, z: 18 });
}

// Reconstruct animation - bring components back together
function reconstructComponents() {
    if (!isExploded) return;
    isExploded = false;

    // Show coming-soon panel again
    document.getElementById('coming-soon')?.classList.remove('scene-exploded');

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
