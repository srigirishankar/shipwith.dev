# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

shipwith.dev is an interactive 3D visualization that deconstructs itself to show how modern web apps are built on Cloudflare's edge platform. The visualization IS the proof - built entirely with Rust/WASM on Cloudflare.

**Status**: Planning/specification phase. The `projectPlan.md` contains the full architecture and implementation details but no source code exists yet.

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
npx wrangler pages deploy dist --project-name=shipwith-dev
```

## Architecture

**Tech Stack:**
- Rust compiled to WebAssembly (wasm-pack, wasm-bindgen)
- Three.js for 3D rendering (via JS interop from Rust)
- Cloudflare Pages for hosting, Workers for edge compute
- Cloudflare KV/D1 for edge storage

**Project Structure (planned):**
```
src/
├── lib.rs              # WASM entry point, exports App struct
├── app.rs              # State machine (ASSEMBLED → DECONSTRUCTING → DECONSTRUCTED → RECONSTRUCTING)
├── scene/              # 3D visualization: camera, components, threads, animations
├── ui/                 # DOM overlays: info_panel, metrics_bar, controls
└── data/               # Static component and connection definitions
www/                    # HTML/CSS assets
assets/sprites/         # PNG component icons (512x512)
```

**Key Dependencies (Cargo.toml):**
- `wasm-bindgen` - Rust ↔ JS FFI
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
- The 8 architecture components (Browser, Rust/WASM, Three.js, Workers, Pages, KV, D1, R2) are defined as static data with assembled/deconstructed positions
- Connections between components render as Bezier curves with flowing particle animations
- Target: 60fps, <2s load time, works on Chrome/Firefox/Safari
