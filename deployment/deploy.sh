#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.offline.yaml"
ENV_FILE="$SCRIPT_DIR/.env"
IMAGE_ARCHIVE="$SCRIPT_DIR/images.tar"
PACKAGE_IMAGE_TAG="__IMAGE_TAG__"

if [ -z "$PACKAGE_IMAGE_TAG" ] || [ "$PACKAGE_IMAGE_TAG" = "__IMAGE_TAG""__" ]; then
    echo "This deploy script is missing its package image tag." >&2
    exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose "$@"; }
else
  echo "Docker Compose is required (docker compose or docker-compose)." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is unavailable. Start Docker and try again." >&2
  exit 1
fi

if [ ! -f "$IMAGE_ARCHIVE" ]; then
  echo "Missing image archive: $IMAGE_ARCHIVE" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required to create the initial .env safely." >&2
    exit 1
  fi

  db_password=$(openssl rand -hex 24)
  session_secret=$(openssl rand -hex 48)
  printf '%s\n' \
    "IMAGE_TAG=__IMAGE_TAG__" \
    "WEB_PORT=8080" \
    "NODE_ENV=production" \
    "POSTGRES_DB=oa_workbench" \
    "POSTGRES_USER=oa_workbench" \
    "POSTGRES_PASSWORD=$db_password" \
    "SESSION_SECRET=$session_secret" \
    "COOKIE_SECURE=false" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE with generated secrets."
else
  # Keep deployment secrets and runtime options, but always deploy this package's images.
  env_tmp="$ENV_FILE.tmp.$$"
  awk -v tag="$PACKAGE_IMAGE_TAG" '
    BEGIN { updated=0 }
    /^IMAGE_TAG=/ {
      if (!updated) { print "IMAGE_TAG=" tag; updated=1 }
      next
    }
    { print }
    END { if (!updated) print "IMAGE_TAG=" tag }
  ' "$ENV_FILE" > "$env_tmp"
  mv "$env_tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Updated IMAGE_TAG to $PACKAGE_IMAGE_TAG in $ENV_FILE."
fi

image_tag=$(sed -n 's/^IMAGE_TAG=//p' "$ENV_FILE" | head -n 1)
if [ "$image_tag" != "$PACKAGE_IMAGE_TAG" ]; then
  echo "IMAGE_TAG in $ENV_FILE does not match this package ($PACKAGE_IMAGE_TAG)." >&2
  exit 1
fi

if grep -Eq '^POSTGRES_PASSWORD=(replace-|$)' "$ENV_FILE" || grep -Eq '^SESSION_SECRET=(replace-|$)' "$ENV_FILE"; then
  echo "Replace the placeholder secrets in $ENV_FILE before deployment." >&2
  exit 1
fi

echo "Loading offline images..."
docker image load -i "$IMAGE_ARCHIVE"

echo "Starting Middle Platform..."
compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Deployment submitted. Open http://<server-address>:$(sed -n 's/^WEB_PORT=//p' "$ENV_FILE" | head -n 1)"
