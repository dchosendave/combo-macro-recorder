#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "  e.g. $0 0.2.0"
  exit 1
fi

VERSION="$1"

# Update version in Cargo.toml (format: version = "X.Y.Z")
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Update version in tauri.conf.json (format: "version": "X.Y.Z")
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# Update version in package.json (format: "version": "X.Y.Z")
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

echo ""
echo "  Version bumped to $VERSION"
echo ""
echo "  Next steps:"
echo "    git add -A"
echo "    git commit -m \"chore: bump version to $VERSION\""
echo "    git tag v$VERSION"
echo "    git push origin main --tags"
echo ""
