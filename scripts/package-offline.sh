#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
VERSION=${1:-$(git -C "$PROJECT_DIR" rev-parse --short HEAD)}
PACKAGE_NAME="middle_platform-$VERSION"
OUTPUT_ROOT="$PROJECT_DIR/release"
PACKAGE_DIR="$OUTPUT_ROOT/$PACKAGE_NAME"
OUTPUT_ARCHIVE="$OUTPUT_ROOT/$PACKAGE_NAME.tar.gz"

case "$VERSION" in
  ''|*[!A-Za-z0-9._-]*)
    echo "Version must contain only letters, numbers, dots, underscores, or hyphens." >&2
    exit 1
    ;;
esac

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is unavailable. Start Docker and try again." >&2
  exit 1
fi

if [ -e "$PACKAGE_DIR" ]; then
  echo "Package directory already exists: $PACKAGE_DIR" >&2
  echo "Use a different version argument or remove that specific package directory." >&2
  exit 1
fi
if [ -e "$OUTPUT_ARCHIVE" ]; then
  echo "Package archive already exists: $OUTPUT_ARCHIVE" >&2
  echo "Use a different version argument or remove that archive." >&2
  exit 1
fi

mkdir -p "$PACKAGE_DIR"
cleanup() {
  status=$?
  trap - EXIT INT TERM HUP
  rm -rf "$PACKAGE_DIR"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

echo "Building application images for version $VERSION..."
docker build -f "$PROJECT_DIR/server/Dockerfile" -t "middle-platform-api:$VERSION" "$PROJECT_DIR/server"
docker build -f "$PROJECT_DIR/Dockerfile.web" -t "middle-platform-web:$VERSION" "$PROJECT_DIR"
docker pull postgres:15-alpine

echo "Exporting Docker images..."
docker image save \
  "middle-platform-api:$VERSION" \
  "middle-platform-web:$VERSION" \
  postgres:15-alpine \
  -o "$PACKAGE_DIR/images.tar"

cp "$PROJECT_DIR/deployment/docker-compose.offline.yaml" "$PACKAGE_DIR/docker-compose.offline.yaml"
cp "$PROJECT_DIR/deployment/.env.example" "$PACKAGE_DIR/.env.example"
cp "$PROJECT_DIR/deployment/deploy.sh" "$PACKAGE_DIR/deploy.sh"
cp "$PROJECT_DIR/deployment/README.md" "$PACKAGE_DIR/README.md"
chmod +x "$PACKAGE_DIR/deploy.sh"

# Substitute only the package tag; deployment secrets are generated on the target host.
sed -i.bak "s/__IMAGE_TAG__/$VERSION/g" "$PACKAGE_DIR/deploy.sh"
rm "$PACKAGE_DIR/deploy.sh.bak"

tar -C "$OUTPUT_ROOT" -czf "$OUTPUT_ARCHIVE" "$PACKAGE_NAME"

echo "Created offline package: $OUTPUT_ARCHIVE"
echo "Copy it to the target server, extract it, then run: ./deploy.sh"
