// Three.js scene setup for shipwith.dev
// Wrapped for easy calling from Rust/WASM

// ============================================
// SINGLE PANE MODE (Responsive Redesign)
// When true, renders one full-width viewport instead of split
// ============================================
let SINGLE_PANE_MODE = true; // Default to new responsive single-pane mode

// Single camera for single-pane mode
let singleCamera = null;

// Current stack being displayed (in single-pane mode)
let currentStack = 'cloudflare';

// Track components being animated during stack transition
let transitioningComponents = new Set();

let scene, camera, renderer, controls;
// Legacy arrays - now unused, kept for any old code compatibility
let components = [];
let connections = [];
let particles = [];
let isInitialized = false;
let isExploded = false;
let currentProvider = 'mixed';
let isMixedMode = true;

// ============================================
// SPLIT-SCREEN COMPARISON VIEW (Default mode)
// Left = Pure Cloudflare, Right = Mixed/Customizable
// ============================================
let leftComponents = [];   // Pure CF (read-only reference)
let rightComponents = [];  // Mixed (user can swap)
let leftConnections = [];
let rightConnections = [];
let leftParticles = [];
let rightParticles = [];

// X-axis offsets for split view
const LEFT_OFFSET = -5;
const RIGHT_OFFSET = 5;

// Debug mode - shows boundary lines for component areas
const DEBUG_BOUNDS = true;
let debugLines = [];

// Panel dimensions (must match CSS)
const PANEL_WIDTH_PX = 280;
const PANEL_PADDING_PX = 16; // 1rem

// Header height (column labels + dropdown) - viewport starts below this
const HEADER_HEIGHT_PX = 80;

// Dynamic view shift - calculated based on viewport
let currentViewShift = 1.5;

// Column shift for panel-open animation (components move left when panel opens)
let leftColumnShift = 0;
let rightColumnShift = 0;

// Flag to disable animate loop's position lerping during reconstruct animation
let isReconstructing = false;

// Two cameras for split viewport
let leftCamera, rightCamera;

// Per-component provider selection (for right side - mixed mode)
let componentProviders = {
    workers: 'cf',
    pages: 'cf',
    kv: 'cf',
    d1: 'cf'
};

// Swappable component IDs
const SWAPPABLE_COMPONENTS = ['workers', 'pages', 'kv', 'd1'];

// Also swappable: client-side tech
const CLIENT_SWAPPABLE = ['wasm', 'threejs'];

// ============================================
// ALTERNATIVES DATABASE (Top 3 per component)
// Based on deep research - includes dependencies & compatibility
// ============================================

const ALTERNATIVES = {
    workers: {
        current: { id: 'cf-workers', name: 'Cloudflare Workers', provider: 'cf', color: '#F6821F' },
        options: [
            {
                id: 'vercel-edge',
                name: 'Vercel Edge',
                provider: 'vercel',
                color: '#000000',
                coldStart: '30ms',
                cost: '$15/mo @10M req',
                locations: '200+',
                description: 'Next.js native, excellent DX',
                docs: 'https://vercel.com/docs/functions/edge-functions',
                pairsWellWith: ['vercel-hosting', 'upstash-redis', 'neon'],
                warnings: { 'cf-pages': 'Cross-platform: may increase latency', 'cf-kv': 'Use Vercel KV instead' }
            },
            {
                id: 'deno-deploy',
                name: 'Deno Deploy',
                provider: 'deno',
                color: '#70FFAF',
                coldStart: '20ms',
                cost: '$20/mo @10M req',
                locations: '12+',
                description: 'Fastest cold starts, TypeScript-first',
                docs: 'https://deno.com/deploy',
                pairsWellWith: ['netlify-hosting', 'deno-kv', 'supabase'],
                warnings: { 'cf-kv': 'Use Deno KV instead', 'cf-d1': 'Use Supabase instead' }
            },
            {
                id: 'lambda-edge',
                name: 'Lambda@Edge',
                provider: 'aws',
                color: '#FF9900',
                coldStart: '100-1000ms',
                cost: '$17/mo @10M req',
                locations: '700+',
                description: 'AWS ecosystem, enterprise-grade',
                docs: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html',
                pairsWellWith: ['amplify', 'dynamodb', 'aurora'],
                warnings: { 'cf-pages': 'Use Amplify instead', 'cf-kv': 'Use DynamoDB instead' }
            }
        ]
    },
    pages: {
        current: { id: 'cf-pages', name: 'Cloudflare Pages', provider: 'cf', color: '#F6821F' },
        options: [
            {
                id: 'vercel-hosting',
                name: 'Vercel',
                provider: 'vercel',
                color: '#000000',
                cost: 'Free-$20/mo',
                locations: '200+ (multi-cloud)',
                description: 'Best Next.js support, instant deploys',
                docs: 'https://vercel.com/docs',
                pairsWellWith: ['vercel-edge', 'upstash-redis', 'neon'],
                warnings: { 'cf-workers': 'Use Vercel Edge instead' }
            },
            {
                id: 'netlify',
                name: 'Netlify',
                provider: 'netlify',
                color: '#00C7B7',
                cost: 'Free-$19/mo',
                locations: '100+',
                description: 'JAMstack specialist, great forms',
                docs: 'https://docs.netlify.com/',
                pairsWellWith: ['deno-deploy', 'upstash-redis', 'supabase'],
                warnings: { 'cf-workers': 'Use Netlify Functions instead' }
            },
            {
                id: 'amplify',
                name: 'AWS Amplify',
                provider: 'aws',
                color: '#FF9900',
                cost: '$1-3/mo hobby',
                locations: '450+ (CloudFront)',
                description: 'Full AWS integration, enterprise scale',
                docs: 'https://docs.amplify.aws/',
                pairsWellWith: ['lambda-edge', 'dynamodb', 'aurora'],
                warnings: { 'cf-workers': 'Use Lambda@Edge instead', 'cf-kv': 'Use DynamoDB instead' }
            }
        ]
    },
    kv: {
        current: { id: 'cf-kv', name: 'Cloudflare KV', provider: 'cf', color: '#F6821F' },
        options: [
            {
                id: 'upstash-redis',
                name: 'Upstash Redis',
                provider: 'upstash',
                color: '#00E9A3',
                readLatency: '<5ms',
                cost: '$0.20/100k req',
                description: 'Sub-5ms global reads, Redis API',
                docs: 'https://upstash.com/docs/redis/overall/getstarted',
                pairsWellWith: ['vercel-edge', 'vercel-hosting', 'netlify'],
                warnings: {}
            },
            {
                id: 'momento',
                name: 'Momento Cache',
                provider: 'momento',
                color: '#6366F1',
                readLatency: '<5ms p999',
                cost: '$1/M ops',
                description: 'Lowest latency, serverless-native',
                docs: 'https://docs.momentohq.com/',
                pairsWellWith: ['vercel-edge', 'lambda-edge', 'deno-deploy'],
                warnings: {}
            },
            {
                id: 'dynamodb',
                name: 'DynamoDB',
                provider: 'aws',
                color: '#FF9900',
                readLatency: '~5ms',
                cost: '$25/mo @10M',
                description: 'AWS native, global tables',
                docs: 'https://docs.aws.amazon.com/dynamodb/',
                pairsWellWith: ['lambda-edge', 'amplify', 'aurora'],
                warnings: { 'cf-workers': 'Higher latency from CF edge' }
            }
        ]
    },
    d1: {
        current: { id: 'cf-d1', name: 'Cloudflare D1', provider: 'cf', color: '#F6821F' },
        options: [
            {
                id: 'turso',
                name: 'Turso',
                provider: 'turso',
                color: '#4FF8D2',
                queryLatency: '<1ms reads',
                cost: '$4.99/mo',
                description: 'SQLite at edge, embedded replicas',
                docs: 'https://docs.turso.tech/',
                pairsWellWith: ['cf-workers', 'vercel-edge', 'deno-deploy'],
                warnings: {}
            },
            {
                id: 'neon',
                name: 'Neon',
                provider: 'neon',
                color: '#00E599',
                queryLatency: '3-8ms',
                cost: '$0-30/mo',
                description: 'Serverless Postgres, scale-to-zero',
                docs: 'https://neon.tech/docs/',
                pairsWellWith: ['vercel-edge', 'vercel-hosting', 'netlify'],
                warnings: { 'lambda-edge': 'Cold start adds latency' }
            },
            {
                id: 'planetscale',
                name: 'PlanetScale',
                provider: 'planetscale',
                color: '#000000',
                queryLatency: '50-67ms',
                cost: '$40+/mo',
                description: 'Vitess MySQL, 1M+ connections',
                docs: 'https://planetscale.com/docs',
                pairsWellWith: ['vercel-edge', 'lambda-edge', 'cf-workers'],
                warnings: {}
            }
        ]
    },
    wasm: {
        current: { id: 'rust-wasm', name: 'Rust/WASM', provider: 'rust', color: '#DEA584' },
        options: [
            {
                id: 'assemblyscript',
                name: 'AssemblyScript',
                provider: 'assemblyscript',
                color: '#007ACC',
                performance: '95% of Rust',
                bundleSize: '40-60% smaller',
                description: 'TypeScript-like syntax, fast iteration',
                docs: 'https://www.assemblyscript.org/introduction.html',
                pairsWellWith: ['threejs', 'babylonjs'],
                warnings: {}
            },
            {
                id: 'swift-wasm',
                name: 'Swift/WASM',
                provider: 'apple',
                color: '#F05138',
                performance: '95-100% of Rust',
                bundleSize: 'Medium',
                description: 'iOS cross-platform, memory safe',
                docs: 'https://swiftwasm.org/',
                pairsWellWith: ['threejs', 'babylonjs'],
                warnings: { 'note': 'Newer ecosystem, less tooling' }
            },
            {
                id: 'kotlin-wasm',
                name: 'Kotlin/WASM',
                provider: 'jetbrains',
                color: '#7F52FF',
                performance: '85-90% of Rust',
                bundleSize: 'Larger',
                description: 'Android cross-platform, Compose UI',
                docs: 'https://kotlinlang.org/docs/wasm-overview.html',
                pairsWellWith: ['threejs', 'babylonjs'],
                warnings: { 'note': 'Best for multiplatform teams' }
            }
        ]
    },
    threejs: {
        current: { id: 'threejs', name: 'Three.js', provider: 'threejs', color: '#049EF4' },
        options: [
            {
                id: 'babylonjs',
                name: 'Babylon.js',
                provider: 'microsoft',
                color: '#BB464B',
                bundleSize: '~400KB',
                features: 'Physics, VR, full engine',
                description: 'Microsoft-backed, batteries included',
                docs: 'https://doc.babylonjs.com/',
                pairsWellWith: ['rust-wasm', 'assemblyscript'],
                warnings: { 'note': 'Larger bundle, more features' }
            },
            {
                id: 'playcanvas',
                name: 'PlayCanvas',
                provider: 'playcanvas',
                color: '#E05D44',
                bundleSize: '~250KB',
                features: 'Cloud editor, team collab',
                description: 'Visual editor, great for teams',
                docs: 'https://developer.playcanvas.com/',
                pairsWellWith: ['rust-wasm', 'assemblyscript'],
                warnings: {}
            },
            {
                id: 'r3f',
                name: 'React Three Fiber',
                provider: 'pmndrs',
                color: '#61DAFB',
                bundleSize: '~175KB',
                features: 'React integration, declarative',
                description: 'React renderer for Three.js',
                docs: 'https://docs.pmnd.rs/react-three-fiber/',
                pairsWellWith: ['rust-wasm', 'vercel-hosting'],
                warnings: { 'note': 'Requires React ecosystem' }
            }
        ]
    }
};

// Dependency graph: which components naturally pair together
const DEPENDENCY_GRAPH = {
    'cf-workers': ['cf-pages', 'cf-kv', 'cf-d1', 'turso'],
    'cf-pages': ['cf-workers', 'cf-kv', 'cf-d1'],
    'cf-kv': ['cf-workers', 'cf-pages'],
    'cf-d1': ['cf-workers', 'cf-pages'],
    'vercel-edge': ['vercel-hosting', 'upstash-redis', 'neon', 'turso'],
    'vercel-hosting': ['vercel-edge', 'upstash-redis', 'neon'],
    'deno-deploy': ['netlify', 'upstash-redis', 'turso', 'supabase'],
    'lambda-edge': ['amplify', 'dynamodb', 'aurora'],
    'amplify': ['lambda-edge', 'dynamodb', 'aurora'],
    'upstash-redis': ['vercel-edge', 'vercel-hosting', 'netlify', 'cf-workers'],
    'momento': ['vercel-edge', 'lambda-edge', 'deno-deploy', 'cf-workers'],
    'dynamodb': ['lambda-edge', 'amplify'],
    'turso': ['cf-workers', 'vercel-edge', 'deno-deploy'],
    'neon': ['vercel-edge', 'vercel-hosting', 'netlify'],
    'planetscale': ['vercel-edge', 'lambda-edge', 'cf-workers']
};

