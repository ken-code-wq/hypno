#!/usr/bin/env bash

# This script provides an easy way to run and build Hypno for various platforms.
# It wraps the inner core npm/gulp scripts.

set -e

# Change to the root of the repo
cd "$(dirname "$0")/.."

echo "=========================================="
echo "          HYPNO DEVELOPER CLI             "
echo "=========================================="
echo ""
echo "Please select an action:"
echo "  1) Run locally (Development Mode)"
echo "  2) Build for macOS (ARM64) — Fast (no minification)"
echo "  3) Build for macOS (ARM64) — Full (with minification)"
echo "  4) Build for macOS (x64) — Fast"
echo "  5) Build for macOS (x64) — Full"
echo "  6) Build for Windows (x64)"
echo "  7) Build for Linux (x64)"
echo "  q) Quit"
echo ""

read -p "Enter choice [1-7, or q]: " choice

case $choice in
  1)
    echo "Starting local development mode..."
    echo "Tip: Make sure you have another terminal open running 'npm run watch'"
    ./scripts/code.sh
    ;;
  2)
    echo "Building for macOS ARM64 (Apple Silicon) — Fast build (no minification)..."
    echo "This skips minification and mangling for a significantly faster build."
    npm run gulp vscode-darwin-arm64
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-darwin-arm64"
    ;;
  3)
    echo "Building for macOS ARM64 (Apple Silicon) — Full build (with minification)..."
    echo "Warning: This is very resource-intensive and may take 20+ minutes."
    npm run gulp vscode-darwin-arm64-min
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-darwin-arm64"
    ;;
  4)
    echo "Building for macOS x64 (Intel) — Fast build (no minification)..."
    npm run gulp vscode-darwin-x64
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-darwin-x64"
    ;;
  5)
    echo "Building for macOS x64 (Intel) — Full build (with minification)..."
    echo "Warning: This is very resource-intensive and may take 20+ minutes."
    npm run gulp vscode-darwin-x64-min
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-darwin-x64"
    ;;
  6)
    echo "Building for Windows x64..."
    npm run gulp vscode-win32-x64-min
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-win32-x64"
    ;;
  7)
    echo "Building for Linux x64..."
    npm run gulp vscode-linux-x64-min
    echo ""
    echo "Build complete! Check the parent directory: ../VSCode-linux-x64"
    ;;
  q|Q)
    echo "Exiting."
    exit 0
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac
