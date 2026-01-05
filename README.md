# shipwith.dev

Interactive architecture simulator for web apps. See how your tech choices affect what matters.

**[Live Demo →](https://shipwith.dev)**

## What Is This?

Explore technology architecture decisions by simulating their impact on the outcomes developers and product owners care about: cost, latency, uptime, and more.

Click "How It Works" and watch the architecture explode into its components. Navigate the 3D space to explore each piece, understand the tradeoffs, and see how different choices affect your bottom line.

## Built With

- **Rust** → compiled to WebAssembly
- **Three.js** → 3D rendering
- **Cloudflare Pages** → static hosting
- **Cloudflare Workers** → edge compute

## Local Development

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build
wasm-pack build --target web --dev

# Serve
cd www && python -m http.server 8080
```

## License

MIT