// Suggested full stacks for auto-switching
const RECOMMENDED_STACKS = {
    'vercel': { workers: 'vercel-edge', pages: 'vercel-hosting', kv: 'upstash-redis', d1: 'neon' },
    'aws': { workers: 'lambda-edge', pages: 'amplify', kv: 'dynamodb', d1: 'aurora' },
    'deno': { workers: 'deno-deploy', pages: 'netlify', kv: 'upstash-redis', d1: 'turso' }
};

// ============================================
// Comparison Mode State
// ============================================
let comparisonMode = false;
let comparisonScene = null;  // Cloned scene for right side
let comparisonState = {
    left: { ...componentProviders },  // Current selection
    right: null  // Alternative selection (null = not comparing)
};
let selectedAlternatives = {};  // Track per-component alternative selections

// Raycasting for click detection
let raycaster, mouse;
let hoveredComponent = null;  // Track currently hovered component for glow effect

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
// Primary colors: CF=Orange, AWS=Yellow, GCP=Green, Azure=Blue
const PROVIDER_COLORS = {
    cf: '#F6821F',     // Cloudflare Orange
    aws: '#FFCC00',    // AWS Yellow
    gcp: '#34A853',    // Google Green
    azure: '#0078D4'   // Azure Blue
};

const PROVIDER_COMPONENTS = {
    cf: {
        workers: { name: 'Cloudflare Workers', color: PROVIDER_COLORS.cf },
        pages: { name: 'Cloudflare Pages', color: PROVIDER_COLORS.cf },
        kv: { name: 'Cloudflare KV', color: PROVIDER_COLORS.cf },
        d1: { name: 'Cloudflare D1', color: PROVIDER_COLORS.cf }
    },
    gcp: {
        workers: { name: 'GCP Cloud Run', color: PROVIDER_COLORS.gcp },
        pages: { name: 'Firebase Hosting', color: PROVIDER_COLORS.gcp },
        kv: { name: 'GCP Firestore', color: PROVIDER_COLORS.gcp },
        d1: { name: 'GCP Cloud SQL', color: PROVIDER_COLORS.gcp }
    },
    aws: {
        workers: { name: 'AWS Lambda@Edge', color: PROVIDER_COLORS.aws },
        pages: { name: 'AWS Amplify', color: PROVIDER_COLORS.aws },
        kv: { name: 'AWS DynamoDB', color: PROVIDER_COLORS.aws },
        d1: { name: 'AWS Aurora', color: PROVIDER_COLORS.aws }
    },
    azure: {
        workers: { name: 'Azure Functions', color: PROVIDER_COLORS.azure },
        pages: { name: 'Azure Static Apps', color: PROVIDER_COLORS.azure },
        kv: { name: 'Azure Cosmos DB', color: PROVIDER_COLORS.azure },
        d1: { name: 'Azure SQL', color: PROVIDER_COLORS.azure }
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

// Non-vendor component colors (distinct from provider colors)
const NON_VENDOR_COLORS = {
    user: '#4CAF50',      // Green (human/organic)
    browser: '#00BCD4',   // Cyan (web/tech)
    wasm: '#DEA584',      // Rust orange (Rust language)
    threejs: '#AAAAAA'    // Light gray (neutral/3D)
};

// Component definitions with colors and positions
// pos = assembled (compact 3D), exploded = architecture diagram (flat 2D)
// role = educational description of what the component does (line 1 on card)
// name = vendor + product name (line 2 on card)
const COMPONENTS = [
    { id: 'user', name: 'End User', role: null, color: NON_VENDOR_COLORS.user,
      pos: { x: 0, y: 0.5, z: 4 },
      exploded: { x: 0, y: 6, z: 0 } },
    { id: 'browser', name: 'Browser', role: 'Web Client', color: NON_VENDOR_COLORS.browser,
      pos: { x: 0, y: 0, z: 2 },
      exploded: { x: 0, y: 3.5, z: 0 } },
    { id: 'workers', name: 'Cloudflare Workers', role: 'Edge Functions', color: PROVIDER_COLORS.cf,
      pos: { x: -1.2, y: 0, z: 0 },
      exploded: { x: -3.5, y: 1, z: 0 } },
    { id: 'pages', name: 'Cloudflare Pages', role: 'Static Hosting', color: PROVIDER_COLORS.cf,
      pos: { x: 1.2, y: 0, z: 0 },
      exploded: { x: 3.5, y: 1, z: 0 } },
    { id: 'wasm', name: 'Rust/WASM', role: 'Computation', color: NON_VENDOR_COLORS.wasm,
      pos: { x: -1.2, y: 0, z: -2 },
      exploded: { x: 3.5, y: -1.5, z: 0 } },
    { id: 'threejs', name: 'Three.js', role: '3D Graphics', color: NON_VENDOR_COLORS.threejs,
      pos: { x: 1.2, y: 0, z: -2 },
      exploded: { x: 3.5, y: -4, z: 0 } },
    { id: 'kv', name: 'Cloudflare KV', role: 'Key-Value Store', color: PROVIDER_COLORS.cf,
      pos: { x: -1.2, y: 0, z: -4 },
      exploded: { x: -5, y: -1.5, z: 0 } },
    { id: 'd1', name: 'Cloudflare D1', role: 'SQL Database', color: PROVIDER_COLORS.cf,
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

// ============================================
// GLSL Shaders for Modern Glass Card Effects
// ============================================

const GLASS_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLASS_FRAGMENT_SHADER = `
uniform sampler2D cardTexture;
uniform float time;
uniform vec3 glowColor;
uniform float borderWidth;
uniform float glowIntensity;
uniform float hoverAmount;
uniform float pulsePhase;

varying vec2 vUv;

void main() {
    vec4 card = texture2D(cardTexture, vUv);

    // Distance from center for edge calculations
    vec2 centered = vUv - 0.5;

    // Rounded rectangle SDF (signed distance function)
    vec2 d = abs(centered) - vec2(0.42, 0.42) + 0.08;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.08;

    // Animated gradient angle (rotates around the border)
    float angle = atan(centered.y, centered.x) + time * 0.8;

    // Use provider color for border with brightness variation
    // Creates a "traveling light" effect around the border
    float gradientPos = fract(angle / 6.28318 + 0.5);
    float wave = 0.7 + 0.3 * sin(gradientPos * 6.28318 * 2.0);  // 2 bright spots rotating
    vec3 borderColor = glowColor * wave;

    // Add white highlight at the bright spots for extra pop
    vec3 highlight = vec3(1.0) * smoothstep(0.8, 1.0, wave) * 0.3;
    borderColor += highlight;

    // Pulse animation (breathing effect)
    float pulse = 0.5 + 0.5 * sin(pulsePhase);

    // Dynamic glow intensity (base + pulse + hover boost)
    float dynamicGlow = glowIntensity * (1.0 + pulse * 0.3 + hoverAmount * 0.8);

    // Border mask (sharp edge)
    float border = smoothstep(0.025, 0.0, abs(dist) - borderWidth);

    // Outer glow (soft falloff from edge)
    float glow = smoothstep(0.15, 0.0, dist) * dynamicGlow;

    // Inner glow (subtle inner rim)
    float innerGlow = smoothstep(-0.02, -0.08, dist) * 0.3 * dynamicGlow;

    // Composite: card + border + glow effects
    vec3 finalColor = card.rgb;
    finalColor += borderColor * border * 1.2;           // Bright border
    finalColor += glowColor * glow * 0.4;               // Outer glow (solid color)
    finalColor += glowColor * innerGlow;                // Inner glow

    // Alpha: card alpha + border + glow contributions
    float finalAlpha = card.a + border * 0.9 + glow * 0.3;
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// ============================================
// STACK TRANSITION ANIMATIONS (Single Pane Mode)
// ============================================

/**
 * Transition the scene to a new stack
 * @param {string} newStack - The stack to transition to (cloudflare, aws, gcp, azure, custom)
 */
function transitionToStack(newStack) {
    if (newStack === currentStack) return;

    const oldStack = currentStack;
    currentStack = newStack;

    console.log(`[Scene] Transitioning from ${oldStack} to ${newStack}`);

    // Get the component configs for the new stack
    const stackConfig = PROVIDER_COMPONENTS[newStack === 'cloudflare' ? 'cf' : newStack] || PROVIDER_COMPONENTS.cf;

    // Animate each swappable component
    const staggerDelay = 80; // ms between each component animation

    SWAPPABLE_COMPONENTS.forEach((compId, index) => {
        setTimeout(() => {
            const config = stackConfig[compId];
            if (config) {
                animateStackSwitch(compId, config.name, config.color);
            }
        }, index * staggerDelay);
    });

    // Update the UI (stack toggle buttons)
    updateStackToggleUI(newStack);

    // Update summary bar metrics
    updateSummaryBar(newStack);
}

/**
 * Animate a single component switching to a new alternative
 */
function animateStackSwitch(componentId, newName, newColor) {
    // Find the component mesh (in single-pane mode, use rightComponents as main)
    const mesh = rightComponents.find(m => m.userData.componentId === componentId);
    if (!mesh) return;

    transitioningComponents.add(componentId);

    // Animation phases
    const duration = 400; // Total animation duration in ms
    const startTime = Date.now();
    const startScale = mesh.scale.x;
    const startColor = mesh.material.uniforms.glowColor.value.clone();
    const endColor = new THREE.Color(newColor);

    function animateFrame() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out-back for slight bounce)
        const eased = 1 - Math.pow(1 - progress, 3);

        if (progress < 0.5) {
            // Phase 1: Scale down
            const scaleProgress = progress * 2;
            mesh.scale.setScalar(startScale * (1 - scaleProgress * 0.2));
        } else {
            // Phase 2: Scale back up with new color
            if (progress === 0.5 || (progress > 0.5 && mesh.userData.needsTextureUpdate)) {
                // Update texture at midpoint
                updateComponentTextureWithAlternative(mesh, newName, newColor);
                mesh.userData.needsTextureUpdate = false;
            }

            const scaleProgress = (progress - 0.5) * 2;
            mesh.scale.setScalar(startScale * (0.8 + scaleProgress * 0.2));
        }

        // Lerp color throughout
        lerpColor(mesh.material.uniforms.glowColor.value, endColor, eased);

        if (progress < 1) {
            requestAnimationFrame(animateFrame);
        } else {
            // Animation complete
            mesh.scale.setScalar(startScale);
            transitioningComponents.delete(componentId);
        }
    }

    mesh.userData.needsTextureUpdate = true;
    animateFrame();
}

/**
 * Lerp between two THREE.Color objects
 */
function lerpColor(color, target, alpha) {
    color.r += (target.r - color.r) * alpha;
    color.g += (target.g - color.g) * alpha;
    color.b += (target.b - color.b) * alpha;
}

/**
 * Smooth color transition helper
 */
function colorTransition(startHex, endHex, progress) {
    const start = new THREE.Color(startHex);
    const end = new THREE.Color(endHex);

    return new THREE.Color(
        start.r + (end.r - start.r) * progress,
        start.g + (end.g - start.g) * progress,
        start.b + (end.b - start.b) * progress
    );
}

/**
 * Update the stack toggle button states
 */
function updateStackToggleUI(activeStack) {
    const buttons = document.querySelectorAll('.stack-toggle .stack-btn');
    buttons.forEach(btn => {
        const stack = btn.dataset.stack;
        btn.classList.toggle('active', stack === activeStack);
    });
}

/**
 * Update the summary bar with new metrics
 */
function updateSummaryBar(stack) {
    const metrics = PROVIDER_METRICS[stack === 'cloudflare' ? 'cf' : stack] || PROVIDER_METRICS.cf;
    const baseline = PROVIDER_METRICS.cf;

    // Update cost
    const costEl = document.querySelector('#summary-cost .metric-value');
    const costDiffEl = document.querySelector('#summary-cost .metric-diff');
    if (costEl) costEl.textContent = metrics.cost;
    if (costDiffEl) {
        const costNum = parseInt(metrics.cost.replace(/[^0-9]/g, '')) || 0;
        const baseNum = parseInt(baseline.cost.replace(/[^0-9]/g, '')) || 0;
        const diff = costNum - baseNum;
        if (diff > 0) {
            costDiffEl.textContent = `+$${diff}`;
            costDiffEl.className = 'metric-diff worse';
        } else if (diff < 0) {
            costDiffEl.textContent = `-$${Math.abs(diff)}`;
            costDiffEl.className = 'metric-diff better';
        } else {
            costDiffEl.textContent = '';
            costDiffEl.className = 'metric-diff';
        }
    }

    // Update latency
    const latencyEl = document.querySelector('#summary-latency .metric-value');
    const latencyDiffEl = document.querySelector('#summary-latency .metric-diff');
    if (latencyEl) latencyEl.textContent = metrics.latency;
    if (latencyDiffEl) {
        const latNum = parseInt(metrics.latency) || 0;
        const baseLatNum = parseInt(baseline.latency) || 0;
        const diff = latNum - baseLatNum;
        if (diff > 0) {
            latencyDiffEl.textContent = `+${diff}ms`;
            latencyDiffEl.className = 'metric-diff worse';
        } else if (diff < 0) {
            latencyDiffEl.textContent = `${diff}ms`;
            latencyDiffEl.className = 'metric-diff better';
        } else {
            latencyDiffEl.textContent = '';
            latencyDiffEl.className = 'metric-diff';
        }
    }

    // Update locations
    const locEl = document.querySelector('#summary-locations .metric-value');
    if (locEl) locEl.textContent = metrics.locations;

    // Show/hide reset button
    const resetBtn = document.getElementById('btn-reset-stack');
    if (resetBtn) {
        resetBtn.classList.toggle('hidden', stack === 'cloudflare');
    }
}

/**
 * Calculate viewport width for single-pane mode
 */
function fullViewportWidth() {
    return window.innerWidth;
}

/**
 * Initialize stack toggle event listeners
 */
function initStackToggle() {
    const buttons = document.querySelectorAll('.stack-toggle .stack-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const stack = btn.dataset.stack;
            if (stack) {
                transitionToStack(stack);
            }
        });
    });

    // Reset button
    const resetBtn = document.getElementById('btn-reset-stack');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            transitionToStack('cloudflare');
        });
    }
}

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

// Draw component-specific icon on canvas
function drawComponentIcon(ctx, componentId, x, y, size) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const s = size; // scale factor

    switch(componentId) {
        case 'user':
            // Person icon: head + body
            ctx.beginPath();
            ctx.arc(x, y - s*0.3, s*0.25, 0, Math.PI * 2); // head
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y + s*0.4, s*0.4, Math.PI, 0); // body
            ctx.fill();
            break;

        case 'browser':
            // Browser window icon
            ctx.strokeRect(x - s*0.4, y - s*0.35, s*0.8, s*0.7);
            ctx.beginPath();
            ctx.moveTo(x - s*0.4, y - s*0.15);
            ctx.lineTo(x + s*0.4, y - s*0.15);
            ctx.stroke();
            // Dots in toolbar
            ctx.beginPath();
            ctx.arc(x - s*0.25, y - s*0.25, s*0.06, 0, Math.PI * 2);
            ctx.arc(x - s*0.1, y - s*0.25, s*0.06, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'workers':
            // Gear/cog icon
            ctx.beginPath();
            ctx.arc(x, y, s*0.2, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(angle) * s*0.25, y + Math.sin(angle) * s*0.25);
                ctx.lineTo(x + Math.cos(angle) * s*0.4, y + Math.sin(angle) * s*0.4);
                ctx.stroke();
            }
            break;

        case 'pages':
            // Document/page icon
            ctx.beginPath();
            ctx.moveTo(x - s*0.3, y - s*0.4);
            ctx.lineTo(x + s*0.15, y - s*0.4);
            ctx.lineTo(x + s*0.3, y - s*0.25);
            ctx.lineTo(x + s*0.3, y + s*0.4);
            ctx.lineTo(x - s*0.3, y + s*0.4);
            ctx.closePath();
            ctx.stroke();
            // Fold corner
            ctx.beginPath();
            ctx.moveTo(x + s*0.15, y - s*0.4);
            ctx.lineTo(x + s*0.15, y - s*0.25);
            ctx.lineTo(x + s*0.3, y - s*0.25);
            ctx.stroke();
            break;

        case 'wasm':
            // Code brackets icon
            ctx.beginPath();
            ctx.moveTo(x - s*0.2, y - s*0.35);
            ctx.lineTo(x - s*0.35, y);
            ctx.lineTo(x - s*0.2, y + s*0.35);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + s*0.2, y - s*0.35);
            ctx.lineTo(x + s*0.35, y);
            ctx.lineTo(x + s*0.2, y + s*0.35);
            ctx.stroke();
            break;

        case 'threejs':
            // 3D cube icon
            ctx.beginPath();
            // Front face
            ctx.moveTo(x - s*0.25, y);
            ctx.lineTo(x, y + s*0.3);
            ctx.lineTo(x + s*0.25, y);
            ctx.lineTo(x, y - s*0.3);
            ctx.closePath();
            ctx.stroke();
            // Top lines
            ctx.beginPath();
            ctx.moveTo(x, y - s*0.3);
            ctx.lineTo(x, y);
            ctx.moveTo(x - s*0.25, y);
            ctx.lineTo(x, y);
            ctx.moveTo(x + s*0.25, y);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;

        case 'kv':
            // Key icon
            ctx.beginPath();
            ctx.arc(x - s*0.15, y - s*0.1, s*0.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - s*0.1);
            ctx.lineTo(x + s*0.35, y - s*0.1);
            ctx.lineTo(x + s*0.35, y + s*0.1);
            ctx.moveTo(x + s*0.2, y - s*0.1);
            ctx.lineTo(x + s*0.2, y + s*0.05);
            ctx.stroke();
            break;

        case 'd1':
            // Database cylinder icon
            ctx.beginPath();
            ctx.ellipse(x, y - s*0.25, s*0.3, s*0.12, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - s*0.3, y - s*0.25);
            ctx.lineTo(x - s*0.3, y + s*0.25);
            ctx.moveTo(x + s*0.3, y - s*0.25);
            ctx.lineTo(x + s*0.3, y + s*0.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x, y + s*0.25, s*0.3, s*0.12, 0, 0, Math.PI);
            ctx.stroke();
            break;
    }
    ctx.restore();
}

// Create a canvas texture with label and icon (Modern smoky glass effect)
// Two-line layout: role (what it does) + name (vendor product)
function createLabelTexture(name, color, componentId, role = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;  // Higher resolution for sharper detail
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // === SMOKY BLACK GLASS BACKGROUND ===

    // Layer 1: Dark glass base (pure black, no color)
    ctx.fillStyle = 'rgba(15, 15, 20, 0.75)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 472, 472, 40);
    ctx.fill();

    // Layer 2: Subtle top highlight (glass refraction)
    const highlightGradient = ctx.createLinearGradient(256, 20, 256, 180);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.roundRect(24, 24, 464, 160, [36, 36, 0, 0]);
    ctx.fill();

    // Layer 3: Inner shadow at edges for depth
    const innerShadow = ctx.createRadialGradient(256, 256, 150, 256, 256, 260);
    innerShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    innerShadow.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = innerShadow;
    ctx.beginPath();
    ctx.roundRect(20, 20, 472, 472, 40);
    ctx.fill();

    // === ICON (white, clean) ===
    if (componentId) {
        drawComponentIcon(ctx, componentId, 256, 160, 100);
    }

    // === INFO INDICATOR (colored ring, not filled) ===
    // Outer colored ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(440, 440, 28, 0, Math.PI * 2);
    ctx.stroke();
    // Dark fill
    ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
    ctx.beginPath();
    ctx.arc(440, 440, 26, 0, Math.PI * 2);
    ctx.fill();
    // White "i"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', 440, 442);

    // === TEXT LABELS (two-line layout) ===
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (role) {
        // Two-line layout: Role (bold, white) + Name (light, gray)
        // Line 1: Role - what it does (educational)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillText(role, 256, 290);

        // Line 2: Product name - vendor + product (informational)
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '28px Inter, sans-serif';
        ctx.fillText(name, 256, 345);
    } else {
        // Single line for components without a role (e.g., End User)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Inter, sans-serif';
        ctx.fillText(name, 256, 320);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, canvas };
}

// Create ShaderMaterial with glass effects
function createGlassCardMaterial(canvasTexture, color) {
    return new THREE.ShaderMaterial({
        uniforms: {
            cardTexture: { value: canvasTexture },
            time: { value: 0 },
            glowColor: { value: new THREE.Color(color) },
            borderWidth: { value: 0.012 },
            glowIntensity: { value: 0.6 },
            hoverAmount: { value: 0 },
            pulsePhase: { value: 0 }
        },
        vertexShader: GLASS_VERTEX_SHADER,
        fragmentShader: GLASS_FRAGMENT_SHADER,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false  // Better blending for transparent glow
    });
}

// Create component mesh with glass shader
function createComponent(comp) {
    const { texture, canvas } = createLabelTexture(comp.name, comp.color, comp.id, comp.role);
    const geometry = new THREE.PlaneGeometry(1.8, 1.8);

    // Use glass shader material for animated effects
    const material = createGlassCardMaterial(texture, comp.color);

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(comp.pos.x, comp.pos.y, comp.pos.z);
    mesh.userData = {
        id: comp.id,
        name: comp.name,
        role: comp.role,
        color: comp.color,
        canvas: canvas,  // Store for texture updates
        basePosition: { ...comp.pos },
        explodedPosition: { ...comp.exploded }
    };

    return mesh;
}

// Create component mesh with x-offset for split-screen view
function createComponentWithOffset(comp, xOffset, overrideName, overrideColor) {
    const name = overrideName || comp.name;
    const color = overrideColor || comp.color;
    const role = comp.role;  // Role stays the same (educational, not vendor-specific)

    const { texture, canvas } = createLabelTexture(name, color, comp.id, role);
    const geometry = new THREE.PlaneGeometry(1.8, 1.8);
    const material = createGlassCardMaterial(texture, color);

    const mesh = new THREE.Mesh(geometry, material);

    // Apply x-offset to position
    mesh.position.set(comp.pos.x + xOffset, comp.pos.y, comp.pos.z);
    mesh.userData = {
        id: comp.id,
        name: name,
        role: role,
        color: color,
        canvas: canvas,
        basePosition: { x: comp.pos.x + xOffset, y: comp.pos.y, z: comp.pos.z },
        explodedPosition: { x: comp.exploded.x + xOffset, y: comp.exploded.y, z: comp.exploded.z },
        xOffset: xOffset  // Store for reference
    };

    return mesh;
}

// Create connection with x-offset for split-screen view
function createConnectionWithOffset(connDef, xOffset, componentList) {
    // Find positions from the offset component list
    const fromComp = componentList.find(c => c.userData.id === connDef.from);
    const toComp = componentList.find(c => c.userData.id === connDef.to);

    if (!fromComp || !toComp) return null;

    const fromPos = fromComp.userData.basePosition;
    const toPos = toComp.userData.basePosition;

    const start = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);
    const end = new THREE.Vector3(toPos.x, toPos.y, toPos.z);

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.8;
    mid.x += (end.x - start.x) * 0.2;

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
        color: connDef.color,
        curve: curve,
        baseFromPos: { ...fromPos },
        baseToPos: { ...toPos },
        xOffset: xOffset
    };

    return { line };
}

// Get component mesh by ID (defaults to right side which is editable)
function getComponentById(id, side = 'right') {
    const arr = side === 'left' ? leftComponents : rightComponents;
    return arr.find(c => c.userData.id === id);
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

    return { line };
}

// Create flowing particle for a connection
// Particles are color-coded by connection type and speed reflects latency
function createParticle(connection, side = 'right') {
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);

    // Color-coded by connection type (educational: shows request type)
    const connColor = connection.userData.color || '#ffffff';
    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(connColor),
        transparent: true,
        opacity: 0.9
    });
    const particle = new THREE.Mesh(geometry, material);

    // Calculate speed based on destination latency (educational: shows performance)
    // Lower latency = faster particles, higher latency = slower particles
    const destId = connection.userData.to;
    let latency = 10; // Default for non-vendor components

    if (COMPONENT_LATENCY[destId]) {
        // For vendor components, use provider-specific latency
        const provider = side === 'left' ? 'cf' : (componentProviders[destId] || 'cf');
        latency = COMPONENT_LATENCY[destId][provider] || 10;
    }

    // Speed formula: faster for low latency, slower for high latency
    // Base speed 0.008, reduced by latency factor
    const baseSpeed = 0.008;
    const speed = baseSpeed / (1 + latency / 20);

    // Random starting position along curve
    const progress = Math.random();
    particle.userData = {
        connection: connection,
        progress: progress,
        speed: speed,
        baseSpeed: speed,
        side: side,
        isPulsing: false,
        pulseScale: 1.0
    };

    // Set initial position along the curve
    const curve = connection.userData.curve;
    if (curve) {
        const pos = curve.getPoint(progress);
        particle.position.copy(pos);
    }

    return particle;
}

// Trigger pulse animation on particles connected to a component
// Educational: shows data flow paths when interacting with architecture
function pulseConnectionsFor(componentId, side = 'right') {
    const particles = side === 'left' ? leftParticles : rightParticles;
    const connections = side === 'left' ? leftConnections : rightConnections;

    // Find connections involving this component
    connections.forEach(conn => {
        const isConnected = conn.userData.from === componentId || conn.userData.to === componentId;
        if (!isConnected) return;

        // Pulse all particles on this connection
        particles.forEach(particle => {
            if (particle.userData.connection === conn) {
                particle.userData.isPulsing = true;
                particle.userData.pulseStartTime = Date.now();
                particle.userData.pulseDirection = conn.userData.from === componentId ? 'outbound' : 'inbound';
            }
        });

        // Also briefly highlight the connection line
        const originalOpacity = conn.material.opacity;
        conn.material.opacity = 1.0;
        setTimeout(() => {
            conn.material.opacity = originalOpacity;
        }, 500);
    });
}

// Update connection curve based on current component positions
function updateConnectionCurve(connection) {
    // Determine which side this connection is on based on stored xOffset
    const side = connection.userData.xOffset === LEFT_OFFSET ? 'left' : 'right';
    const fromComp = getComponentById(connection.userData.from, side);
    const toComp = getComponentById(connection.userData.to, side);
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

// Track mouse position for raycasting
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Handle click - raycast to find component
function onClick(event) {
    // Determine which side was clicked
    const isRightSide = event.clientX > window.innerWidth / 2;
    const activeCamera = isRightSide ? rightCamera : leftCamera;
    const activeComponents = isRightSide ? rightComponents : leftComponents;

    // Adjust mouse coordinates for the active viewport
    const adjustedMouse = new THREE.Vector2();
    if (isRightSide) {
        // Right half: remap x from [0.5, 1] to [-1, 1]
        adjustedMouse.x = ((event.clientX / window.innerWidth) - 0.5) * 4 - 1;
    } else {
        // Left half: remap x from [0, 0.5] to [-1, 1]
        adjustedMouse.x = (event.clientX / window.innerWidth) * 4 - 1;
    }
    adjustedMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(adjustedMouse, activeCamera);
    const intersects = raycaster.intersectObjects(activeComponents);

    if (intersects.length > 0) {
        const clickedComponent = intersects[0].object;
        const componentId = clickedComponent.userData.id;
        console.log('Clicked component:', componentId, 'on', isRightSide ? 'RIGHT (Mixed)' : 'LEFT (CF)');

        // Pulse connections to show data flow (educational)
        pulseConnectionsFor(componentId, isRightSide ? 'right' : 'left');

        // Check if this is an affected component (has glow from alternative selection)
        if (clickedComponent.userData.isAffected) {
            const handled = handleAffectedComponentClick(componentId);
            if (handled) return;
        }

        // Show info panel - editable only on right side
        showInfoPanel(componentId, { editable: isRightSide, side: isRightSide ? 'right' : 'left' });
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
            // Determine which side was tapped
            const isRightSide = endX > window.innerWidth / 2;
            const activeCamera = isRightSide ? rightCamera : leftCamera;
            const activeComponents = isRightSide ? rightComponents : leftComponents;

            // Adjust coordinates for the active viewport
            const adjustedMouse = new THREE.Vector2();
            if (isRightSide) {
                adjustedMouse.x = ((endX / window.innerWidth) - 0.5) * 4 - 1;
            } else {
                adjustedMouse.x = (endX / window.innerWidth) * 4 - 1;
            }
            adjustedMouse.y = -(endY / window.innerHeight) * 2 + 1;

            // Perform raycast
            raycaster.setFromCamera(adjustedMouse, activeCamera);
            const intersects = raycaster.intersectObjects(activeComponents);

            if (intersects.length > 0) {
                const tappedComponent = intersects[0].object;
                console.log('Tapped component:', tappedComponent.userData.id, 'on', isRightSide ? 'RIGHT' : 'LEFT');
                showInfoPanel(tappedComponent.userData.id, { editable: isRightSide, side: isRightSide ? 'right' : 'left' });
            }
        }
    }
}

// Track current panel component for each side independently
let leftPanelComponentId = null;
let rightPanelComponentId = null;

// Helper to get current panel component ID (defaults to right for backwards compatibility)
function getCurrentPanelComponentId(side = 'right') {
    return side === 'left' ? leftPanelComponentId : rightPanelComponentId;
}

// Show info panel for a component
function showInfoPanel(componentId, options = {}) {
    const { editable = true, side = 'right' } = options;

    // Get the correct panel based on side
    const panelId = side === 'left' ? 'info-panel-left' : 'info-panel-right';
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const comp = COMPONENTS.find(c => c.id === componentId);
    const info = COMPONENT_INFO[componentId];
    if (!comp || !info) return;

    // Track which component is shown on this side
    if (side === 'left') {
        leftPanelComponentId = componentId;
    } else {
        rightPanelComponentId = componentId;
    }

    // Get display name based on mode
    const displayName = side === 'left' ? comp.name : getComponentDisplayName(componentId);
    const role = comp.role;

    // Update panel content using class selectors
    // Two-line title: Role (main) + Product name (subtitle)
    const titleElement = panel.querySelector('.panel-title');
    if (role) {
        titleElement.innerHTML = `${role}<span class="panel-subtitle">${displayName}</span>`;
    } else {
        titleElement.textContent = displayName;
    }
    panel.querySelector('.panel-description').textContent = info.description;

    // Populate alternatives dropdown (only for right/editable side)
    populateAlternativesDropdown(panel, componentId, editable);

    // Populate reasons list
    const reasonsList = panel.querySelector('.panel-reasons-list');
    reasonsList.innerHTML = '';
    info.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        reasonsList.appendChild(li);
    });

    // Setup docs link - use provider-specific URL if available
    const docsLink = panel.querySelector('.panel-docs-link');
    let docsUrl = info.docs;

    // Check for provider-specific alternative (only relevant for right side)
    if (side === 'right' && currentProvider !== 'cf' && info.alternatives && info.alternatives[currentProvider]) {
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

    // Setup close button
    const closeBtn = panel.querySelector('.close-panel');
    closeBtn.onclick = () => hideInfoPanel(side);

    // Animate components left to make room for panel
    if (side === 'left') {
        leftColumnShift = -1.0; // Shift left by 1 unit
    } else {
        rightColumnShift = -1.0;
    }

    // Show panel
    panel.classList.remove('hidden');
}

// Populate alternatives dropdown for a component (panel is the DOM element)
function populateAlternativesDropdown(panel, componentId, editable = true) {
    const alternativesDiv = panel.querySelector('.panel-alternatives');
    const alternativesSelect = panel.querySelector('.panel-alternatives-select');
    const applyBtn = panel.querySelector('.btn-apply-alt');
    const altDetails = panel.querySelector('.panel-alt-details');
    const warningDiv = panel.querySelector('.panel-compatibility-warning');
    const legendDiv = panel.querySelector('.affected-legend');

    // Left panel doesn't have alternatives elements
    if (!alternativesDiv || !alternativesSelect) return;

    // Hide alternatives for non-editable (left side) panels
    if (!editable) {
        alternativesDiv.classList.add('hidden');
        if (applyBtn) applyBtn.classList.add('hidden');
        if (altDetails) altDetails.classList.add('hidden');
        if (legendDiv) legendDiv.classList.add('hidden');
        return;
    }

    // Check if this component has alternatives
    const altData = ALTERNATIVES[componentId];
    if (!altData || !altData.options || altData.options.length === 0) {
        alternativesDiv.classList.add('hidden');
        if (applyBtn) applyBtn.classList.add('hidden');
        if (altDetails) altDetails.classList.add('hidden');
        if (legendDiv) legendDiv.classList.add('hidden');
        return;
    }

    // Show the dropdown
    alternativesDiv.classList.remove('hidden');

    // Clear and populate options
    alternativesSelect.innerHTML = '<option value="">Select alternative...</option>';
    altData.options.forEach(alt => {
        const option = document.createElement('option');
        option.value = alt.id;
        option.textContent = alt.name;
        option.style.color = alt.color;
        alternativesSelect.appendChild(option);
    });

    // Reset selection and hide apply button initially
    alternativesSelect.value = selectedAlternatives[componentId] || '';
    if (applyBtn) applyBtn.classList.add('hidden');
    if (altDetails) altDetails.classList.add('hidden');
    if (warningDiv) warningDiv.classList.add('hidden');
    if (legendDiv) legendDiv.classList.add('hidden');

    // Clear any previous visual feedback
    clearAlternativeVisualFeedback();

    // If there was a previous selection, show its details
    if (selectedAlternatives[componentId]) {
        showAlternativeDetails(panel, componentId, selectedAlternatives[componentId]);
    }

    // Setup event listener for alternatives select
    alternativesSelect.onchange = (e) => {
        const alternativeId = e.target.value;
        if (alternativeId) {
            selectedAlternatives[componentId] = alternativeId;
            showAlternativeDetails(panel, componentId, alternativeId);
        } else {
            delete selectedAlternatives[componentId];
            const info = COMPONENT_INFO[componentId];
            if (info) {
                panel.querySelector('.panel-description').textContent = info.description;
            }
            if (altDetails) altDetails.classList.add('hidden');
            if (applyBtn) applyBtn.classList.add('hidden');
            if (warningDiv) warningDiv.classList.add('hidden');
            clearAlternativeVisualFeedback();
        }
    };

    // Setup apply button
    if (applyBtn) {
        applyBtn.onclick = () => {
            const alternativeId = alternativesSelect.value;
            if (alternativeId) {
                const alternative = ALTERNATIVES[componentId]?.options.find(a => a.id === alternativeId);
                if (alternative) {
                    applyAlternativeToComponent(componentId, alternativeId, alternative.name);
                }
                hideInfoPanel('right');
            }
        };
    }
}

// Show details for a selected alternative (panel is the DOM element)
function showAlternativeDetails(panel, componentId, alternativeId) {
    const altData = ALTERNATIVES[componentId];
    if (!altData) return;

    const alternative = altData.options.find(a => a.id === alternativeId);
    if (!alternative) return;

    // Update description to show alternative's description
    const descEl = panel.querySelector('.panel-description');
    if (descEl) {
        descEl.innerHTML = `<strong style="color: ${alternative.color}">${alternative.name}:</strong> ${alternative.description}`;
    }

    // Show metrics
    const altDetails = panel.querySelector('.panel-alt-details');
    const metric1 = panel.querySelector('.alt-metric-1');
    const metric2 = panel.querySelector('.alt-metric-2');

    if (altDetails && metric1 && metric2) {
        altDetails.classList.remove('hidden');

        // Pick the most relevant metrics for this component type
        if (alternative.coldStart) {
            metric1.innerHTML = `<strong>${alternative.coldStart}</strong>Cold Start`;
        } else if (alternative.readLatency) {
            metric1.innerHTML = `<strong>${alternative.readLatency}</strong>Read Latency`;
        } else if (alternative.queryLatency) {
            metric1.innerHTML = `<strong>${alternative.queryLatency}</strong>Query Latency`;
        } else if (alternative.performance) {
            metric1.innerHTML = `<strong>${alternative.performance}</strong>Performance`;
        } else if (alternative.bundleSize) {
            metric1.innerHTML = `<strong>${alternative.bundleSize}</strong>Bundle Size`;
        } else {
            metric1.innerHTML = '';
        }

        if (alternative.cost) {
            metric2.innerHTML = `<strong>${alternative.cost}</strong>Cost`;
        } else if (alternative.locations) {
            metric2.innerHTML = `<strong>${alternative.locations}</strong>Locations`;
        } else if (alternative.features) {
            metric2.innerHTML = `<strong>${alternative.features}</strong>Features`;
        } else {
            metric2.innerHTML = '';
        }
    }

    // Check for compatibility warnings with current stack
    showCompatibilityWarnings(panel, componentId, alternative);

    // Update docs link
    const docsLink = panel.querySelector('.panel-docs-link');
    if (docsLink && alternative.docs) {
        docsLink.href = alternative.docs;
        docsLink.style.display = 'inline';
    }

    // Show visual feedback on canvas (connection colors + component glows)
    showAlternativeVisualFeedback(componentId, alternativeId);

    // Show apply button
    const applyBtn = panel.querySelector('.btn-apply-alt');
    if (applyBtn) {
        applyBtn.classList.remove('hidden');
        applyBtn.textContent = `Switch to ${alternative.name}`;
    }
}

// Show compatibility warnings for selected alternative (panel is the DOM element)
function showCompatibilityWarnings(panel, componentId, alternative) {
    const warningDiv = panel.querySelector('.panel-compatibility-warning');
    const warningText = panel.querySelector('.warning-text');

    if (!warningDiv || !warningText) return;

    // Component display names for clearer warnings
    const componentNames = {
        workers: 'Compute',
        pages: 'Hosting',
        kv: 'KV Store',
        d1: 'Database'
    };

    // Check warnings against current stack
    const warnings = [];

    // Check against current component selections
    for (const [currentCompId, currentProvider] of Object.entries(componentProviders)) {
        if (currentCompId === componentId) continue;

        const currentAltId = `cf-${currentCompId}`;

        // Skip warning if we already have a recommendation for this component via pairsWellWith
        const hasRecommendation = alternative.pairsWellWith?.some(pairedId => {
            const altData = ALTERNATIVES[currentCompId];
            return altData?.options.some(opt => opt.id === pairedId);
        });

        // Only show warning if no recommendation exists for this component
        if (!hasRecommendation && alternative.warnings && alternative.warnings[currentAltId]) {
            const compName = componentNames[currentCompId] || currentCompId;
            warnings.push(`${compName}: ${alternative.warnings[currentAltId]}`);
        }
    }

    // Check for general notes
    if (alternative.warnings && alternative.warnings.note) {
        warnings.push(alternative.warnings.note);
    }

    if (warnings.length > 0) {
        warningDiv.classList.remove('hidden');
        warningText.textContent = warnings.join(' • ');
    } else {
        warningDiv.classList.add('hidden');
    }
}

// Get recommended dependent switches when an alternative is selected
function getRecommendedSwitches(componentId, alternativeId) {
    const recommendations = [];
    const altData = ALTERNATIVES[componentId];
    if (!altData) return recommendations;

    const alternative = altData.options.find(a => a.id === alternativeId);
    if (!alternative || !alternative.pairsWellWith) return recommendations;

    // For each other swappable component, check if we should suggest switching
    const allSwappable = [...SWAPPABLE_COMPONENTS, ...CLIENT_SWAPPABLE];

    for (const otherCompId of allSwappable) {
        if (otherCompId === componentId) continue;

        const otherAltData = ALTERNATIVES[otherCompId];
        if (!otherAltData) continue;

        // Check if any of the paired alternatives match this component
        for (const pairedId of alternative.pairsWellWith) {
            const matchingAlt = otherAltData.options.find(a => a.id === pairedId);
            if (matchingAlt) {
                recommendations.push({
                    componentId: otherCompId,
                    alternativeId: pairedId,
                    alternativeName: matchingAlt.name,
                    reason: `Pairs well with ${alternative.name}`
                });
                break; // Only one recommendation per component
            }
        }
    }

    return recommendations;
}

// ============================================
// VISUAL FEEDBACK SYSTEM
// Connection colors + Component glow for alternative selection
// ============================================

// Track currently affected components for visual highlighting
let affectedComponents = new Map(); // componentId -> { status: 'recommended'|'warning', alternativeId, alternativeName }
let originalConnectionColors = new Map(); // Store original colors to restore later

// Show visual feedback when an alternative is selected
function showAlternativeVisualFeedback(componentId, alternativeId) {
    // Clear previous effects
    clearAlternativeVisualFeedback();

    const altData = ALTERNATIVES[componentId];
    if (!altData) return;

    const alternative = altData.options.find(a => a.id === alternativeId);
    if (!alternative) return;

    // Get recommendations (components that pair well)
    const recommendations = getRecommendedSwitches(componentId, alternativeId);

    // Track affected components
    recommendations.forEach(rec => {
        affectedComponents.set(rec.componentId, {
            status: 'recommended',
            alternativeId: rec.alternativeId,
            alternativeName: rec.alternativeName,
            reason: rec.reason
        });
    });

    // Check for warnings (incompatible current selections)
    if (alternative.warnings) {
        for (const [warningKey, warningMsg] of Object.entries(alternative.warnings)) {
            if (warningKey === 'note') continue;
            // warningKey format: 'cf-pages' or 'cf-kv'
            const compId = warningKey.replace('cf-', '');
            if (SWAPPABLE_COMPONENTS.includes(compId) && !affectedComponents.has(compId)) {
                affectedComponents.set(compId, {
                    status: 'warning',
                    alternativeId: null,
                    alternativeName: null,
                    reason: warningMsg
                });
            }
        }
    }

    // Update connection colors
    updateConnectionColors(componentId, alternative);

    // Update component glows
    updateComponentGlows();

    // Update the affected legend in the panel
    updateAffectedLegend();
}

// Update connection colors based on compatibility (right side only - editable)
function updateConnectionColors(sourceComponentId, alternative) {
    rightConnections.forEach(conn => {
        const fromId = conn.userData.from;
        const toId = conn.userData.to;

        // Store original color if not already stored
        if (!originalConnectionColors.has(conn)) {
            originalConnectionColors.set(conn, conn.material.color.getHex());
        }

        // Check if this connection involves the source component or affected components
        const involvesSource = fromId === sourceComponentId || toId === sourceComponentId;
        const otherEndId = fromId === sourceComponentId ? toId : (toId === sourceComponentId ? fromId : null);

        if (involvesSource && otherEndId) {
            const affected = affectedComponents.get(otherEndId);
            if (affected) {
                if (affected.status === 'recommended') {
                    // Green for recommended
                    conn.material.color.setHex(0x10B981);
                    conn.material.opacity = 0.9;
                } else if (affected.status === 'warning') {
                    // Orange/red for warning
                    conn.material.color.setHex(0xF59E0B);
                    conn.material.opacity = 0.9;
                }
            }
        }

        // Also highlight connections between affected components
        const fromAffected = affectedComponents.get(fromId);
        const toAffected = affectedComponents.get(toId);
        if (fromAffected && toAffected) {
            if (fromAffected.status === 'recommended' && toAffected.status === 'recommended') {
                conn.material.color.setHex(0x10B981);
                conn.material.opacity = 0.9;
            }
        }
    });
}

// Update component glow effects (right side only - editable)
function updateComponentGlows() {
    rightComponents.forEach(comp => {
        const affected = affectedComponents.get(comp.userData.id);

        if (affected) {
            // Set glow color based on status
            if (affected.status === 'recommended') {
                // Green glow for recommended
                if (comp.material.uniforms) {
                    comp.material.uniforms.glowColor.value.setHex(0x10B981);
                    comp.material.uniforms.glowIntensity.value = 1.5;
                }
            } else if (affected.status === 'warning') {
                // Orange glow for warning
                if (comp.material.uniforms) {
                    comp.material.uniforms.glowColor.value.setHex(0xF59E0B);
                    comp.material.uniforms.glowIntensity.value = 1.5;
                }
            }
            // Mark as affected for click handling
            comp.userData.isAffected = true;
            comp.userData.affectedData = affected;
        } else {
            // Dim non-affected components slightly
            if (comp.material.uniforms && comp.userData.id !== rightPanelComponentId) {
                comp.material.uniforms.glowIntensity.value = 0.3;
            }
            comp.userData.isAffected = false;
            comp.userData.affectedData = null;
        }
    });
}

// Update the affected components legend in the info panel (right panel only)
function updateAffectedLegend() {
    const rightPanel = document.getElementById('info-panel-right');
    if (!rightPanel) return;

    const legendDiv = rightPanel.querySelector('.affected-legend');
    const listDiv = rightPanel.querySelector('.affected-list');

    if (!legendDiv || !listDiv) return;

    if (affectedComponents.size === 0) {
        legendDiv.classList.add('hidden');
        return;
    }

    legendDiv.classList.remove('hidden');
    listDiv.innerHTML = '';

    affectedComponents.forEach((data, compId) => {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const dot = document.createElement('span');
        dot.className = `legend-dot ${data.status}`;

        const text = document.createElement('span');
        text.className = 'legend-text';

        // Get current component name
        const comp = COMPONENTS.find(c => c.id === compId);
        const currentName = comp ? getComponentDisplayName(compId) : compId;

        if (data.status === 'recommended') {
            text.innerHTML = `<strong>${currentName}</strong> → ${data.alternativeName}`;
        } else {
            text.innerHTML = `<strong>${currentName}</strong>: ${data.reason}`;
        }

        item.appendChild(dot);
        item.appendChild(text);
        listDiv.appendChild(item);
    });
}

// Clear all visual feedback
function clearAlternativeVisualFeedback() {
    // Restore original connection colors
    originalConnectionColors.forEach((color, conn) => {
        conn.material.color.setHex(color);
        conn.material.opacity = 0.6;
    });
    originalConnectionColors.clear();

    // Restore component glows to original colors (right side only - editable)
    rightComponents.forEach(comp => {
        const compDef = COMPONENTS.find(c => c.id === comp.userData.id);
        if (compDef && comp.material.uniforms) {
            // Reset to original color
            comp.material.uniforms.glowColor.value.set(compDef.color);
            comp.material.uniforms.glowIntensity.value = 0.6;
        }
        comp.userData.isAffected = false;
        comp.userData.affectedData = null;
    });

    // Clear affected map
    affectedComponents.clear();

    // Hide legend in right panel
    const rightPanel = document.getElementById('info-panel-right');
    const legendDiv = rightPanel?.querySelector('.affected-legend');
    if (legendDiv) legendDiv.classList.add('hidden');
}

// Handle click on affected component - show panel with recommended pre-selected (right side only)
function handleAffectedComponentClick(componentId) {
    const affected = affectedComponents.get(componentId);
    if (!affected) return false;

    // Always show the panel on the right side (affected components are only on right)
    showInfoPanel(componentId, { editable: true, side: 'right' });

    // If recommended, pre-select the alternative in dropdown
    if (affected.status === 'recommended' && affected.alternativeId) {
        // Small delay to ensure panel is rendered
        setTimeout(() => {
            const rightPanel = document.getElementById('info-panel-right');
            const select = rightPanel?.querySelector('.panel-alternatives-select');
            if (select) {
                select.value = affected.alternativeId;
                // Trigger change event to show details and visual feedback
                select.dispatchEvent(new Event('change'));
            }
        }, 50);
    }

    return true;
}

// Apply an alternative to a specific component
function applyAlternativeToComponent(componentId, alternativeId, alternativeName) {
    console.log(`Applying ${alternativeName} to ${componentId}`);

    // Get the alternative data
    const altData = ALTERNATIVES[componentId];
    if (!altData) return;

    const alternative = altData.options.find(a => a.id === alternativeId);
    if (!alternative) return;

    // Update the component's texture to show the new name and color (right side - editable)
    const comp = rightComponents.find(c => c.userData.id === componentId);
    if (comp) {
        // Update the shader glow color
        if (comp.material.uniforms) {
            comp.material.uniforms.glowColor.value.set(alternative.color);
        }

        // Recreate the texture with new name
        updateComponentTextureWithAlternative(comp, alternativeName, alternative.color);
    }

    // Mark this as switched in our state
    selectedAlternatives[componentId] = alternativeId;

    // Remove from affected list since it's now applied
    affectedComponents.delete(componentId);

    // Update visual feedback
    updateComponentGlows();
    updateAffectedLegend();

    // Flash effect to confirm
    flashComponent(comp, alternative.color);
}

// Update component texture with alternative name/color
function updateComponentTextureWithAlternative(mesh, name, color) {
    const componentId = mesh.userData.id;
    const role = getComponentRole(componentId);

    // Use createLabelTexture for consistent two-line layout
    const { texture } = createLabelTexture(name, color, componentId, role);

    // Update texture
    if (mesh.material.uniforms && mesh.material.uniforms.cardTexture) {
        mesh.material.uniforms.cardTexture.value = texture;
        mesh.material.uniforms.glowColor.value.set(color);
    } else if (mesh.material.map) {
        mesh.material.map = texture;
        mesh.material.map.needsUpdate = true;
    }
}

// Flash effect on component to confirm switch
function flashComponent(mesh, color) {
    if (!mesh || !mesh.material.uniforms) return;

    const originalIntensity = mesh.material.uniforms.glowIntensity.value;
    let flashCount = 0;
    const maxFlashes = 3;

    function flash() {
        flashCount++;
        mesh.material.uniforms.glowIntensity.value = 2.0;

        setTimeout(() => {
            mesh.material.uniforms.glowIntensity.value = 0.5;
            if (flashCount < maxFlashes) {
                setTimeout(flash, 100);
            } else {
                mesh.material.uniforms.glowIntensity.value = 0.6;
            }
        }, 100);
    }

    flash();
}

// ============================================
// END VISUAL FEEDBACK SYSTEM
// ============================================

// Hide info panel for a specific side (or both if no side specified)
function hideInfoPanel(side) {
    if (side === 'left' || !side) {
        const leftPanel = document.getElementById('info-panel-left');
        if (leftPanel) {
            leftPanel.classList.add('hidden');
        }
        leftPanelComponentId = null;
        // Reset column shift - components animate back to center
        leftColumnShift = 0;
    }

    if (side === 'right' || !side) {
        const rightPanel = document.getElementById('info-panel-right');
        if (rightPanel) {
            rightPanel.classList.add('hidden');
            // Clear visual feedback only when right panel closes (it has alternatives)
            clearAlternativeVisualFeedback();
        }
        rightPanelComponentId = null;
        // Reset column shift - components animate back to center
        rightColumnShift = 0;
    }
}

// Calculate mixed mode totals
function calculateMixedMetrics() {
    let totalCost = 0;
    let maxLatency = 0;

    // Location map for providers
    const locationMap = {
        'cf': 300, 'gcp': 35, 'aws': 400, 'azure': 60,
        'vercel': 200, 'netlify': 100, 'deno': 12,
        'upstash': 200, 'turso': 50, 'neon': 15
    };
    let minLocations = 300;

    SWAPPABLE_COMPONENTS.forEach(id => {
        const provider = componentProviders[id];
        totalCost += COMPONENT_COSTS[id]?.[provider] || 0;
        maxLatency = Math.max(maxLatency, COMPONENT_LATENCY[id]?.[provider] || 0);
        minLocations = Math.min(minLocations, locationMap[provider] || 300);
    });

    return {
        cost: totalCost === 0 ? '$0' : `$${totalCost}/mo`,
        latency: `${maxLatency}ms`,
        uptime: '99.97%',
        locations: `${minLocations}+`
    };
}

// Update comparison table display (for split view)
function updateMetrics() {
    // Update mixed (right side) with current calculations
    const mixedMetrics = calculateMixedMetrics();

    // Update Mixed column
    const mixedCostEl = document.getElementById('mixed-cost');
    const mixedLatencyEl = document.getElementById('mixed-latency');
    const mixedLocationsEl = document.getElementById('mixed-locations');

    if (mixedCostEl) mixedCostEl.textContent = mixedMetrics.cost;
    if (mixedLatencyEl) mixedLatencyEl.textContent = mixedMetrics.latency;
    if (mixedLocationsEl) mixedLocationsEl.textContent = mixedMetrics.locations || '300+';

    // CF column is static - always shows pure Cloudflare values
    const cfCostEl = document.getElementById('cf-cost');
    const cfLatencyEl = document.getElementById('cf-latency');
    const cfLocationsEl = document.getElementById('cf-locations');

    if (cfCostEl) cfCostEl.textContent = '$0';
    if (cfLatencyEl) cfLatencyEl.textContent = '20ms';
    if (cfLocationsEl) cfLocationsEl.textContent = '300+';
}

// Calculate metrics for the current mixed configuration
function calculateMixedLocations() {
    // Find minimum edge locations among selected providers
    const locationMap = {
        'cf': 300,
        'gcp': 35,
        'aws': 400,
        'azure': 60,
        'vercel': 200,
        'netlify': 100,
        'deno': 12,
        'upstash': 200,
        'turso': 50,
        'neon': 15
    };

    let minLocations = 300;
    SWAPPABLE_COMPONENTS.forEach(id => {
        const provider = componentProviders[id];
        const locations = locationMap[provider] || 300;
        minLocations = Math.min(minLocations, locations);
    });

    return minLocations + '+';
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

    // Update comparison table column header to show selected provider
    const mixedColumnHeader = document.querySelector('#comparison-table th.mixed-column');
    if (mixedColumnHeader) {
        const providerNames = {
            'mixed': 'Mixed',
            'cf': 'Cloudflare',
            'aws': 'AWS',
            'gcp': 'GCP',
            'azure': 'Azure'
        };
        mixedColumnHeader.textContent = providerNames[provider] || provider;
    }

    // Close info panel (provider context changed)
    hideInfoPanel();
}

// Get role for a component ID
function getComponentRole(componentId) {
    const comp = COMPONENTS.find(c => c.id === componentId);
    return comp ? comp.role : null;
}

// Update a single component's texture based on its provider (right side - editable)
function updateSingleComponentTexture(componentId) {
    const mesh = rightComponents.find(m => m.userData.id === componentId);
    if (!mesh) return;

    const provider = componentProviders[componentId];
    const providerComp = PROVIDER_COMPONENTS[provider]?.[componentId];
    if (!providerComp) return;

    // Get display name (with prefix in mixed mode)
    const displayName = getComponentDisplayName(componentId);
    const role = getComponentRole(componentId);

    // Regenerate texture with icon
    const { texture, canvas } = createLabelTexture(displayName, providerComp.color, componentId, role);

    // Update ShaderMaterial uniform
    mesh.material.uniforms.cardTexture.value = texture;
    mesh.material.uniforms.glowColor.value = new THREE.Color(providerComp.color);
    mesh.material.needsUpdate = true;
    mesh.userData.name = displayName;
    mesh.userData.color = providerComp.color;
    mesh.userData.canvas = canvas;
}

// Update all swappable component textures (right side - editable)
function updateAllComponentTextures() {
    rightComponents.forEach(mesh => {
        const id = mesh.userData.id;
        if (SWAPPABLE_COMPONENTS.includes(id)) {
            updateSingleComponentTexture(id);
        }
    });
}

// Load a stack configuration from Real Stacks feature
function loadStackFromStory(stack) {
    // Map stack categories to component IDs
    const categoryMap = {
        compute: 'workers',
        database: 'd1',
        cache: 'kv',
        hosting: 'pages',
        queue: 'workers'  // queues map to workers category
    };

    // Map provider names to scene provider codes
    const providerMap = {
        cloudflare: 'cf',
        vercel: 'gcp',
        aws: 'aws',
        gcp: 'gcp',
        azure: 'azure',
        turso: 'cf',
        upstash: 'aws',
        neon: 'gcp',
        planetscale: 'gcp',
        supabase: 'gcp'
    };

    Object.entries(stack).forEach(([category, config]) => {
        const componentId = categoryMap[category];
        if (componentId && config?.provider) {
            const provider = providerMap[config.provider.toLowerCase()] || 'cf';
            componentProviders[componentId] = provider;
        }
    });

    updateAllComponentTextures();
    updateMetrics();

    // Update table header based on loaded configuration
    const providers = Object.values(componentProviders);
    const allSame = providers.every(p => p === providers[0]);
    const providerNames = { cf: 'Cloudflare', aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
    const headerText = allSame ? providerNames[providers[0]] : 'Mixed';

    const mixedColumnHeader = document.querySelector('#comparison-table th.mixed-column');
    if (mixedColumnHeader) {
        mixedColumnHeader.textContent = headerText;
    }

    // Sync dropdown with loaded configuration
    const providerSelect = document.getElementById('provider-select');
    if (providerSelect) {
        providerSelect.value = allSame ? providers[0] : 'mixed';
    }

    // Update mode flag
    isMixedMode = !allSame || providers[0] === 'mixed';

    console.log('[Scene] Loaded stack:', stack);
}

// Get display name for component (full vendor + product name)
function getComponentDisplayName(componentId) {
    if (!SWAPPABLE_COMPONENTS.includes(componentId)) {
        // Non-swappable components keep original name
        const comp = COMPONENTS.find(c => c.id === componentId);
        return comp ? comp.name : componentId;
    }

    const provider = isMixedMode ? componentProviders[componentId] : currentProvider;
    const providerComp = PROVIDER_COMPONENTS[provider]?.[componentId];
    if (!providerComp) return componentId;

    // Names now include full vendor + product (e.g., "Cloudflare Workers", "AWS Lambda@Edge")
    return providerComp.name;
}

// ============================================
// RESPONSIVE CAMERA & DEBUG HELPERS
// ============================================

// Calculate camera params based on viewport size
function calculateCameraParams(viewportWidth, viewportHeight) {
    const halfAspect = (viewportWidth / 2) / viewportHeight;
    const fovRad = (60 * Math.PI) / 180;

    // Calculate camera Z to fit components (z range roughly -4 to +4)
    const verticalExtent = 10; // Total z-depth we want visible
    const baseCameraZ = (verticalExtent / 2) / Math.tan(fovRad / 2);
    const cameraZ = Math.max(16, baseCameraZ);

    // Calculate horizontal frustum width at this Z distance
    const halfFrustumWidth = cameraZ * Math.tan(fovRad / 2) * halfAspect;

    // Calculate view shift: center components in the space LEFT of the info panel
    // Info panel takes (PANEL_WIDTH_PX + PANEL_PADDING_PX) pixels from the right of each half
    const halfViewportPx = viewportWidth / 2;
    const panelFraction = (PANEL_WIDTH_PX + PANEL_PADDING_PX * 2) / halfViewportPx;

    // The viewShift moves the camera (and lookAt) right,
    // which makes components appear shifted LEFT on screen
    // We want components centered in the remaining space (left of panel)
    const viewShift = halfFrustumWidth * panelFraction * 0.5;

    return { cameraZ, viewShift, halfFrustumWidth };
}

// Create debug boundary lines to visualize component bounds
function createDebugBounds(cameraZ, halfFrustumWidth) {
    if (!DEBUG_BOUNDS) return;

    // Remove existing debug lines
    debugLines.forEach(line => scene.remove(line));
    debugLines = [];

    const debugMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 });
    const debugMaterialGreen = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    const debugMaterialYellow = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });

    // Vertical extent for debug lines
    const yMin = -2, yMax = 3;
    const zMin = -6, zMax = 6;

    // Helper to create a vertical line at x position
    function createVerticalLine(x, material, layer) {
        const points = [
            new THREE.Vector3(x, yMin, zMin),
            new THREE.Vector3(x, yMin, zMax),
            new THREE.Vector3(x, yMax, zMax),
            new THREE.Vector3(x, yMax, zMin),
            new THREE.Vector3(x, yMin, zMin)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        line.layers.set(layer);
        scene.add(line);
        debugLines.push(line);
    }

    // LEFT COLUMN bounds (layer 1)
    // Left edge of left column viewport (where browser edge is visible)
    createVerticalLine(LEFT_OFFSET + currentViewShift - halfFrustumWidth, debugMaterial, 1);
    // Right edge of left column (center divider)
    createVerticalLine(LEFT_OFFSET + currentViewShift + halfFrustumWidth, debugMaterialGreen, 1);
    // Panel start boundary (where components should stay left of)
    const panelBoundLeft = LEFT_OFFSET + currentViewShift + halfFrustumWidth * 0.5;
    createVerticalLine(panelBoundLeft, debugMaterialYellow, 1);

    // RIGHT COLUMN bounds (layer 2)
    // Left edge of right column (center divider)
    createVerticalLine(RIGHT_OFFSET + currentViewShift - halfFrustumWidth, debugMaterialGreen, 2);
    // Right edge of right column (browser edge)
    createVerticalLine(RIGHT_OFFSET + currentViewShift + halfFrustumWidth, debugMaterial, 2);
    // Panel start boundary
    const panelBoundRight = RIGHT_OFFSET + currentViewShift + halfFrustumWidth * 0.5;
    createVerticalLine(panelBoundRight, debugMaterialYellow, 2);

    console.log('Debug bounds created:', { halfFrustumWidth, currentViewShift });
}

// Initialize the Three.js scene with split-screen view
window.initScene = function() {
    if (isInitialized) {
        console.log('Scene already initialized');
        return;
    }

    console.log('Initializing Three.js scene with split-screen view...');

    const canvas = document.getElementById('scene');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1d1d);

    // Calculate responsive camera params based on viewport (adjusted for header)
    const adjustedHeight = window.innerHeight - HEADER_HEIGHT_PX;
    const { cameraZ, viewShift, halfFrustumWidth } = calculateCameraParams(
        window.innerWidth,
        adjustedHeight
    );
    currentViewShift = viewShift;

    // Two cameras for split viewport - half aspect ratio each (adjusted for header)
    const halfAspect = (window.innerWidth / 2) / adjustedHeight;

    // Left camera (Cloudflare side) - shifted to make room for panel on right of left column
    leftCamera = new THREE.PerspectiveCamera(60, halfAspect, 0.1, 1000);
    leftCamera.position.set(LEFT_OFFSET + currentViewShift, 1, cameraZ);
    leftCamera.lookAt(LEFT_OFFSET + currentViewShift, -0.5, 0);

    // Right camera (Mixed side) - shifted to make room for panel on right of right column
    rightCamera = new THREE.PerspectiveCamera(60, halfAspect, 0.1, 1000);
    rightCamera.position.set(RIGHT_OFFSET + currentViewShift, 1, cameraZ);
    rightCamera.lookAt(RIGHT_OFFSET + currentViewShift, -0.5, 0);

    // Main camera (for backwards compatibility)
    camera = leftCamera;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setScissorTest(true);  // Enable scissor for split view

    // Disable orbit controls for split view (each side is independent)
    controls = null;

    // Raycaster for click detection
    raycaster = new THREE.Raycaster();
    // Enable raycaster to test against layers 1 and 2 (left and right components)
    raycaster.layers.enable(1);
    raycaster.layers.enable(2);
    mouse = new THREE.Vector2();

    // =============================================
    // Create LEFT side components (Pure Cloudflare)
    // Use layer 1 for left side
    // =============================================
    COMPONENTS.forEach(comp => {
        const mesh = createComponentWithOffset(comp, LEFT_OFFSET);
        mesh.layers.set(1);  // Left side = layer 1
        mesh.userData.side = 'left';
        scene.add(mesh);
        leftComponents.push(mesh);
    });
    console.log(`Added ${leftComponents.length} LEFT (CF) components`);

    // Create LEFT side connections
    CONNECTIONS.forEach(connDef => {
        const result = createConnectionWithOffset(connDef, LEFT_OFFSET, leftComponents);
        if (result) {
            result.line.layers.set(1);  // Left side = layer 1
            scene.add(result.line);
            leftConnections.push(result.line);

            // Add particles (left side = Cloudflare, always fast)
            const numParticles = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numParticles; i++) {
                const particle = createParticle(result.line, 'left');
                particle.layers.set(1);  // Left side = layer 1
                scene.add(particle);
                leftParticles.push(particle);
            }
        }
    });

    // =============================================
    // Create RIGHT side components (Mixed - editable)
    // Use layer 2 for right side
    // =============================================
    COMPONENTS.forEach(comp => {
        const mesh = createComponentWithOffset(comp, RIGHT_OFFSET);
        mesh.layers.set(2);  // Right side = layer 2
        mesh.userData.side = 'right';
        scene.add(mesh);
        rightComponents.push(mesh);
    });
    console.log(`Added ${rightComponents.length} RIGHT (Mixed) components`);

    // Create RIGHT side connections
    CONNECTIONS.forEach(connDef => {
        const result = createConnectionWithOffset(connDef, RIGHT_OFFSET, rightComponents);
        if (result) {
            result.line.layers.set(2);  // Right side = layer 2
            scene.add(result.line);
            rightConnections.push(result.line);

            // Add particles (right side = Mixed, speed varies by provider)
            const numParticles = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < numParticles; i++) {
                const particle = createParticle(result.line, 'right');
                particle.layers.set(2);  // Right side = layer 2
                scene.add(particle);
                rightParticles.push(particle);
            }
        }
    });

    // Set camera layers - each camera only sees its side
    leftCamera.layers.set(1);   // Left camera sees layer 1
    rightCamera.layers.set(2);  // Right camera sees layer 2

    console.log(`Created ${leftComponents.length} LEFT + ${rightComponents.length} RIGHT components`);

    // Handle resize
    window.addEventListener('resize', onResize);

    // Mouse events for raycasting
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    // Apply initial textures (right side shows mixed mode names)
    updateRightSideTextures();

    // Initialize metrics display
    updateMetrics();

    // Create debug bounds visualization
    createDebugBounds(cameraZ, halfFrustumWidth);

    // Initialize stack toggle for single-pane mode
    if (SINGLE_PANE_MODE) {
        initStackToggle();
        updateSummaryBar('cloudflare');
    }

    // Start animation loop
    isInitialized = true;
    animate();

    // Listen for stack loading from Real Stacks feature
    // Event bus loads async, so retry until available
    function registerEventBusListeners() {
        if (window.shipwithEventBus) {
            window.shipwithEventBus.on('stories:load-stack', (data) => {
                loadStackFromStory(data.stack);
            });
            console.log('[Scene] Event bus listener registered');
            return true;
        }
        return false;
    }

    if (!registerEventBusListeners()) {
        const checkInterval = setInterval(() => {
            if (registerEventBusListeners()) {
                clearInterval(checkInterval);
            }
        }, 100);
    }

    console.log('Three.js scene initialized successfully');
};

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const adjustedHeight = height - HEADER_HEIGHT_PX;

    // Recalculate responsive camera params (use adjusted height for proper aspect)
    const { cameraZ, viewShift, halfFrustumWidth } = calculateCameraParams(width, adjustedHeight);
    currentViewShift = viewShift;

    const halfAspect = (width / 2) / adjustedHeight;

    // Update both cameras for split view
    if (leftCamera) {
        leftCamera.aspect = halfAspect;
        leftCamera.position.set(LEFT_OFFSET + currentViewShift, 1, cameraZ);
        leftCamera.lookAt(LEFT_OFFSET + currentViewShift, -0.5, 0);
        leftCamera.updateProjectionMatrix();
    }
    if (rightCamera) {
        rightCamera.aspect = halfAspect;
        rightCamera.position.set(RIGHT_OFFSET + currentViewShift, 1, cameraZ);
        rightCamera.lookAt(RIGHT_OFFSET + currentViewShift, -0.5, 0);
        rightCamera.updateProjectionMatrix();
    }

    // Legacy camera update (for backwards compatibility)
    if (camera && camera !== leftCamera && camera !== rightCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    renderer.setSize(width, height);

    // Update debug bounds
    createDebugBounds(cameraZ, halfFrustumWidth);
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;  // Time in seconds
    const width = window.innerWidth;
    const height = window.innerHeight;
    const halfWidth = Math.floor(width / 2);

    // Update orbit controls (for damping) - if enabled
    if (controls) {
        controls.update();
    }

    // Detect hovered component via raycasting (check both sides)
    if (raycaster && mouse) {
        const isRightSide = mouse.x > 0;  // mouse.x is normalized -1 to 1
        const activeCamera = isRightSide ? rightCamera : leftCamera;
        const activeComponents = isRightSide ? rightComponents : leftComponents;

        // Adjust mouse for the active viewport
        const adjustedMouse = new THREE.Vector2();
        if (isRightSide) {
            adjustedMouse.x = (mouse.x - 0) * 2 - 1;  // Remap right half
        } else {
            adjustedMouse.x = (mouse.x + 1) * 2 - 1;  // Remap left half
        }
        adjustedMouse.y = mouse.y;

        raycaster.setFromCamera(adjustedMouse, activeCamera);
        const intersects = raycaster.intersectObjects(activeComponents);
        hoveredComponent = intersects.length > 0 ? intersects[0].object : null;
    }

    // Update LEFT side components (face left camera + apply column shift)
    leftComponents.forEach((mesh, i) => {
        mesh.lookAt(leftCamera.position);
        updateComponentUniforms(mesh, time, i, leftComponents);

        // Animate position shift when panel opens/closes (skip during reconstruct/explode animations)
        if (!isExploded && !isReconstructing) {
            const targetX = mesh.userData.basePosition.x + leftColumnShift;
            mesh.position.x += (targetX - mesh.position.x) * 0.1; // Smooth lerp
        }
    });

    // Update RIGHT side components (face right camera + apply column shift)
    rightComponents.forEach((mesh, i) => {
        mesh.lookAt(rightCamera.position);
        updateComponentUniforms(mesh, time, i, rightComponents);

        // Animate position shift when panel opens/closes (skip during reconstruct/explode animations)
        if (!isExploded && !isReconstructing) {
            const targetX = mesh.userData.basePosition.x + rightColumnShift;
            mesh.position.x += (targetX - mesh.position.x) * 0.1; // Smooth lerp
        }
    });

    // Update connection curves (both sides)
    [...leftConnections, ...rightConnections].forEach(conn => {
        updateConnectionCurve(conn);
    });

    // Animate particles along their curves (both sides)
    [...leftParticles, ...rightParticles].forEach(particle => {
        const conn = particle.userData.connection;
        const curve = conn.userData.curve;
        if (!curve) return;

        particle.userData.progress += particle.userData.speed;
        if (particle.userData.progress > 1) {
            particle.userData.progress = 0;
        }

        const pos = curve.getPoint(particle.userData.progress);
        particle.position.copy(pos);

        // Handle pulse animation (educational: shows data flow on click)
        if (particle.userData.isPulsing) {
            const elapsed = Date.now() - particle.userData.pulseStartTime;
            const pulseDuration = 800; // ms

            if (elapsed < pulseDuration) {
                // Grow and glow effect
                const pulseProgress = elapsed / pulseDuration;
                const scale = 1 + Math.sin(pulseProgress * Math.PI) * 1.5;
                particle.scale.setScalar(scale);

                // Increase opacity during pulse
                particle.material.opacity = 0.9 + Math.sin(pulseProgress * Math.PI) * 0.1;
            } else {
                // Reset after pulse
                particle.userData.isPulsing = false;
                particle.scale.setScalar(1);
                particle.material.opacity = 0.9;
            }
        }
    });

    // =============================================
    // SPLIT VIEWPORT RENDERING
    // =============================================

    // Adjust height to leave space for header (column labels + dropdown)
    const adjustedHeight = height - HEADER_HEIGHT_PX;

    // Left viewport (Cloudflare Native)
    renderer.setViewport(0, 0, halfWidth, adjustedHeight);
    renderer.setScissor(0, 0, halfWidth, adjustedHeight);
    renderer.render(scene, leftCamera);

    // Right viewport (Mixed/Customizable)
    renderer.setViewport(halfWidth, 0, halfWidth, adjustedHeight);
    renderer.setScissor(halfWidth, 0, halfWidth, adjustedHeight);
    renderer.render(scene, rightCamera);
}

// Helper function to update component shader uniforms
function updateComponentUniforms(mesh, time, index, componentList) {
    if (mesh.material.uniforms) {
        mesh.material.uniforms.time.value = time;
        mesh.material.uniforms.pulsePhase.value = time * 2 + index * 0.7;

        const isHovered = hoveredComponent === mesh;
        const targetHover = isHovered ? 1.0 : 0.0;
        const currentHover = mesh.material.uniforms.hoverAmount.value;
        mesh.material.uniforms.hoverAmount.value += (targetHover - currentHover) * 0.12;
    }

    // Breathing animation
    const breath = 1.0 + Math.sin(time * 1.5 + index * 0.5) * 0.015;
    mesh.scale.setScalar(1.8 * breath);
}

// Update right side textures to show mixed mode names
function updateRightSideTextures() {
    rightComponents.forEach(mesh => {
        const compId = mesh.userData.id;
        if (SWAPPABLE_COMPONENTS.includes(compId)) {
            const displayName = getComponentDisplayName(compId);
            const role = getComponentRole(compId);
            const provider = componentProviders[compId] || 'cf';
            const color = PROVIDER_COLORS[provider] || mesh.userData.color;

            // Update texture with new name
            const { texture } = createLabelTexture(displayName, color, compId, role);
            if (mesh.material.uniforms && mesh.material.uniforms.cardTexture) {
                mesh.material.uniforms.cardTexture.value = texture;
                mesh.material.uniforms.glowColor.value.set(color);
            }
        }
    });
}

// Expose scene objects for later use
window.getScene = function() { return scene; };
window.getCamera = function() { return camera; };
window.getRenderer = function() { return renderer; };

// Button handlers
window.initButtons = function() {
    const btnDeconstruct = document.getElementById('btn-deconstruct');
    const btnReconstruct = document.getElementById('btn-reconstruct');
    const providerSelect = document.getElementById('provider-select');

    if (providerSelect) {
        providerSelect.addEventListener('change', (e) => {
            onProviderChange(e.target.value);
        });
    }

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

    // Note: Panel close buttons and alternatives dropdowns are now handled
    // in showInfoPanel() and populateAlternativesDropdown() respectively
};

// ============================================
// COMPARISON MODE
// Split-screen to compare current vs alternative
// ============================================

let comparisonRenderer = null;
let comparisonCamera = null;
let comparisonControls = null;
let comparisonComponents = [];
let isComparisonMode = false;

// Enter comparison mode - split screen with current on left, alternative on right
function enterComparisonMode(componentId, alternativeId) {
    if (isComparisonMode) return;
    isComparisonMode = true;

    console.log(`Entering comparison mode: ${componentId} -> ${alternativeId}`);

    // Get recommended switches for dependent components
    const recommendations = getRecommendedSwitches(componentId, alternativeId);
    console.log('Recommended switches:', recommendations);

    // Hide info panel during transition
    hideInfoPanel();

    // Add comparison mode class to body
    document.body.classList.add('comparison-mode');

    // Create the split-screen layout
    createComparisonLayout(componentId, alternativeId, recommendations);
}

// Create the split-screen layout with two canvases
function createComparisonLayout(componentId, alternativeId, recommendations) {
    const sceneWrapper = document.getElementById('scene-wrapper');
    const originalCanvas = document.getElementById('scene');

    // Create container for split view
    const splitContainer = document.createElement('div');
    splitContainer.id = 'split-container';
    splitContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        z-index: 1;
    `;

    // Left side (current)
    const leftSide = document.createElement('div');
    leftSide.className = 'scene-half left';
    leftSide.style.cssText = 'flex: 1; position: relative; border-right: 2px solid #F6821F;';

    // Label for left side
    const leftLabel = document.createElement('div');
    leftLabel.className = 'comparison-label current';
    leftLabel.textContent = 'Current Stack';
    leftSide.appendChild(leftLabel);

    // Move original canvas to left side
    leftSide.appendChild(originalCanvas);

    // Right side (alternative)
    const rightSide = document.createElement('div');
    rightSide.className = 'scene-half right';
    rightSide.style.cssText = 'flex: 1; position: relative;';

    // Label for right side
    const altData = ALTERNATIVES[componentId];
    const alternative = altData?.options.find(a => a.id === alternativeId);
    const rightLabel = document.createElement('div');
    rightLabel.className = 'comparison-label alternative';
    rightLabel.textContent = alternative ? `With ${alternative.name}` : 'Alternative';
    rightSide.appendChild(rightLabel);

    // Create second canvas for alternative view
    const altCanvas = document.createElement('canvas');
    altCanvas.id = 'scene-alt';
    altCanvas.style.cssText = 'width: 100%; height: 100%;';
    rightSide.appendChild(altCanvas);

    // Build the layout
    splitContainer.appendChild(leftSide);
    splitContainer.appendChild(rightSide);
    sceneWrapper.appendChild(splitContainer);

    // Initialize the second renderer
    initComparisonRenderer(altCanvas, componentId, alternativeId, recommendations);

    // Resize both canvases
    onComparisonResize();

    // Add exit button
    addExitComparisonButton();

    // Animate the split
    animateSplitTransition();
}

// Initialize the comparison (right side) renderer
function initComparisonRenderer(canvas, componentId, alternativeId, recommendations) {
    const width = canvas.clientWidth || window.innerWidth / 2;
    const height = canvas.clientHeight || window.innerHeight;

    // Create comparison scene (clone of main scene structure)
    const compScene = new THREE.Scene();
    compScene.background = new THREE.Color(0x1a1a2e);

    // Camera
    comparisonCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    comparisonCamera.position.copy(camera.position);
    comparisonCamera.lookAt(0, 0, 0);

    // Renderer
    comparisonRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    comparisonRenderer.setSize(width, height);
    comparisonRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Orbit controls for comparison view
    comparisonControls = new THREE.OrbitControls(comparisonCamera, canvas);
    comparisonControls.enableDamping = true;
    comparisonControls.dampingFactor = 0.05;
    comparisonControls.minDistance = 5;
    comparisonControls.maxDistance = 30;

    // Clone components with alternative selections
    createComparisonComponents(compScene, componentId, alternativeId, recommendations);

    // Store scene for animation loop
    comparisonScene = compScene;

    // Start comparison render loop
    animateComparison();
}

// Create components for comparison scene with alternatives applied
function createComparisonComponents(compScene, changedComponentId, alternativeId, recommendations) {
    // Build alternative selections map
    const altSelections = { ...componentProviders };

    // The main component change
    const altData = ALTERNATIVES[changedComponentId];
    const alternative = altData?.options.find(a => a.id === alternativeId);

    // Apply recommended switches
    const altComponentNames = {};
    altComponentNames[changedComponentId] = alternative?.name || alternativeId;

    recommendations.forEach(rec => {
        altComponentNames[rec.componentId] = rec.alternativeName;
    });

    // Create components similar to main scene
    COMPONENTS.forEach((compDef, index) => {
        const size = 1.5;

        // Create canvas texture for this component
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Determine color and name based on alternatives
        let displayName = compDef.name;
        let displayColor = compDef.color;

        if (altComponentNames[compDef.id]) {
            displayName = altComponentNames[compDef.id];
            // Get color from alternative
            const alt = altData?.options.find(a => a.name === displayName);
            if (alt) displayColor = alt.color;
            // Check recommendations too
            const rec = recommendations.find(r => r.componentId === compDef.id);
            if (rec) {
                const recAltData = ALTERNATIVES[compDef.id];
                const recAlt = recAltData?.options.find(a => a.id === rec.alternativeId);
                if (recAlt) displayColor = recAlt.color;
            }
        }

        // Draw the card (similar to main scene)
        drawComponentCard(ctx, displayName, displayColor, 512);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });

        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);

        // Use exploded positions
        const pos = isExploded ? compDef.exploded : compDef.pos;
        mesh.position.set(pos.x, pos.y, pos.z);

        mesh.userData = {
            id: compDef.id,
            name: displayName,
            originalPos: compDef.pos,
            explodedPos: compDef.exploded
        };

        compScene.add(mesh);
        comparisonComponents.push(mesh);
    });

    // Add connections (simplified for comparison view)
    CONNECTIONS.forEach(connDef => {
        const fromComp = comparisonComponents.find(c => c.userData.id === connDef.from);
        const toComp = comparisonComponents.find(c => c.userData.id === connDef.to);
        if (!fromComp || !toComp) return;

        const start = fromComp.position.clone();
        const end = toComp.position.clone();
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += 0.8 * (isExploded ? 2 : 1);

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(32);

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: connDef.color || '#666666',
            linewidth: 2,
            transparent: true,
            opacity: 0.6
        });

        const line = new THREE.Line(geometry, material);
        compScene.add(line);
    });
}

