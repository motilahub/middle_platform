#!/bin/sh
set -eu

listen_port="${TMDB_PROXY_BRIDGE_PORT:-11080}"
upstream_port="${TMDB_PROXY_UPSTREAM_PORT:-1080}"

case "$listen_port:$upstream_port" in
  *[!0-9:]*) echo "Proxy ports must be numeric" >&2; exit 1 ;;
esac

exec socat \
  "TCP4-LISTEN:${listen_port},fork,reuseaddr,range=${TMDB_PROXY_ALLOWED_RANGE:-172.16.0.0/12}" \
  "TCP4:${TMDB_PROXY_UPSTREAM_HOST:-127.0.0.1}:${upstream_port}"
