#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "  e.g. $0 1.1.0"
  exit 1
fi

VERSION="$1"
node scripts/version.mjs "$VERSION"

echo ""
echo "  Version and lockfiles bumped to $VERSION"
echo ""
echo "  Next steps:"
echo "    git add -A"
echo "    git commit -m \"chore: release $VERSION\""
echo "    git tag v$VERSION"
echo "    git push origin main --tags"
echo ""