// Helper to draw component card (reuse from main scene style)
function drawComponentCard(ctx, name, color, size) {
    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background (dark glass)
    ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(20, 20, size - 40, size - 40, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(20, 20, size - 40, size - 40, 20);
    ctx.stroke();

    // Inner glow
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, color + '20');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(20, 20, size - 40, size - 40, 20);
    ctx.fill();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, size/2, size/2);
}

// Animation loop for comparison view
function animateComparison() {
    if (!isComparisonMode || !comparisonRenderer) return;

    requestAnimationFrame(animateComparison);

    // Update controls
    if (comparisonControls) {
        comparisonControls.update();
    }

    // Make components face camera
    comparisonComponents.forEach(mesh => {
        mesh.lookAt(comparisonCamera.position);
    });

    // Render
    if (comparisonScene) {
        comparisonRenderer.render(comparisonScene, comparisonCamera);
    }
}

// Animate the split transition
function animateSplitTransition() {
    // The CSS transition handles the visual split
    // Just update camera position for better view
    const targetZ = camera.position.z * 1.2; // Zoom out slightly

    const startZ = camera.position.z;
    const duration = 500;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        camera.position.z = startZ + (targetZ - startZ) * eased;
        if (comparisonCamera) {
            comparisonCamera.position.z = camera.position.z;
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

// Handle resize in comparison mode
function onComparisonResize() {
    if (!isComparisonMode) return;

    const width = window.innerWidth / 2;
    const height = window.innerHeight;

    // Update main renderer
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Update comparison renderer
    if (comparisonRenderer) {
        comparisonRenderer.setSize(width, height);
        comparisonCamera.aspect = width / height;
        comparisonCamera.updateProjectionMatrix();
    }
}

// Add exit comparison button
function addExitComparisonButton() {
    const btn = document.createElement('button');
    btn.id = 'btn-exit-comparison';
    btn.textContent = '× Exit Comparison';
    btn.style.cssText = `
        position: fixed;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 300;
        padding: 0.75rem 1.5rem;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border: 1px solid #F6821F;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    `;
    btn.addEventListener('click', exitComparisonMode);
    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#F6821F';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(0, 0, 0, 0.8)';
    });
    document.body.appendChild(btn);
}

