# shipwith.dev - Project Plan

## Vision

An interactive visualization tool that deconstructs itself to show how modern web apps are built on Cloudflare. The demo IS the proof—built entirely with Rust/WASM on Cloudflare's edge platform. This is a portfolio piece to demonstrate systems thinking and technical depth to Dane Knecht (CTO, Cloudflare) for the Chief of Staff role.

---

## Project Links

- **Domain**: shipwith.dev (registered on Porkbun)
- **GitHub**: github.com/[YOUR_USERNAME]/shipwith.dev
- **Live Site**: https://shipwith.dev
- **Cloudflare Dashboard**: dash.cloudflare.com

---

## Phase 0: Infrastructure Setup

### 0.1 Domain Configuration (Porkbun → Cloudflare)

Transfer DNS management to Cloudflare (keep registration on Porkbun):

1. **In Cloudflare Dashboard:**
   - Add site → Enter `shipwith.dev`
   - Select Free plan
   - Cloudflare will provide 2 nameservers (e.g., `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`)

2. **In Porkbun Dashboard:**
   - Go to Domain Management → shipwith.dev → Nameservers
   - Replace Porkbun nameservers with Cloudflare's
   - Save changes
   - Wait 10-60 minutes for propagation

3. **Verify in Cloudflare:**
   - Status should change from "Pending" to "Active"

### 0.2 Cloudflare Security Configuration

**DNS Settings:**
```
Type    Name    Content              Proxy    TTL
A       @       192.0.2.1            Proxied  Auto    (placeholder, Pages will override)
CNAME   www     shipwith.dev         Proxied  Auto
```

**SSL/TLS Settings:**
- SSL/TLS → Overview → Full (strict)
- SSL/TLS → Edge Certificates:
  - Always Use HTTPS: ON
  - HTTP Strict Transport Security (HSTS): Enable
    - Max-Age: 6 months (15768000)
    - Include subdomains: ON
    - Preload: ON (after testing)
  - Minimum TLS Version: TLS 1.2
  - Opportunistic Encryption: ON
  - TLS 1.3: ON
  - Automatic HTTPS Rewrites: ON

**Security Settings:**
- Security → Settings:
  - Security Level: Medium
  - Challenge Passage: 30 minutes
  - Browser Integrity Check: ON
- Security → Bots:
  - Bot Fight Mode: ON (Free tier)
- Security → WAF:
  - Enable Managed Rules (if on Pro, otherwise skip)

**Speed Settings:**
- Speed → Optimization:
  - Auto Minify: JavaScript, CSS, HTML all ON
  - Brotli: ON
  - Early Hints: ON
  - HTTP/2: ON (automatic)
  - HTTP/3 (QUIC): ON

**Caching:**
- Caching → Configuration:
  - Caching Level: Standard
  - Browser Cache TTL: 4 hours
- Caching → Tiered Cache:
  - Enable Tiered Cache: ON

**Page Rules (Free tier gets 3):**
```
1. *shipwith.dev/assets/*
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: 1 year

2. *shipwith.dev/*.wasm
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

3. shipwith.dev/
   - Cache Level: Cache Everything
   - Edge Cache TTL: 2 hours
```

**Scrape Shield:**
- Email Address Obfuscation: ON
- Server-side Excludes: ON
- Hotlink Protection: ON (optional, enable if you want)

### 0.3 Cloudflare Pages Setup

```bash
# After GitHub repo exists, connect via dashboard:
# Pages → Create a project → Connect to Git → Select repo

# Build settings:
# Framework preset: None
# Build command: ./build.sh
# Build output directory: dist
# Root directory: /

# Environment variables:
# NODE_VERSION: 18
# RUST_VERSION: stable (handled in build.sh)
```

### 0.4 GitHub Repository Setup

**Create Repository:**
```bash
# Create on GitHub first, then:
git clone git@github.com:YOUR_USERNAME/shipwith.dev.git
cd shipwith.dev
```

**Repository Settings (GitHub):**
- Settings → General:
  - Default branch: `main`
  - Features: Issues ON, Projects ON, Discussions OFF
  - Pull Requests: Allow squash merging only

- Settings → Branches:
  - Add rule for `main`:
    - Require pull request before merging: Optional for solo
    - Require status checks: ON (after CI setup)

- Settings → Secrets and variables → Actions:
  ```
  CLOUDFLARE_API_TOKEN: [create in CF dashboard with Pages permissions]
  CLOUDFLARE_ACCOUNT_ID: [from CF dashboard URL]
  ```

- Settings → Security:
  - Dependency graph: ON
  - Dependabot alerts: ON
  - Dependabot security updates: ON

**.gitignore:**
```gitignore
# Build artifacts
/target
/dist
/pkg
*.wasm

# Dependencies
/node_modules

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*

# Cloudflare
.wrangler/
```

**LICENSE (MIT):**
```
MIT License

Copyright (c) 2025 Shankar [Last Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Phase 1: Project Scaffold

### 1.1 Directory Structure

```
shipwith.dev/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD to Cloudflare Pages
├── src/
│   ├── lib.rs                  # WASM entry point, Three.js init
│   ├── app.rs                  # Main application state machine
│   ├── scene/
│   │   ├── mod.rs
│   │   ├── camera.rs           # Camera controls, zoom, pan
│   │   ├── components.rs       # Architecture components (sprites)
│   │   ├── threads.rs          # Silk thread connections
│   │   └── animations.rs       # Explode/reconstruct animations
│   ├── ui/
│   │   ├── mod.rs
│   │   ├── info_panel.rs       # Component detail panel
│   │   ├── metrics_bar.rs      # Top metrics display
│   │   └── controls.rs         # Button overlays
│   └── data/
│       ├── mod.rs
│       ├── components.rs       # Component definitions
│       └── connections.rs      # Thread/connection definitions
├── assets/
│   ├── sprites/
│   │   ├── laptop.png
│   │   ├── browser.png
│   │   ├── cloudflare-worker.png
│   │   ├── cloudflare-kv.png
│   │   ├── cloudflare-d1.png
│   │   ├── cloudflare-pages.png
│   │   ├── cloudflare-r2.png
│   │   ├── rust-wasm.png
│   │   ├── threejs.png
│   │   └── user.png
│   └── fonts/
│       └── inter.woff2
├── www/
│   ├── index.html
│   └── style.css
├── build.sh                    # Build script for Cloudflare Pages
├── Cargo.toml
├── wrangler.toml               # Cloudflare Workers config (if needed later)
├── package.json                # For any JS tooling
├── .gitignore
├── LICENSE
├── README.md
└── projectPlan.md              # This file
```

### 1.2 Core Files

**Cargo.toml:**
```toml
[package]
name = "shipwith-dev"
version = "0.1.0"
edition = "2021"
authors = ["Shankar <email>"]
description = "Interactive visualization of Cloudflare architecture"
repository = "https://github.com/YOUR_USERNAME/shipwith.dev"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[features]
default = ["console_error_panic_hook"]

[dependencies]
wasm-bindgen = "0.2.92"
wasm-bindgen-futures = "0.4.42"
js-sys = "0.3.69"
console_error_panic_hook = { version = "0.1.7", optional = true }
console_log = "1.0"
log = "0.4"

# Three.js bindings - we'll use web-sys for raw JS interop
web-sys = { version = "0.3.69", features = [
    "console",
    "Document",
    "Element",
    "HtmlElement",
    "HtmlCanvasElement",
    "Window",
    "MouseEvent",
    "WheelEvent",
    "TouchEvent",
    "TouchList",
    "Touch",
    "KeyboardEvent",
    "Performance",
    "RequestAnimationFrame",
    "WebGlRenderingContext",
    "WebGl2RenderingContext",
]}

# State management
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Animation easing
ezing = "0.1"

[dev-dependencies]
wasm-bindgen-test = "0.3.42"

[profile.release]
lto = true
opt-level = 's'
```

**build.sh:**
```bash
#!/bin/bash
set -e

echo "🦀 Installing Rust toolchain..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
rustup target add wasm32-unknown-unknown

