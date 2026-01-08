# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

shipwith.dev is an interactive architecture simulator for web apps. See how your tech choices affect what matters: cost, latency, uptime.

## Preferences

- **Use Bun** over npm/npx (e.g., `bunx` instead of `npx`)
- **Cloudflare** for hosting and edge compute

## Build Commands

```bash
# Development build
wasm-pack build --target web --dev

# Production build
wasm-pack build --target web --release

# Full production build with asset packaging
./build.sh

# Local development server
cd www && python -m http.server 8080

# Manual deployment to Cloudflare Pages
bunx wrangler deploy
```

## Architecture

**Tech Stack:**
- Rust compiled to WebAssembly (wasm-pack, wasm-bindgen)
- Three.js for 3D rendering (via JS interop from Rust)
- Cloudflare Pages for hosting

**Project Structure:**
```
src/
└── lib.rs              # WASM entry point, exports App struct
www/                    # HTML/CSS assets
assets/sprites/         # PNG component icons
wrangler.toml           # Cloudflare Pages config
```

**Key Dependencies (Cargo.toml):**
- `wasm-bindgen` - Rust <-> JS FFI
- `web-sys` - Web API bindings (Canvas, WebGL, Events)
- `ezing` - Animation easing functions
- `serde/serde_json` - Serialization

**Release Profile:**
```toml
[profile.release]
lto = true
opt-level = 's'  # Size optimization for WASM
```

## Implementation Notes

- Three.js is accessed from Rust via JS interop, not native Rust bindings
- Target: 60fps, <2s load time, works on Chrome/Firefox/Safari

## Split-Screen Architecture (www/scene.js)

The app uses a **split-screen comparison view** with two independent viewports:
- **Left**: Pure Cloudflare stack (read-only reference)
- **Right**: Mixed/customizable stack (user can swap components)

**Key Constants:**
- `LEFT_OFFSET = -5`, `RIGHT_OFFSET = 5` - X-axis positions for each column
- `HEADER_HEIGHT_PX = 80` - Space reserved at top for column labels + dropdown
- `currentViewShift` - Dynamic shift to leave room for info panels

**Layer System (Three.js):**
- Layer 1: Left side components (leftCamera sees only layer 1)
- Layer 2: Right side components (rightCamera sees only layer 2)
- Raycaster has both layers enabled for click detection

**Key Patterns:**
- `calculateCameraParams()` - Responsive camera positioning based on viewport
- `createDebugBounds()` - Visual debugging (toggle with `DEBUG_BOUNDS` flag)
- `leftColumnShift`/`rightColumnShift` - Animate components when info panel opens
- `isReconstructing` flag - Prevents animate loop from conflicting with reconstruct animation

**Info Panels:**
- Two separate panels: `#info-panel-left` and `#info-panel-right`
- Each side operates independently (clicking one doesn't close the other)
- Uses class-based selectors (`.panel-title`, `.panel-description`, etc.)

**UI Layout:**
- Column labels at top (`#column-labels`) with provider dropdown in right label
- Comparison table at bottom center (`#comparison-table`)
- "How It Works" button at top center (`#controls`)
- Viewport rendering excludes top 80px for header area

## Component Labeling System (Two-Line Layout)

Components use a **two-line educational layout**:
- **Line 1 (Role)**: What it does - bold, white (e.g., "Edge Functions", "Key-Value Store")
- **Line 2 (Product)**: Vendor + product name - gray, italic (e.g., "Cloudflare Workers")

**Key data structures:**
- `COMPONENTS[]` - Each has `id`, `name`, `role`, `color`, `pos`, `exploded`
- `PROVIDER_COMPONENTS{}` - Full vendor+product names per provider (cf, aws, gcp, azure)
- `getComponentRole(componentId)` - Helper to get role from COMPONENTS array

**Rendering:**
- `createLabelTexture(name, color, componentId, role)` - Creates 512x512 canvas texture
- Two-line layout rendered at y=290 (role) and y=345 (product name)

## Alternatives System (www/scene.js)

**Database:**
- `ALTERNATIVES{}` - Top 3 alternatives per component with metrics, docs, warnings
- Entries for: `workers`, `pages`, `kv`, `d1`, `wasm`, `threejs`

**Key functions:**
- `populateAlternativesDropdown(panel, componentId, editable)` - Populates dropdown from ALTERNATIVES
- `showAlternativeDetails(panel, componentId, alternativeId)` - Shows metrics & warnings
- `applyAlternativeToComponent(componentId, alternativeId, alternativeName)` - Actually switches component
- `updateComponentTextureWithAlternative(mesh, name, color)` - Updates 3D texture

**Flow:**
1. User clicks component on right side → `showInfoPanel()` with editable=true
2. Dropdown populated from `ALTERNATIVES[componentId].options`
3. User selects alternative → `showAlternativeDetails()` shows comparison
4. User clicks "Apply" → `applyAlternativeToComponent()` switches texture/color

**State tracking:**
- `selectedAlternatives{}` - Tracks which alternative is selected per component
- `componentProviders{}` - Tracks which provider each component uses
- `affectedComponents` - Set of components affected by current selection
