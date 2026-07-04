#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
PRIMARY_NPM_REGISTRY="${NPM_REGISTRY:-https://package-mirror.liara.ir/repository/npm/}"
FALLBACK_NPM_REGISTRY="${FALLBACK_NPM_REGISTRY:-https://registry.npmjs.org/}"
FORCE_INSTALL="${FORCE_INSTALL:-0}"
DEPENDENCY_MARKER="node_modules/.verdant-node22-linux"
NPM_CACHE_DIR="$ROOT_DIR/.npm-cache"

has_dependencies() {
  [[ -d node_modules ]] \
    && [[ -f "$DEPENDENCY_MARKER" ]] \
    && [[ -x node_modules/.bin/vite ]] \
    && [[ -f node_modules/better-sqlite3/package.json ]] \
    && [[ -f node_modules/argon2/package.json ]]
}

install_dependencies() {
  local registry="$1"

  echo "Installing dependencies from: $registry"

  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -e npm_config_registry="$registry" \
    -e npm_config_cache=/npm-cache \
    -e npm_config_fetch_retries=5 \
    -e npm_config_fetch_retry_mintimeout=20000 \
    -e npm_config_fetch_retry_maxtimeout=120000 \
    -e npm_config_maxsockets=4 \
    -v "$ROOT_DIR:/app" \
    -v "$NPM_CACHE_DIR:/npm-cache" \
    -w /app \
    "$NODE_IMAGE" \
    bash -lc 'node --version && npm --version && npm install --include=dev --no-audit --no-fund'
}

mkdir -p "$NPM_CACHE_DIR"

if [[ "$FORCE_INSTALL" != "1" ]] && has_dependencies; then
  echo "Compatible node_modules exists; skipping dependency download."
else
  echo "node_modules is missing, incomplete, or incompatible; installing with Node 22 inside Docker..."
  rm -rf node_modules

  if ! install_dependencies "$PRIMARY_NPM_REGISTRY"; then
    echo "Primary NPM registry failed. Retrying with fallback registry..."
    rm -rf node_modules
    install_dependencies "$FALLBACK_NPM_REGISTRY"
  fi

  touch "$DEPENDENCY_MARKER"

  has_dependencies || {
    echo "Dependency installation did not create a valid Linux Node 22 node_modules directory." >&2
    exit 1
  }
fi

echo "Building Docker images..."
docker compose build

echo "Starting services..."
docker compose up -d

echo "Deployment completed."
docker compose ps