echo "📦 Installing wasm-pack..."
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo "🔨 Building WASM..."
wasm-pack build --target web --release

echo "📁 Creating dist directory..."
mkdir -p dist
cp -r www/* dist/
cp -r pkg dist/
cp -r assets dist/

echo "✅ Build complete!"
ls -la dist/
```

**www/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Interactive visualization of how modern apps ship on Cloudflare. Built with Rust and WASM.">
    <meta name="author" content="Shankar">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Ship With Dev - Cloudflare Architecture Visualized">
    <meta property="og:description" content="See how modern apps are built on Cloudflare's edge platform.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://shipwith.dev">
    <meta property="og:image" content="https://shipwith.dev/assets/og-image.png">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Ship With Dev">
    <meta name="twitter:description" content="Interactive Cloudflare architecture visualization.">
    
    <title>Ship With Dev - Cloudflare Architecture Visualized</title>
    
    <link rel="icon" type="image/png" href="/assets/favicon.png">
    <link rel="stylesheet" href="/style.css">
    
    <!-- Three.js from CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
    <div id="metrics-bar">
        <div class="metric">
            <span class="label">Monthly Cost</span>
            <span class="value" id="metric-cost">$0</span>
        </div>
        <div class="metric">
            <span class="label">Latency</span>
            <span class="value" id="metric-latency">12ms</span>
        </div>
        <div class="metric">
            <span class="label">Uptime</span>
            <span class="value" id="metric-uptime">99.99%</span>
        </div>
        <div class="metric">
            <span class="label">Edge Locations</span>
            <span class="value" id="metric-locations">300+</span>
        </div>
    </div>
    
    <canvas id="scene"></canvas>
    
    <div id="info-panel" class="hidden">
        <button id="close-panel" aria-label="Close panel">×</button>
        <h2 id="panel-title"></h2>
        <p id="panel-description"></p>
        <div id="panel-reasons">
            <h3>Why This Choice</h3>
            <ul id="panel-reasons-list"></ul>
        </div>
        <div id="panel-code">
            <pre><code id="panel-code-content"></code></pre>
        </div>
        <div id="panel-links">
            <a id="panel-docs-link" href="#" target="_blank" rel="noopener">📄 Official Docs</a>
            <a id="panel-source-link" href="#" target="_blank" rel="noopener">🔗 Source Code</a>
        </div>
    </div>
    
    <div id="controls">
        <button id="btn-deconstruct" class="primary">How It Works</button>
        <button id="btn-reconstruct" class="hidden">Reconstruct</button>
    </div>
    
    <script type="module">
        import init, { App } from './pkg/shipwith_dev.js';
        
        async function main() {
            await init();
            const app = new App();
            app.start();
        }
        
        main().catch(console.error);
    </script>
</body>
</html>
```

**www/style.css:**
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --cf-orange: #F6821F;
    --cf-dark: #1d1d1d;
    --cf-gray: #404040;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --panel-bg: rgba(29, 29, 29, 0.95);
    --border-subtle: rgba(255, 255, 255, 0.1);
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--cf-dark);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
}

#scene {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
}

#metrics-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 3rem;
    padding: 1rem 2rem;
    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
    z-index: 100;
}

.metric {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.metric .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
}

.metric .value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--cf-orange);
}

#info-panel {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 360px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    background: var(--panel-bg);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 1.5rem;
    z-index: 200;
    backdrop-filter: blur(20px);
    transition: transform 0.3s ease, opacity 0.3s ease;
}

#info-panel.hidden {
    transform: translateX(400px);
    opacity: 0;
    pointer-events: none;
}

#close-panel {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    transition: color 0.2s;
}

#close-panel:hover {
    color: var(--text-primary);
}

#panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    padding-right: 2rem;
}

#panel-description {
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 1.25rem;
}

#panel-reasons h3 {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cf-orange);
    margin-bottom: 0.5rem;
}

#panel-reasons-list {
    list-style: none;
    margin-bottom: 1.25rem;
}

#panel-reasons-list li {
    padding: 0.25rem 0;
    padding-left: 1rem;
    position: relative;
    color: var(--text-secondary);
}

#panel-reasons-list li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--cf-orange);
}

#panel-code {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.25rem;
    overflow-x: auto;
}

#panel-code pre {
    margin: 0;
}

#panel-code code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-primary);
}

#panel-links {
    display: flex;
    gap: 1rem;
}

#panel-links a {
    color: var(--cf-orange);
    text-decoration: none;
    font-size: 0.875rem;
    transition: opacity 0.2s;
}

#panel-links a:hover {
    opacity: 0.8;
}

#controls {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 1rem;
    z-index: 100;
}

#controls button {
    padding: 1rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

#controls button.primary {
    background: var(--cf-orange);
    color: white;
}

#controls button.primary:hover {
    background: #e5750a;
    transform: scale(1.02);
}

#controls button.hidden {
    display: none;
}

/* Responsive */
@media (max-width: 768px) {
    #metrics-bar {
        gap: 1rem;
        padding: 0.75rem 1rem;
    }
    
    .metric .value {
        font-size: 1.125rem;
    }
    
    #info-panel {
        width: calc(100% - 40px);
        right: 20px;
        left: 20px;
    }
}
```

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache Cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Install wasm-pack
        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

      - name: Build WASM
        run: wasm-pack build --target web --release

      - name: Prepare dist
        run: |
          mkdir -p dist
          cp -r www/* dist/
          cp -r pkg dist/
          cp -r assets dist/

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: shipwith-dev
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

**README.md:**
```markdown
# shipwith.dev

