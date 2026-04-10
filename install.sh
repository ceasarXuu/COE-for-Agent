#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd node
require_cmd pnpm

if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
fi

echo "Installing workspace dependencies..."
pnpm install

echo "Scanning installed agent hosts and preparing MCP registration plan..."
pnpm setup:agents:plan

echo "Applying host configuration for detected hosts..."
pnpm setup:agents

echo
echo "Installation complete."
echo "Next step: ./start.sh"
