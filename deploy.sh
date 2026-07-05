#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

TARGET="${1:-all}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
DEPS_IMAGE="${DEPS_IMAGE:-tiny-chat-deps:node22}"
PRIMARY_NPM_REGISTRY="${NPM_REGISTRY:-https://package-mirror.liara.ir/repository/npm/}"
FALLBACK_NPM_REGISTRY="${FALLBACK_NPM_REGISTRY:-https://registry.npmjs.org/}"
FORCE_INSTALL="${FORCE_INSTALL:-0}"
FORCE_DEPS_IMAGE="${FORCE_DEPS_IMAGE:-0}"
DEPENDENCY_MARKER="node_modules/.verdant-node22-linux"
DEPENDENCY_LOCK_MARKER="node_modules/.verdant-package-lock.sha256"
NPM_CACHE_DIR="$ROOT_DIR/.npm-cache"
DEPENDENCY_ARCHIVE="$ROOT_DIR/tiny-chat-node-modules-linux-node22.tar.gz"
DEPENDENCY_CHECKSUM="$DEPENDENCY_ARCHIVE.sha256"

case "$TARGET" in
  all|server|web|deps) ;;
  *)
    echo "Usage: ./deploy.sh [all|server|web|deps]" >&2
    exit 2
    ;;
esac

[[ -f package-lock.json ]] || {
  echo "package-lock.json is missing." >&2
  exit 1
}

LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"

has_dependencies() {
  [[ -d node_modules ]] \
    && [[ -f "$DEPENDENCY_MARKER" ]] \
    && [[ -x node_modules/.bin/vite ]] \
    && [[ -f node_modules/better-sqlite3/package.json ]] \
    && [[ -f node_modules/argon2/package.json ]]
}

dependency_lock_matches() {
  has_dependencies \
    && [[ -f "$DEPENDENCY_LOCK_MARKER" ]] \
    && [[ "$(cat "$DEPENDENCY_LOCK_MARKER")" == "$LOCK_HASH" ]]
}

write_dependency_markers() {
  touch "$DEPENDENCY_MARKER"
  printf '%s' "$LOCK_HASH" > "$DEPENDENCY_LOCK_MARKER"
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

extract_dependency_archive() {
  echo "Found Linux Node 22 dependency artifact; extracting it..."

  if [[ -f "$DEPENDENCY_CHECKSUM" ]]; then
    sha256sum -c "$DEPENDENCY_CHECKSUM"
  fi

  rm -rf node_modules
  tar -xzf "$DEPENDENCY_ARCHIVE"

  has_dependencies || {
    echo "The downloaded dependency artifact is invalid or incomplete." >&2
    exit 1
  }

  write_dependency_markers
}

ensure_host_dependencies() {
  mkdir -p "$NPM_CACHE_DIR"

  if [[ "$FORCE_INSTALL" != "1" ]] && dependency_lock_matches; then
    echo "Compatible node_modules matches package-lock.json; skipping dependency download."
    return
  fi

  if [[ "$FORCE_INSTALL" != "1" ]] && has_dependencies && [[ ! -f "$DEPENDENCY_LOCK_MARKER" ]]; then
    echo "Existing compatible node_modules found; recording current package-lock hash."
    write_dependency_markers
    return
  fi

  if [[ "$FORCE_INSTALL" != "1" ]] && [[ -f "$DEPENDENCY_ARCHIVE" ]]; then
    extract_dependency_archive
    return
  fi

  echo "node_modules is missing or stale; installing with Node 22 inside Docker..."
  rm -rf node_modules

  if ! install_dependencies "$PRIMARY_NPM_REGISTRY"; then
    echo "Primary NPM registry failed. Retrying with fallback registry..."
    rm -rf node_modules
    install_dependencies "$FALLBACK_NPM_REGISTRY"
  fi

  write_dependency_markers

  has_dependencies || {
    echo "Dependency installation did not create a valid Linux Node 22 node_modules directory." >&2
    exit 1
  }
}

ensure_dependency_image() {
  local image_hash
  image_hash="$(docker image inspect "$DEPS_IMAGE" --format '{{ index .Config.Labels "org.verdant.lock-hash" }}' 2>/dev/null || true)"

  if [[ "$FORCE_DEPS_IMAGE" != "1" ]] && [[ "$image_hash" == "$LOCK_HASH" ]]; then
    echo "Dependency image $DEPS_IMAGE is current; skipping dependency image build."
    return
  fi

  echo "Building dependency image once for package-lock hash: ${LOCK_HASH:0:12}"
  docker build \
    --build-arg LOCK_HASH="$LOCK_HASH" \
    --file Dockerfile.dependencies \
    --tag "$DEPS_IMAGE" \
    .
}

ensure_host_dependencies
ensure_dependency_image

if [[ "$TARGET" == "deps" ]]; then
  echo "Dependency image is ready: $DEPS_IMAGE"
  exit 0
fi

export DEPS_IMAGE

case "$TARGET" in
  server)
    SERVICES=(server)
    ;;
  web)
    SERVICES=(web)
    ;;
  all)
    SERVICES=(server web)
    ;;
esac

echo "Building: ${SERVICES[*]}"
docker compose build "${SERVICES[@]}"

echo "Starting: ${SERVICES[*]}"
docker compose up -d "${SERVICES[@]}"

echo "Deployment completed."
docker compose ps