An interactive visualization that deconstructs itself to show how modern web apps are built on Cloudflare's edge platform.

**[Live Demo →](https://shipwith.dev)**

## What Is This?

Click "How It Works" and watch this very webpage explode into its architectural components. Navigate the 3D space to explore each piece—from Rust/WASM rendering in your browser to Workers running at the edge.

The visualization tool IS the demonstration. Meta-recursive architecture education.

## Built With

- **Rust** → compiled to WebAssembly
- **Three.js** → 3D rendering
- **Cloudflare Workers** → edge compute
- **Cloudflare Pages** → static hosting
- **Cloudflare KV** → edge caching
- **Cloudflare D1** → edge database

## Local Development

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build
wasm-pack build --target web --dev

# Serve (use any static server)
cd www && python -m http.server 8080
```

## Architecture

```
[Browser] 
    ↓ HTTPS
[Cloudflare Edge - 300+ locations]
    ├── Pages (static assets, WASM binary)
    ├── Workers (API, dynamic logic)
    ├── KV (session cache)
    └── D1 (persistent data)
```

## License

MIT
```

---

## Phase 2: Core Implementation

### 2.1 Rust Entry Point (src/lib.rs)

```rust
use wasm_bindgen::prelude::*;
use web_sys::{window, Document, HtmlCanvasElement};

mod app;
mod scene;
mod ui;
mod data;

#[wasm_bindgen]
pub struct App {
    // Application state will go here
}

#[wasm_bindgen]
impl App {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<App, JsValue> {
        // Initialize panic hook for better error messages
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();
        
        // Initialize logging
        console_log::init_with_level(log::Level::Debug)
            .expect("Failed to initialize logger");
        
        log::info!("🚀 shipwith.dev initializing...");
        
        Ok(App {})
    }
    
    #[wasm_bindgen]
    pub fn start(&mut self) -> Result<(), JsValue> {
        log::info!("Starting application...");
        
        // Get canvas element
        let document = window()
            .ok_or("No window")?
            .document()
            .ok_or("No document")?;
        
        let canvas = document
            .get_element_by_id("scene")
            .ok_or("No canvas element")?
            .dyn_into::<HtmlCanvasElement>()?;
        
        // Initialize Three.js scene via JS interop
        self.init_scene(&canvas)?;
        
        // Set up event listeners
        self.setup_events(&document)?;
        
        // Start render loop
        self.start_render_loop()?;
        
        log::info!("✅ Application started");
        Ok(())
    }
    
    fn init_scene(&self, canvas: &HtmlCanvasElement) -> Result<(), JsValue> {
        // Three.js initialization will be called here
        // We'll use JS interop to work with Three.js
        Ok(())
    }
    
    fn setup_events(&self, document: &Document) -> Result<(), JsValue> {
        // Event listener setup
        Ok(())
    }
    
    fn start_render_loop(&self) -> Result<(), JsValue> {
        // requestAnimationFrame loop
        Ok(())
    }
}
```

### 2.2 Component Data (src/data/components.rs)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchComponent {
    pub id: &'static str,
    pub name: &'static str,
    pub category: Category,
    pub description: &'static str,
    pub reasons: &'static [&'static str],
    pub code_snippet: &'static str,
    pub docs_url: &'static str,
    pub sprite_path: &'static str,
    pub position: Position,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Category {
    Client,
    Edge,
    Storage,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    pub assembled: [f32; 3],    // Position when "assembled" (laptop view)
    pub deconstructed: [f32; 3], // Position when "exploded"
}

