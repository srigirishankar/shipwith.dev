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
