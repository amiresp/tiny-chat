#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
NPM_REGISTRY="${NPM_REGISTRY:-https://package-mirror.liara.ir/repository/npm/}"
FORCE_INSTALL="${FORCE_INSTALL:-0}"

has_dependencies() {
  [[ -d node_modules ]] \
    && [[ -x node_modules/.bin/vite ]] \
    && [[ -f node_modules/better-sqlite3/package.json ]] \
    && [[ -f node_modules/argon2/package.json ]]
}

if [[ "$FORCE_INSTALL" != "1" ]] && has_dependencies; then
  echo "node_modules exists; skipping dependency download."
else
  echo "node_modules is missing or incomplete; installing into the project directory..."
  rm -rf node_modules

  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -e npm_config_registry="$NPM_REGISTRY" \
    -v "$ROOT_DIR:/app" \
    -w /app \
    "$NODE_IMAGE" \
    bash -lc 'npm install --include=dev --no-audit --no-fund'

  has_dependencies || {
    echo "Dependency installation did not create a valid node_modules directory." >&2
    exit 1
  }
fi

echo "Building Docker images..."
docker compose build

echo "Starting services..."
docker compose up -d

echo "Deployment completed."
docker compose ps