pub const COMPONENTS: &[ArchComponent] = &[
    ArchComponent {
        id: "browser",
        name: "Browser",
        category: Category::Client,
        description: "Your browser window running this very visualization.",
        reasons: &[
            "Universal access - no install needed",
            "Sandboxed security model",
            "WebGL for 3D graphics",
        ],
        code_snippet: r#"<canvas id="scene"></canvas>
<script type="module">
  import init from './pkg/app.js';
  await init();
</script>"#,
        docs_url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
        sprite_path: "/assets/sprites/browser.png",
        position: Position {
            assembled: [0.0, 0.0, 0.0],
            deconstructed: [0.0, -3.0, 0.0],
        },
    },
    ArchComponent {
        id: "wasm",
        name: "Rust/WASM",
        category: Category::Client,
        description: "This entire visualization is written in Rust and compiled to WebAssembly for near-native performance.",
        reasons: &[
            "Near-native execution speed",
            "Memory safety without garbage collection",
            "Small binary size with aggressive optimization",
        ],
        code_snippet: r#"#[wasm_bindgen]
pub fn start() -> Result<(), JsValue> {
    let app = App::new()?;
    app.run()
}"#,
        docs_url: "https://rustwasm.github.io/docs/book/",
        sprite_path: "/assets/sprites/rust-wasm.png",
        position: Position {
            assembled: [0.0, 0.0, 0.1],
            deconstructed: [-2.0, -2.0, 0.0],
        },
    },
    ArchComponent {
        id: "threejs",
        name: "Three.js",
        category: Category::Client,
        description: "Industry-standard 3D graphics library powering the visualization.",
        reasons: &[
            "Mature ecosystem with extensive documentation",
            "Hardware-accelerated WebGL rendering",
            "Works seamlessly with WASM via JS interop",
        ],
        code_snippet: r#"const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
renderer.render(scene, camera);"#,
        docs_url: "https://threejs.org/docs/",
        sprite_path: "/assets/sprites/threejs.png",
        position: Position {
            assembled: [0.0, 0.0, 0.2],
            deconstructed: [2.0, -2.0, 0.0],
        },
    },
    ArchComponent {
        id: "worker",
        name: "Cloudflare Workers",
        category: Category::Edge,
        description: "Serverless functions running at the edge in 300+ data centers worldwide.",
        reasons: &[
            "0ms cold starts",
            "Runs within 50ms of 95% of internet users",
            "$0 for first 100,000 requests/day",
        ],
        code_snippet: r#"export default {
  async fetch(request, env) {
    return new Response("Hello from the edge!");
  }
}"#,
        docs_url: "https://developers.cloudflare.com/workers/",
        sprite_path: "/assets/sprites/cloudflare-worker.png",
        position: Position {
            assembled: [0.0, 0.0, 0.3],
            deconstructed: [0.0, 2.0, 0.0],
        },
    },
    ArchComponent {
        id: "pages",
        name: "Cloudflare Pages",
        category: Category::Edge,
        description: "Static asset hosting with automatic deployments from Git.",
        reasons: &[
            "Instant cache invalidation globally",
            "Automatic HTTPS and HTTP/3",
            "Git-based deployments with preview URLs",
        ],
        code_snippet: r#"# wrangler.toml
name = "shipwith-dev"
pages_build_output_dir = "dist""#,
        docs_url: "https://developers.cloudflare.com/pages/",
        sprite_path: "/assets/sprites/cloudflare-pages.png",
        position: Position {
            assembled: [0.0, 0.0, 0.4],
            deconstructed: [-3.0, 2.0, 0.0],
        },
    },
    ArchComponent {
        id: "kv",
        name: "Cloudflare KV",
        category: Category::Storage,
        description: "Global key-value storage with millisecond reads at the edge.",
        reasons: &[
            "Eventually consistent, perfect for caching",
            "Reads from nearest edge location",
            "Simple key-value API",
        ],
        code_snippet: r#"// Write
await env.MY_KV.put("user:123", JSON.stringify(data));

// Read  
const data = await env.MY_KV.get("user:123", "json");"#,
        docs_url: "https://developers.cloudflare.com/kv/",
        sprite_path: "/assets/sprites/cloudflare-kv.png",
        position: Position {
            assembled: [0.0, 0.0, 0.5],
            deconstructed: [3.0, 2.0, 0.0],
        },
    },
    ArchComponent {
        id: "d1",
        name: "Cloudflare D1",
        category: Category::Storage,
        description: "SQLite at the edge. Full relational database without managing servers.",
        reasons: &[
            "Familiar SQL interface",
            "Automatic replication",
            "Generous free tier",
        ],
        code_snippet: r#"const result = await env.DB.prepare(
  "SELECT * FROM users WHERE id = ?"
).bind(userId).first();"#,
        docs_url: "https://developers.cloudflare.com/d1/",
        sprite_path: "/assets/sprites/cloudflare-d1.png",
        position: Position {
            assembled: [0.0, 0.0, 0.6],
            deconstructed: [0.0, 4.0, 0.0],
        },
    },
];
```

### 2.3 Connection Data (src/data/connections.rs)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub from: &'static str,
    pub to: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub bidirectional: bool,
}

pub const CONNECTIONS: &[Connection] = &[
    Connection {
        from: "browser",
        to: "pages",
        label: "HTTPS",
        description: "Initial page load fetches HTML, CSS, JS, and WASM binary",
        bidirectional: true,
    },
    Connection {
        from: "browser",
        to: "worker",
        label: "API Request",
        description: "Dynamic requests routed to nearest edge Worker",
        bidirectional: true,
    },
    Connection {
        from: "worker",
        to: "kv",
        label: "Cache Check",
        description: "Fast key-value lookups for session and cached data",
        bidirectional: true,
    },
    Connection {
        from: "worker",
        to: "d1",
        label: "SQL Query",
        description: "Relational queries for persistent data",
        bidirectional: true,
    },
    Connection {
        from: "wasm",
        to: "threejs",
        label: "Render Calls",
        description: "Rust/WASM orchestrates Three.js via JS interop",
        bidirectional: false,
    },
];
```

