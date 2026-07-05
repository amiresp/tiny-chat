#!/usr/bin/env bash
set -Eeuo pipefail

cd /app

REGISTRY="${NPM_CONFIG_REGISTRY:-https://package-mirror.liara.ir/repository/npm/}"
FALLBACK_REGISTRY="${FALLBACK_NPM_REGISTRY:-https://registry.npmjs.org/}"
MARKER="node_modules/.tiny-chat-package-lock.sha256"
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"

has_valid_dependencies() {
  [[ -d node_modules ]] \
    && [[ -x node_modules/.bin/vite ]] \
    && node -e "require.resolve('express'); require.resolve('better-sqlite3'); require.resolve('argon2'); require.resolve('drizzle-orm')" >/dev/null 2>&1
}

if has_valid_dependencies; then
  if [[ ! -f "$MARKER" ]]; then
    printf '%s' "$LOCK_HASH" > "$MARKER"
    echo "Existing node_modules is valid; dependency marker created."
    exit 0
  fi

  if [[ "$(cat "$MARKER")" == "$LOCK_HASH" ]]; then
    echo "node_modules is present and package-lock.json has not changed."
    exit 0
  fi
fi

echo "Dependencies are missing, invalid, or package-lock.json changed."
echo "Running npm install from $REGISTRY ..."

if ! npm install --include=dev --no-audit --no-fund --registry="$REGISTRY"; then
  echo "Primary registry failed; retrying with $FALLBACK_REGISTRY ..."
  npm install --include=dev --no-audit --no-fund --registry="$FALLBACK_REGISTRY"
fi

has_valid_dependencies || {
  echo "Dependency installation completed but required packages are still unavailable." >&2
  exit 1
}

printf '%s' "$LOCK_HASH" > "$MARKER"
echo "Dependencies are ready."