// Exit comparison mode
function exitComparisonMode() {
    if (!isComparisonMode) return;
    isComparisonMode = false;

    console.log('Exiting comparison mode');

    // Remove comparison mode class
    document.body.classList.remove('comparison-mode');

    // Remove split container
    const splitContainer = document.getElementById('split-container');
    if (splitContainer) {
        // Move original canvas back
        const originalCanvas = document.getElementById('scene');
        const sceneWrapper = document.getElementById('scene-wrapper');
        if (originalCanvas && sceneWrapper) {
            sceneWrapper.appendChild(originalCanvas);
        }
        splitContainer.remove();
    }

    // Remove exit button
    const exitBtn = document.getElementById('btn-exit-comparison');
    if (exitBtn) exitBtn.remove();

    // Clean up comparison renderer
    if (comparisonRenderer) {
        comparisonRenderer.dispose();
        comparisonRenderer = null;
    }
    comparisonCamera = null;
    comparisonControls = null;
    comparisonComponents = [];
    comparisonScene = null;

    // Reset main renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Clear selected alternatives
    selectedAlternatives = {};
}

// ============================================
// END COMPARISON MODE
// ============================================

// Explode animation - arrange as architecture diagram
function explodeComponents() {
    if (isExploded) return;
    isExploded = true;

    // Hide coming-soon panel on desktop during exploded view
    document.getElementById('coming-soon')?.classList.add('scene-exploded');

    const duration = 1000;
    const startTime = Date.now();

    // Combine both sides for animation
    const allComponents = [...leftComponents, ...rightComponents];

    // Store starting positions
    const startPositions = allComponents.map(mesh => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    }));

    // Use explicit exploded positions for architecture diagram layout
    const targetPositions = allComponents.map(mesh => mesh.userData.explodedPosition);

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        allComponents.forEach((mesh, i) => {
            mesh.position.x = startPositions[i].x + (targetPositions[i].x - startPositions[i].x) * eased;
            mesh.position.y = startPositions[i].y + (targetPositions[i].y - startPositions[i].y) * eased;
            mesh.position.z = startPositions[i].z + (targetPositions[i].z - startPositions[i].z) * eased;
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    step();

    // Note: Don't animate camera - keep split-screen cameras in place
    // Components animate to exploded positions within each viewport
}

// Reconstruct animation - bring components back together
function reconstructComponents() {
    if (!isExploded) return;
    isExploded = false;
    isReconstructing = true;  // Disable animate loop's lerping during animation

    // Show coming-soon panel again
    document.getElementById('coming-soon')?.classList.remove('scene-exploded');

    const duration = 800;
    const startTime = Date.now();

    // Combine both sides for animation
    const allComponents = [...leftComponents, ...rightComponents];

    // Store starting positions
    const startPositions = allComponents.map(mesh => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
    }));

    // Get current camera params for proper target positions
    const { cameraZ } = calculateCameraParams(window.innerWidth, window.innerHeight);

    // Reset cameras to proper split-screen positions immediately
    if (leftCamera) {
        leftCamera.position.set(LEFT_OFFSET + currentViewShift, 1, cameraZ);
        leftCamera.lookAt(LEFT_OFFSET + currentViewShift, -0.5, 0);
    }
    if (rightCamera) {
        rightCamera.position.set(RIGHT_OFFSET + currentViewShift, 1, cameraZ);
        rightCamera.lookAt(RIGHT_OFFSET + currentViewShift, -0.5, 0);
    }

    function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        allComponents.forEach((mesh, i) => {
            const base = mesh.userData.basePosition;
            // Account for any active column shift (panel open)
            const columnShift = mesh.userData.side === 'left' ? leftColumnShift : rightColumnShift;
            const targetX = base.x + columnShift;

            mesh.position.x = startPositions[i].x + (targetX - startPositions[i].x) * eased;
            mesh.position.y = startPositions[i].y + (base.y - startPositions[i].y) * eased;
            mesh.position.z = startPositions[i].z + (base.z - startPositions[i].z) * eased;
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            // Animation complete - re-enable animate loop's lerping
            isReconstructing = false;
            // Trigger the same recalculation as browser resize
            onResize();
        }
    }
    step();
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