---

## Phase 3: Animation & Interaction

### 3.1 State Machine

```
States:
  ASSEMBLED      - Laptop view, app running
  DECONSTRUCTING - Components flying outward
  DECONSTRUCTED  - Exploded view, navigable
  RECONSTRUCTING - Components flying back
  
Transitions:
  ASSEMBLED → DECONSTRUCTING       (click "How It Works")
  DECONSTRUCTING → DECONSTRUCTED   (animation complete)
  DECONSTRUCTED → RECONSTRUCTING   (click "Reconstruct")
  RECONSTRUCTING → ASSEMBLED       (animation complete)
```

### 3.2 Animation Curves

```rust
// Use easing functions for smooth animations
pub fn ease_out_cubic(t: f32) -> f32 {
    1.0 - (1.0 - t).powi(3)
}

pub fn ease_in_out_cubic(t: f32) -> f32 {
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}
```

### 3.3 Silk Thread Rendering

```
Thread visual properties:
- Color: Gradient from component colors
- Width: 2px base, 4px on hover
- Animation: Flowing particles along the path
- Label: Centered text with semi-transparent background
- Curve: Bezier curve with control points based on component positions
```

---

## Phase 4: Polish & Assets

### 4.1 Sprite Creation Checklist

Create 512x512 PNG sprites with transparent backgrounds:

