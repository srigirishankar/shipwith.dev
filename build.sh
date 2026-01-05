#!/bin/bash
set -e

echo "Installing Rust toolchain..."
if ! command -v rustup &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
rustup target add wasm32-unknown-unknown

echo "Installing wasm-pack..."
if ! command -v wasm-pack &> /dev/null; then
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

echo "Building WASM..."
wasm-pack build --target web --release

echo "Creating dist directory..."
rm -rf dist
mkdir -p dist

cp -r www/* dist/
cp -r pkg dist/
cp -r assets dist/

echo "Build complete!"
ls -la dist/
