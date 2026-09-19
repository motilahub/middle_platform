#!/bin/sh
set -eu

lock_hash=$(sha256sum package-lock.json | awk '{print $1}')
lock_marker=node_modules/.middle-platform-package-lock

needs_install=0
if [ ! -f "$lock_marker" ] || [ "$(cat "$lock_marker" 2>/dev/null || true)" != "$lock_hash" ]; then
  needs_install=1
fi
if [ ! -x node_modules/.bin/vite ] || [ ! -d node_modules/@ant-design/x ] || [ ! -d node_modules/hls.js ]; then
  needs_install=1
fi

if [ "$needs_install" -eq 1 ]; then
  echo 'Installing web dependencies from package-lock.json...'
  npm ci
  printf '%s\n' "$lock_hash" > "$lock_marker"
fi

exec npm run dev -- --host 0.0.0.0