- [ ] laptop.png - Modern laptop outline
- [ ] browser.png - Browser window chrome
- [ ] cloudflare-worker.png - Worker icon (CF orange)
- [ ] cloudflare-kv.png - Key-value icon
- [ ] cloudflare-d1.png - Database icon
- [ ] cloudflare-pages.png - Pages icon
- [ ] cloudflare-r2.png - Storage bucket icon
- [ ] rust-wasm.png - Rust gear + WASM logo
- [ ] threejs.png - Three.js logo
- [ ] user.png - Simple user silhouette

### 4.2 Color Palette

```css
/* Cloudflare brand */
--cf-orange: #F6821F;
--cf-orange-dark: #E5750A;
--cf-blue: #003682;

/* UI colors */
--bg-dark: #1d1d1d;
--bg-panel: rgba(29, 29, 29, 0.95);
--text-primary: #ffffff;
--text-secondary: #a0a0a0;
--border-subtle: rgba(255, 255, 255, 0.1);

/* Thread colors */
--thread-data: #4ECDC4;
--thread-request: #F6821F;
--thread-response: #95E616;
```

---

## Sprint Breakdown

### Sprint 1: Foundation (Days 1-2)
- [x] Domain setup (Porkbun → CF)
- [ ] GitHub repo creation
- [ ] Cloudflare Pages connected
- [ ] Basic Rust/WASM scaffold building
- [ ] Three.js scene rendering (empty with background)
- [ ] Camera controls (orbit, zoom)

### Sprint 2: Components (Days 3-4)
- [ ] Create/source PNG sprites
- [ ] Load sprites as Three.js planes
- [ ] Position components in 3D space
- [ ] Implement explode animation
- [ ] Implement reconstruct animation

### Sprint 3: Connections (Day 5)
- [ ] Render silk threads as curves
- [ ] Add flowing particle animation
- [ ] Thread labels
- [ ] Hover interaction on threads

### Sprint 4: Info Panel (Day 6)
- [ ] Component click detection
- [ ] Panel slide-in animation
- [ ] Populate panel with component data
- [ ] Close panel button
- [ ] Docs links

### Sprint 5: Polish (Day 7)
- [ ] Metrics bar (static values)
- [ ] Loading state
- [ ] Mobile touch support
- [ ] Performance optimization
- [ ] OG image for social sharing
- [ ] Final testing across browsers

---

## Success Metrics

**Demo Day Checklist:**
- [ ] Site loads in < 2 seconds
- [ ] 60fps animation on modern hardware
- [ ] Works on Chrome, Firefox, Safari
- [ ] Mobile-responsive (touch works)
- [ ] All info panels have content
- [ ] Links to CF docs work
- [ ] Meta-narrative lands ("this is built on what it explains")

---

## Future Roadmap (Post-Dane Demo)

### V1: Interactive Comparison
- Add GCP components (Cloud Run, Cloud Functions, Firestore)
- "Swap component" UI to compare architectures
- Live metrics calculations (estimated cost, latency)

### V2: Visual Polish
- Replace 2D sprites with 3D models
- Add ambient particles and lighting
- Sound design (subtle clicks, whooshes)
- Parallax depth on mouse move

### V3: Platform
- User submissions ("visualize my architecture")
- Benchmarking infrastructure
- Public leaderboards
- Embeddable widget for docs/blogs

---

## Commands Reference

```bash
# Local development
wasm-pack build --target web --dev
cd www && python -m http.server 8080

# Production build
wasm-pack build --target web --release

# Deploy (automatic via GitHub Actions, or manual):
npx wrangler pages deploy dist --project-name=shipwith-dev

# Check Cloudflare status
curl -I https://shipwith.dev
```

---

## Contact & Links

- **Project**: https://shipwith.dev
- **GitHub**: https://github.com/[USERNAME]/shipwith.dev
- **Author**: Shankar
- **For**: Dane Knecht, CTO Cloudflare
